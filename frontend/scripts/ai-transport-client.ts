import { put } from "@vercel/blob/client";
const DIRECT_BYTES = 4_000_000;
// This function changes transport only. The original JSON/JPEG or video bytes
// are never decoded, recompressed, reordered, cropped or otherwise transformed.
export async function sendInference(
  config: { endpoint: string; token: string },
  body: Blob,
  signal: AbortSignal,
) {
  const headers = {
    Authorization: "Bearer " + config.token,
    "Content-Type": body.type,
  };
  if (body.size <= DIRECT_BYTES)
    return fetch(config.endpoint, {
      method: "POST",
      body,
      headers,
      signal,
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
    });
  if (body.size > 20 * 1024 * 1024) throw new Error("video_too_large");
  let uploaded = false;
  try {
    const grantResponse = await fetch("/api/ai/transport/upload", {
      method: "POST",
      credentials: "omit",
      signal,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ bytes: body.size, content_type: body.type }),
    });
    const grant = await grantResponse.json();
    if (!grantResponse.ok)
      throw new Error(grant.error?.code ?? "ai_unavailable");
    const bytes = await body.arrayBuffer();
    const digest = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    await put(grant.pathname, body, {
      access: "private",
      token: grant.client_token,
      contentType: body.type,
      abortSignal: signal,
    });
    uploaded = true;
    return await fetch(config.endpoint, {
      method: "POST",
      credentials: "omit",
      signal,
      redirect: "error",
      referrerPolicy: "no-referrer",
      headers: {
        ...headers,
        "Content-Type": "application/vnd.signhearing.blob+json",
      },
      body: JSON.stringify({
        pathname: grant.pathname,
        bytes: body.size,
        sha256: digest,
        content_type: body.type,
      }),
    });
  } finally {
    if (uploaded)
      fetch("/api/ai/transport/cleanup", {
        method: "POST",
        credentials: "omit",
        keepalive: true,
        headers: { Authorization: headers.Authorization },
      }).catch(() => {});
  }
}
