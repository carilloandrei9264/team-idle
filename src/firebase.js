import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBDpgXNamj2-lRmxCaR5aK10Nmj4fdGyvY",
  authDomain: "trusthome-ph.firebaseapp.com",
  projectId: "trusthome-ph",
  storageBucket: "trusthome-ph.firebasestorage.app",
  messagingSenderId: "806158337156",
  appId: "1:806158337156:web:f85373afbdc655a69deed1"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);