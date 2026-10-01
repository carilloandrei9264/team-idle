import process from "node:process";
import { HttpError } from "./errors.js";
import { getPrivateDocumentDownload, signPrivateDocumentUpload } from "./documents.js";
import { requireUser } from "./auth.js";

export async function handleSignPrivateDocument(req, dependencies) {
  const { uid } = await requireUser(req, dependencies);
  return signPrivateDocumentUpload({
    ...dependencies,
    uid,
    body: req.body,
  });
}

export async function handleGetPrivateDocument(req, dependencies) {
  const { uid, role } = await requireUser(req, { ...dependencies, checkRevoked: true });
  const listingId = req.query?.id;
  const kind = req.query?.kind;
  const ttlSeconds = Number(process.env.DOC_LINK_TTL_SECONDS || 300);
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 300) {
    throw new HttpError(500, "CONFIGURATION", "Document link lifetime is not configured safely.");
  }
  return getPrivateDocumentDownload({
    ...dependencies,
    uid,
    role,
    listingId,
    kind,
    ttlSeconds,
  });
}