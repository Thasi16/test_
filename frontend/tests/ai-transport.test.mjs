import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { capability, blobToken } from "../src/lib/ai-transport.ts";
import { ownedUploadPath, cleanupDeadline } from "../src/lib/ai-cleanup.ts";
const origin = "https://signhearing.test";
test("cleanup cannot target another key, URL, traversal or prefix", () => {
  for (const path of ["inference/", "https://store.test/secret", "../secret", "inference/abcdefghijklmnopqrstuvwx/other"])
    assert.throws(() => ownedUploadPath(path));
  assert.equal(ownedUploadPath("inference/abcdefghijklmnopqrstuvwx/payload"), "inference/abcdefghijklmnopqrstuvwx/payload");
  assert.equal(cleanupDeadline(1000).getTime(), 1_180_000);
});
process.env.AI_TOKEN_SECRET =
  "unit-test-only-capability-secret-at-least-32-bytes";
function request(changes = {}) {
  const now = Math.floor(Date.now() / 1000);
  const c = {
    iss: "signhearing-vercel",
    aud: "signhearing-siformer",
    scope: "infer",
    sub: "user",
    origin,
    expected_gloss: "fixture",
    iat: now,
    exp: now + 120,
    jti: "abcdefghijklmnopqrstuvwx",
    ...changes,
  };
  const payload = Buffer.from(JSON.stringify(c)).toString("base64url");
  const sig = createHmac("sha256", process.env.AI_TOKEN_SECRET)
    .update("v1." + payload)
    .digest("base64url");
  return new Request(origin + "/api/ai/infer", {
    method: "POST",
    headers: {
      Origin: origin,
      Authorization: "Bearer v1." + payload + "." + sig,
    },
  });
}
test("Node transport accepts original versioned HMAC claims and binds upload ownership", () => {
  assert.equal(
    capability(request()).pathname,
    "inference/abcdefghijklmnopqrstuvwx/payload",
  );
});
test("Node transport rejects expired, wrong scope, wrong origin and forged ownership", () => {
  for (const change of [
    { exp: 0 },
    { scope: "login" },
    { origin: "https://evil.test" },
    { jti: "../other" },
    { iat: 9999999999 },
  ])
    assert.throws(() => capability(request(change)));
  const r = request();
  r.headers.set("Authorization", r.headers.get("Authorization") + "bad");
  assert.throws(() => capability(r));
  const cross = request();
  cross.headers.set("Origin", "https://evil.test");
  assert.throws(() => capability(cross));
});
test("private upload configuration rejects public or arbitrary storage origins", () => {
  process.env.BLOB_READ_WRITE_TOKEN = "test-placeholder";
  for (const value of [
    "https://evil.test",
    "https://store.public.blob.vercel-storage.com",
    "https://store.private.blob.vercel-storage.com/path",
  ]) {
    process.env.AI_BLOB_ORIGIN = value;
    assert.throws(() => blobToken());
  }
  process.env.AI_BLOB_ORIGIN = "https://store.private.blob.vercel-storage.com";
  assert.equal(blobToken(), "test-placeholder");
});

test("an explicit trusted site origin works behind an internal service address", () => {
  process.env.SITE_URL = origin;
  try {
    const original = request();
    const internal = new Request("http://internal.test/api/ai/infer", {
      method: "POST",
      headers: original.headers,
    });
    assert.equal(
      capability(internal).pathname,
      "inference/abcdefghijklmnopqrstuvwx/payload",
    );
  } finally {
    delete process.env.SITE_URL;
  }
});
