import { timingSafeEqual } from "node:crypto";
import { del, list } from "@vercel/blob";
import {
  blobToken,
  capability,
  failure,
  privateHeaders,
} from "@/lib/ai-transport";
export const runtime = "nodejs";
export const maxDuration = 300;
// Authenticated best-effort client cleanup, including aborted inference.
export async function POST(request: Request) {
  try {
    const auth = capability(request);
    await del(auth.pathname, { token: blobToken() });
    return Response.json({ success: true }, { headers: privateHeaders });
  } catch {
    return failure();
  }
}
// Delete orphaned uploads, e.g. after a browser closes or a function is killed.
// Daily Hobby-compatible backstop. Normal deletion uses finally + Workflow;
// every grant also enforces a storage TTL so Preview has a final backstop.
export async function GET(request: Request) {
  const wanted = "Bearer " + (process.env.CRON_SECRET ?? "");
  const got = request.headers.get("authorization") ?? "";
  if (
    !process.env.CRON_SECRET ||
    got.length !== wanted.length ||
    !timingSafeEqual(Buffer.from(got), Buffer.from(wanted))
  )
    return failure("unauthorized", 401);
  try {
    const token = blobToken();
    let cursor: string | undefined;
    let removed = 0;
    do {
      const page = await list({
        prefix: "inference/",
        limit: 1000,
        cursor,
        token,
      });
      const stale = page.blobs
        .filter((b) => Date.now() - b.uploadedAt.getTime() > 180_000)
        .map((b) => b.pathname);
      if (stale.length) {
        await del(stale, { token });
        removed += stale.length;
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return Response.json({ removed }, { headers: privateHeaders });
  } catch {
    return failure();
  }
}
