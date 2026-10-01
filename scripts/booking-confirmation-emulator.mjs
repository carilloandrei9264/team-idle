import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initializeApp, deleteApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc, Timestamp } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

const projectId = "demo-trusthome-booking-confirmation";
const testEnvironment = await initializeTestEnvironment({
  projectId,
  firestore: { rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8") },
});
const app = initializeApp({ apiKey: "demo-api-key", projectId, appId: "demo-app" }, projectId);
const auth = getAuth(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, "127.0.0.1", 8080);
const functions = getFunctions(app, "asia-southeast1");
connectFunctionsEmulator(functions, "127.0.0.1", 5001);

try {
  const credential = await createUserWithEmailAndPassword(auth, "booking-owner@example.test", "test-password-123");
  const ownerId = credential.user.uid;
  const privateAddress = "Synthetic address for emulator test";
  const startDate = (day) => Timestamp.fromDate(new Date(`2026-10-${day}T00:00:00.000Z`));

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, "users", ownerId), { role: "user", status: "active" });
    await setDoc(doc(adminDb, "listings", "listing-1"), {
      ownerId,
      title: "Synthetic listing",
      verificationStatus: "verified",
    });
    await setDoc(doc(adminDb, "listingPrivate", "listing-1"), { ownerId, address: privateAddress });

    const bookings = [
      ["confirmed-existing", "Confirmed", "10", "15"],
      ["pending-conflict", "Pending", "12", "13"],
      ["pending-concurrent-a", "Pending", "20", "25"],
      ["pending-concurrent-b", "Pending", "20", "25"],
    ];
    for (const [bookingId, status, startDay, endDay] of bookings) {
      await setDoc(doc(adminDb, "bookings", bookingId), {
        listingId: "listing-1",
        listingTitle: "Synthetic listing",
        ownerId,
        renterId: `renter-${bookingId}`,
        status,
        startDate: startDate(startDay),
        endDate: startDate(endDay),
      });
    }
  });

  const confirmBooking = httpsCallable(functions, "confirmBooking");
  await assert.rejects(
    confirmBooking({ bookingId: "pending-conflict" }),
    (error) => error.code === "functions/failed-precondition",
  );

  const concurrentResults = await Promise.allSettled([
    confirmBooking({ bookingId: "pending-concurrent-a" }),
    confirmBooking({ bookingId: "pending-concurrent-b" }),
  ]);
  assert.equal(concurrentResults.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(concurrentResults.filter((result) => result.status === "rejected").length, 1);

  const confirmedIds = ["pending-concurrent-a", "pending-concurrent-b"];
  const confirmedBookings = await Promise.all(confirmedIds.map((id) => getDoc(doc(db, "bookings", id))));
  const confirmedBooking = confirmedBookings.find((snapshot) => snapshot.data()?.status === "Confirmed");
  assert.ok(confirmedBooking);
  assert.equal(confirmedBooking.data().address, privateAddress);
  console.log("Callable booking confirmation rejected overlaps, serialized concurrent requests, and handed off the private address.");
} finally {
  await testEnvironment.cleanup();
  await deleteApp(app);
}