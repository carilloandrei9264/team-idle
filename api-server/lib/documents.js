import { HttpError } from "./errors.js";
import { randomUUID } from "node:crypto";

const LISTING_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const DOCUMENT_KINDS = new Set(["ownership", "govId"]);
const SIGNATURE_WINDOW_MS = 60 * 60 * 1000;
const SIGNATURE_LIMIT = 20;

export async function signPrivateDocumentUpload({
  db,
  cloudinary,
  uid,
  body,
  apiKey,
  apiSecret,
  cloudName,
  uploadPreset = "trusthome_private_docs",
  now = Date.now(),
  createId = randomUUID,
}) {
  const { listingId, kind, resourceType = "image" } = body || {};
  validateDocumentRequest(listingId, kind);
  if (!new Set(["image", "raw"]).has(resourceType)) {
    throw new HttpError(422, "BAD_RESOURCE_TYPE", "This document format is not allowed.");
  }

  const listingSnapshot = await db.collection("listings").doc(listingId).get();
  if (listingSnapshot.exists && listingSnapshot.data().ownerId !== uid) {
    throw new HttpError(403, "NOT_OWNER", "You can only upload documents for your own listing.");
  }

  await reserveUploadSignature(db, uid, now);

  const params = {
    timestamp: Math.floor(now / 1000),
    upload_preset: uploadPreset,
    type: "authenticated",
    public_id: `trusthome_private_${listingId}_${kind}_${createId()}`,
    asset_folder: `trusthome/private/${uid}`,
    tags: `verification,${kind}`,
    context: `listing=${listingId}`,
  };
  return {
    signature: cloudinary.utils.api_sign_request(params, apiSecret),
    timestamp: params.timestamp,
    apiKey,
    cloudName,
    resourceType,
    params,
  };
}

export async function getPrivateDocumentDownload({
  db,
  cloudinary,
  uid,
  role,
  listingId,
  kind,
  now = Date.now(),
  ttlSeconds = 300,
}) {
  validateDocumentRequest(listingId, kind);

  const [listingSnapshot, privateSnapshot] = await Promise.all([
    db.collection("listings").doc(listingId).get(),
    db.collection("listingPrivate").doc(listingId).get(),
  ]);
  if (!listingSnapshot.exists || !privateSnapshot.exists) {
    throw new HttpError(404, "NOT_FOUND", "Listing or document not found.");
  }

  const listing = listingSnapshot.data();
  if (role !== "admin" && listing.ownerId !== uid) {
    throw new HttpError(403, "FORBIDDEN", "You cannot view this verification document.");
  }

  const asset = privateSnapshot.data().documents?.[kind];
  if (!asset?.publicId || !asset?.format || !["image", "raw"].includes(asset.resourceType)) {
    throw new HttpError(404, "NO_DOCUMENT", "No verification document is available.");
  }
  const expectedPrefix = `trusthome_private_${listingId}_${kind}_`;
  if (!asset.publicId.startsWith(expectedPrefix)) {
    throw new HttpError(404, "NO_DOCUMENT", "No verification document is available.");
  }

  const expiresAt = Math.floor(now / 1000) + ttlSeconds;
  const url = cloudinary.utils.private_download_url(asset.publicId, asset.format, {
    resource_type: asset.resourceType,
    type: "authenticated",
    expires_at: expiresAt,
  });
  return { url, expiresAt };
}

function validateDocumentRequest(listingId, kind) {
  if (typeof listingId !== "string" || !LISTING_ID_PATTERN.test(listingId)) {
    throw new HttpError(422, "INVALID_LISTING_ID", "A valid listing ID is required.");
  }
  if (!DOCUMENT_KINDS.has(kind)) throw new HttpError(422, "BAD_KIND", "Unknown document type.");
}

async function reserveUploadSignature(db, uid, now) {
  const limitRef = db.collection("uploadSignatureLimits").doc(uid);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(limitRef);
    const current = snapshot.exists ? snapshot.data() : {};
    const windowStart = Number(current.windowStart || now);
    const count = now - windowStart >= SIGNATURE_WINDOW_MS ? 0 : Number(current.count || 0);
    if (count >= SIGNATURE_LIMIT) {
      throw new HttpError(429, "SIGNATURE_RATE_LIMIT", "Too many document uploads. Try again later.");
    }
    transaction.set(limitRef, {
      windowStart: count === 0 ? now : windowStart,
      count: count + 1,
    }, { merge: true });
  });
}