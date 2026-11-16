// Operator-only test against Preview storage and a loopback inference stack.
// No tokens, object keys, video bytes, or environment values are logged.
import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parseEnv } from "node:util";

const require = createRequire(new URL("../../frontend/package.json", import.meta.url));
const { head, del, BlobNotFoundError } = require("@vercel/blob");
const { put, getPayloadFromClientToken } = require("@vercel/blob/client");
const env = parseEnv(readFileSync(".runtime/cloud-test.env", "utf8"));
const origin = "http://127.0.0.1:3000";
const token = env.BLOB_READ_WRITE_TOKEN;
const input = readFileSync(".runtime/memory-final/near-upload-limit.mp4");
const rows = [];

function capability() {
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: "signhearing-vercel", aud: "signhearing-siformer", scope: "infer",
    sub: "blob-diagnostic-" + randomBytes(12).toString("hex"), origin,
    expected_gloss: "", iat: now, exp: now + 120, jti: randomBytes(18).toString("base64url") };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", env.AI_TOKEN_SECRET).update("v1." + payload).digest("base64url");
  return "v1." + payload + "." + signature;
}
async function missing(pathname) {
  try { await head(pathname, { token }); return false; }
  catch (error) { if (error instanceof BlobNotFoundError) return true; throw error; }
}

for (const mode of ["valid", "bad-sha256", "orphan"]) {
  let pathname;
  try {
    const auth = capability();
    const headers = { Authorization: "Bearer " + auth, Origin: origin, "Content-Type": "application/json" };
    const grantResponse = await fetch(origin + "/api/ai/transport/upload", { method: "POST", headers,
      body: JSON.stringify({ bytes: input.length, content_type: "video/mp4" }) });
    assert.equal(grantResponse.status, 200, "upload grant unavailable");
    const grant = await grantResponse.json();
    pathname = grant.pathname;
    const options = getPayloadFromClientToken(grant.client_token);
    assert.equal(options.ttlDays, 1);
    assert.equal(options.allowOverwrite, false);
    const blob = await put(pathname, input, { access: "private", contentType: "video/mp4", token: grant.client_token });
    const anonymous = await fetch(blob.url, { redirect: "error" });
    assert.notEqual(anonymous.status, 200, "private object was anonymously readable");
    const info = await head(pathname, { token });
    assert.equal(info.size, input.length);
    assert.ok(info.expiresAt, "storage-enforced expiration missing");
    if (mode === "orphan") {
      const started = Date.now();
      // No inference or client cleanup: only the original durable timer deletes it.
      while (Date.now() - started < 360_000 && !(await missing(pathname)))
        await new Promise((resolve) => setTimeout(resolve, 5000));
      assert.ok(await missing(pathname), "durable orphan cleanup failed");
      rows.push({ mode, deleted: true, wait_ms: Date.now() - started, ttl_verified: true });
    } else {
      headers["Content-Type"] = "application/vnd.signhearing.blob+json";
      const response = await fetch(origin + "/api/ai/infer", { method: "POST", headers,
        body: JSON.stringify({ pathname, bytes: input.length,
          sha256: mode === "valid" ? createHash("sha256").update(input).digest("hex") : "0".repeat(64),
          content_type: "video/mp4" }) });
      const prediction = await response.json();
      assert.equal(response.status, mode === "valid" ? 200 : 400);
      if (mode === "valid") { assert.equal(prediction.device, "CPU"); assert.equal(prediction.success, true); }
      assert.ok(await missing(pathname), "finally cleanup did not delete upload");
      rows.push({ mode, status: response.status, deleted: true, private_access_verified: true, ttl_verified: true,
        ...(mode === "valid" ? { prediction } : {}) });
    }
    console.log(JSON.stringify({ mode, passed: true }));
  } finally {
    if (pathname) await del(pathname, { token });
  }
}
writeFileSync(".runtime/parity/cloud-blob-cleanup.json", JSON.stringify({
  scope: "Real Preview private Blob; local Next/AI and Redis; operator HMAC, not live Supabase auth", rows,
}, null, 2));
