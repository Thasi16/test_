import { del } from "@vercel/blob";
import {
  BLOB_MIME,
  DIRECT_BYTES,
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
  let owned: string | undefined;
  try {
    const auth = capability(request);
    const type = request.headers.get("content-type")?.split(";")[0] ?? "";
    if (![...MIMES, BLOB_MIME].includes(type))
      return failure("unsupported_video", 415);
    const length = Number(request.headers.get("content-length") ?? 0);
    if (!Number.isFinite(length) || length < 0 || length > DIRECT_BYTES)
      return failure("video_too_large", 413);
    // Read with a hard bound even when the request has no Content-Length.
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    if (!reader) return failure("invalid_video", 400);
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > DIRECT_BYTES) {
        await reader.cancel();
        return failure("video_too_large", 413);
      }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks);
    if (type === BLOB_MIME) {
      if (body.length > 16384) return failure("invalid_video", 400);
      const descriptor = JSON.parse(body.toString("utf8"));
      if (descriptor.pathname !== auth.pathname)
        return failure("invalid_video", 400);
      blobToken();
      owned = auth.pathname;
    }
    const response = await callAI(request, "/infer", body, type);
    return new Response(response.body, {
      status: response.status,
      headers: { ...privateHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return transportError(error);
  } finally {
    if (owned) {
      try {
        await del(owned, { token: blobToken() });
      } catch {
        console.error(
          "AI temporary upload cleanup failed; scheduled cleanup required",
        );
      }
    }
  }
}
