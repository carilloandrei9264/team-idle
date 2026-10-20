import { getBlob, ref, uploadBytes } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { functions, storage } from "./firebase";

export async function uploadSecureDocument(file, userId, listingId, kind) {
  const safeName = (file?.name || "document").replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `verification/${userId}/${listingId}/${kind}-${Date.now()}-${safeName}`;
  await uploadBytes(ref(storage, path), file, { contentType: file.type || "application/octet-stream" });
  return path;
}

export async function getSecureDocumentBlob(path) {
  return getBlob(ref(storage, path));
}

export async function getSecureDocumentUrl(path, expiresInSeconds = 300) {
  const readDocument = httpsCallable(functions, "getSecureDocumentUrl");
  const result = await readDocument({ path, expiresInSeconds });
  return result.data?.url;
}
