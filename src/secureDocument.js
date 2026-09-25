import { getBlob, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

export async function uploadSecureDocument(file, userId, listingId, kind) {
  const path = `verification/${userId}/${listingId}/${kind}-${Date.now()}-${file.name}`;
  await uploadBytes(ref(storage, path), file, { contentType: file.type || "application/octet-stream" });
  return path;
}

export async function getSecureDocumentBlob(path) {
  return getBlob(ref(storage, path));
}

export async function getLegacyDocumentUrl(path) {
  return getDownloadURL(ref(storage, path));
}
