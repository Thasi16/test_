import { createHmac, timingSafeEqual } from "node:crypto";

export const MAX_BYTES = 20 * 1024 * 1024;
export const DIRECT_BYTES = 4_000_000;
export const BLOB_MIME = "application/vnd.signhearing.blob+json";
export const MIMES = ["application/json", "video/mp4", "video/webm"];
export const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export function failure(code = "ai_unavailable", status = 503) {
  return Response.json(
    { success: false, error: { code } },
    { status, headers: privateHeaders },
  );
}
export function capability(request: Request) {
  const secret = process.env.AI_TOKEN_SECRET ?? "";
  const origin = request.headers.get("origin");
  const origins = new Set([new URL(request.url).origin]);
  if (process.env.SITE_URL) origins.add(new URL(process.env.SITE_URL).origin);
  for (const host of [
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ])
    if (host) origins.add(new URL("https://" + host).origin);
  if (!origin || !origins.has(origin)) throw new Error("origin_not_allowed");
  if (Buffer.byteLength(secret) < 32) throw new Error("ai_unavailable");
  const token =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (token.length > 4096) throw new Error("unauthorized");
  const [version, payload, signature, ...extra] = token.split(".");
  if (version !== "v1" || !payload || !signature || extra.length)
    throw new Error("unauthorized");
  const wanted = createHmac("sha256", secret)
    .update("v1." + payload)
    .digest("base64url");
  if (
    wanted.length !== signature.length ||
    !timingSafeEqual(Buffer.from(wanted), Buffer.from(signature))
  )
    throw new Error("unauthorized");
  const c = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  const now = Math.floor(Date.now() / 1000);
  if (
    c.iss !== "signhearing-vercel" ||
    c.aud !== "signhearing-siformer" ||
    c.scope !== "infer" ||
    c.origin !== origin ||
    typeof c.sub !== "string" ||
    !c.sub ||
    typeof c.jti !== "string" ||
    !/^[A-Za-z0-9_-]{24}$/.test(c.jti) ||
    typeof c.expected_gloss !== "string" ||
    !Number.isInteger(c.exp) ||
    !Number.isInteger(c.iat) ||
    c.exp <= now ||
    c.iat > now + 5 ||
    c.exp - c.iat <= 0 ||
    c.exp - c.iat > 120
  )
    throw new Error("unauthorized");
  return { pathname: "inference/" + c.jti + "/payload", expiresAt: c.exp };
}
export function blobToken() {
  if (
    !process.env.BLOB_READ_WRITE_TOKEN ||
    !/^https:\/\/[a-z0-9]+\.private\.blob\.vercel-storage\.com$/.test(
      process.env.AI_BLOB_ORIGIN ?? "",
    )
  )
    throw new Error("ai_unavailable");
  return process.env.BLOB_READ_WRITE_TOKEN;
}
export async function callAI(
  request: Request,
  path: string,
  body?: Uint8Array,
  contentType?: string,
) {
  const base = process.env.SIFORMER_SERVICE_URL;
  if (!base) throw new Error("ai_unavailable");
  return fetch(base.replace(/\/$/, "") + path, {
    method: "POST",
    cache: "no-store",
    redirect: "error",
    signal: request.signal,
    headers: {
      Authorization: request.headers.get("authorization") ?? "",
      Origin: request.headers.get("origin") ?? "",
      "Content-Type": contentType ?? "application/json",
    },
    body: body as BodyInit | undefined,
  });
}

export function transportError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  return code === "unauthorized"
    ? failure(code, 401)
    : code === "origin_not_allowed"
      ? failure(code, 403)
      : failure();
}
