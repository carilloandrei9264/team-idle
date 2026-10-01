import process from "node:process";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;

if (!getApps().length) {
  const emulatorMode = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  initializeApp(emulatorMode
    ? { projectId }
    : {
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey?.replace(/\\n/g, "\n"),
      }),
      projectId,
    });
}

export const adminAuth = getAuth();
export const db = getFirestore();
export { FieldValue };