// Only an opaque, capability-owned object path is stored in Workflow state.
export function ownedUploadPath(pathname: string) {
  if (!/^inference\/[A-Za-z0-9_-]{24}\/payload$/.test(pathname))
    throw new Error("invalid_upload_path");
  return pathname;
}

export function cleanupDeadline(expiresAt: number) {
  if (!Number.isInteger(expiresAt)) throw new Error("invalid_upload_expiry");
  // Capability expiry plus the original upload/inference deadlines and grace.
  return new Date(expiresAt * 1000 + 180_000);
}
