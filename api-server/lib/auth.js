import { HttpError } from "./errors.js";

export async function requireUser(req, { adminAuth, db, checkRevoked = false }) {
  const match = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  if (!match) throw new HttpError(401, "NO_TOKEN", "Sign in to continue.");

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(match[1], checkRevoked);
  } catch {
    throw new HttpError(401, "BAD_TOKEN", "Your session expired. Sign in again.");
  }

  const profileSnapshot = await db.collection("users").doc(decoded.uid).get();
  if (!profileSnapshot.exists) throw new HttpError(403, "NO_PROFILE", "Account profile not found.");
  if (profileSnapshot.data().status !== "active") {
    throw new HttpError(403, "ACCOUNT_SUSPENDED", "This account is suspended.");
  }

  return { uid: decoded.uid, role: profileSnapshot.data().role, profile: profileSnapshot.data() };
}