import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { connectAuthEmulator } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { connectFunctionsEmulator } from "firebase/functions";
import { connectFirestoreEmulator } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { connectStorageEmulator } from "firebase/storage";

const useFirebaseEmulators = import.meta.env?.DEV
  && import.meta.env?.VITE_USE_SHARED_FIREBASE !== "true";

const firebaseConfig = useFirebaseEmulators
  ? {
    apiKey: "demo-api-key",
    authDomain: "demo-trusthome-local.firebaseapp.com",
    projectId: "demo-trusthome-local",
    storageBucket: "demo-trusthome-local.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:demo",
  }
  : {
    apiKey: "AIzaSyBDpgXNamj2-lRmxCaR5aK10Nmj4fdGyvY",
    authDomain: "trusthome-ph.firebaseapp.com",
    projectId: "trusthome-ph",
    storageBucket: "trusthome-ph.firebasestorage.app",
    messagingSenderId: "806158337156",
    appId: "1:806158337156:web:f85373afbdc655a69deed1",
  };

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app, "asia-southeast1");
export const storage = getStorage(app);

if (useFirebaseEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8082);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  connectStorageEmulator(storage, "127.0.0.1", 9200);
} else if (import.meta.env?.DEV) {
  console.warn("Local development is connected to the shared Firebase project.");
}
