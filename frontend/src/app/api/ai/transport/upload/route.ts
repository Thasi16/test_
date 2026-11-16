import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { start } from "workflow/api";
import { cleanupUpload } from "@/workflows/ai-upload-cleanup";
import { cleanupDeadline } from "@/lib/ai-cleanup";
import {
  MAX_BYTES,
  MIMES,
  blobToken,
  callAI,
  capability,
  failure,
  privateHeaders,
  transportError,
} from "@/lib/ai-transport";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    const auth = capability(request);
    const token = blobToken();
    if (Number(request.headers.get("content-length") ?? 0) > 4096)
      return failure("invalid_video", 400);
    // The browser sends two small scalar fields, never file bytes here.
    const text = await request.text();
    if (text.length > 4096) return failure("invalid_video", 400);
    const body = JSON.parse(text);
    if (
      !Number.isInteger(body.bytes) ||
      body.bytes < 1 ||
      body.bytes > MAX_BYTES ||
      !MIMES.includes(body.content_type)
    )
      return failure("video_too_large", 413);
    const claim = await callAI(request, "/claim-upload");
    if (!claim.ok)
      return new Response(claim.body, {
        status: claim.status,
        headers: privateHeaders,
      });
    const grant = await claim.json();
    if (grant.pathname !== auth.pathname || grant.expires_at !== auth.expiresAt)
      throw new Error("ai_unavailable");
    // Fail closed: never issue an upload grant without durable cleanup queued.
    await start(cleanupUpload, [auth.pathname, cleanupDeadline(auth.expiresAt)], {
      experimental_retention: 0,
    });
    const clientToken = await generateClientTokenFromReadWriteToken({
      token,
      pathname: auth.pathname,
      maximumSizeInBytes: body.bytes,
      allowedContentTypes: [body.content_type],
      validUntil: auth.expiresAt * 1000,
      addRandomSuffix: false,
      allowOverwrite: false,
      cacheControlMaxAge: 60,
      // Storage-enforced backstop, including uploads completing after cleanup.
      // Vercel applies daily expiration; this is not the normal deletion path.
      ttlDays: 1,
    });
    return Response.json(
      { pathname: auth.pathname, client_token: clientToken },
      { headers: privateHeaders },
    );
  } catch (error) {
    return transportError(error);
  }
}
