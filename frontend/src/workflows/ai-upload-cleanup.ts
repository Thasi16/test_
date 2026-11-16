import { sleep } from "workflow";
import { del } from "@vercel/blob";
import { blobToken } from "../lib/ai-transport";
import { ownedUploadPath } from "../lib/ai-cleanup";

async function removeUpload(pathname: string) {
  "use step";
  await del(ownedUploadPath(pathname), { token: blobToken() });
}

export async function cleanupUpload(pathname: string, deadline: Date) {
  "use workflow";
  // Durable sleep survives function termination and also runs on Preview.
  await sleep(deadline);
  await removeUpload(pathname);
}
