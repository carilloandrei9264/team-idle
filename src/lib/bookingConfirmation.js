import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import { datesOverlap, isValidDateRange } from "./booking.js";

export async function confirmBookingRequest(database, ownerId, bookingId) {
  const bookingRef = doc(database, "bookings", bookingId);
  const initialBookingSnapshot = await withPermissionStage("loading the booking request", () => getDoc(bookingRef));
  if (!initialBookingSnapshot.exists()) {
    throw new Error("This booking request no longer exists.");
  }

  const initialBooking = initialBookingSnapshot.data();
  if (initialBooking.ownerId !== ownerId) {
    throw new Error("You can only confirm requests for your listings.");
  }
  if (initialBooking.status !== "Pending") {
    throw new Error("This booking request is no longer pending.");
  }
  if (typeof initialBooking.listingId !== "string" || !initialBooking.listingId || !isValidDateRange(initialBooking.startDate, initialBooking.endDate)) {
    throw new Error("This booking request has an invalid listing or date range.");
  }

  const listingId = initialBooking.listingId;
  const listingRef = doc(database, "listings", listingId);
  const lockRef = doc(database, "bookingConfirmationLocks", listingId);
  const token = globalThis.crypto.randomUUID();
  let acquiredVersion;
  let lockExists;

  await withPermissionStage(() => lockExists === undefined
    ? "reading the listing confirmation lock"
    : `${lockExists ? "updating the existing" : "creating the new"} listing confirmation lock`, () => runTransaction(database, async (transaction) => {
    const lockSnapshot = await transaction.get(lockRef);
    lockExists = lockSnapshot.exists();
    const lock = lockSnapshot.data() || {};
    const leaseExpiry = lock.leaseExpiresAt?.toMillis?.() ?? 0;
    if (lock.locked === true && leaseExpiry > Date.now()) {
      throw new Error("Another request for this listing is being confirmed. Wait a moment and retry.");
    }

    const currentVersion = lockSnapshot.exists() ? lock.version : 0;
    if (!Number.isInteger(currentVersion) || currentVersion < 0) {
      throw new Error("The booking confirmation lock is invalid. Contact support.");
    }

    acquiredVersion = currentVersion + 1;
    transaction.set(lockRef, {
      locked: true,
      token,
      leaseExpiresAt: Timestamp.fromMillis(Date.now() + 60_000),
      version: acquiredVersion,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }));

  try {
    const [bookingSnapshot, listingSnapshot, confirmedSnapshot] = await withPermissionStage("checking the listing and existing confirmed stays", () => Promise.all([
      getDoc(bookingRef),
      getDoc(listingRef),
      getDocs(query(
        collection(database, "bookings"),
        where("listingId", "==", listingId),
        where("ownerId", "==", ownerId),
        where("status", "==", "Confirmed")
      )),
    ]));

    if (!bookingSnapshot.exists()) {
      throw new Error("This booking request no longer exists.");
    }
    const booking = bookingSnapshot.data();
    if (booking.ownerId !== ownerId || booking.status !== "Pending" || booking.listingId !== listingId
      || !isValidDateRange(booking.startDate, booking.endDate)) {
      throw new Error("This booking request changed and can no longer be confirmed.");
    }
    if (!listingSnapshot.exists()) {
      throw new Error("This listing is no longer available for booking.");
    }
    const listing = listingSnapshot.data();
    if (listing.verificationStatus !== "verified" || listing.ownerId !== ownerId || listing.listingPurpose === "sale") {
      throw new Error("This listing can no longer be booked.");
    }

    const conflicts = confirmedSnapshot.docs.some((item) => (
      item.id !== bookingId
      && datesOverlap(item.data().startDate, item.data().endDate, booking.startDate, booking.endDate)
    ));
    if (conflicts) {
      throw new Error("This request overlaps an existing confirmed stay.");
    }

    await withPermissionStage("saving the booking confirmation", () => runTransaction(database, async (transaction) => {
      const [currentBookingSnapshot, currentListingSnapshot, lockSnapshot] = await Promise.all([
        transaction.get(bookingRef),
        transaction.get(listingRef),
        transaction.get(lockRef),
      ]);
      if (!currentBookingSnapshot.exists() || !currentListingSnapshot.exists() || !lockSnapshot.exists()) {
        throw new Error("This booking request or listing is no longer available.");
      }

      const currentBooking = currentBookingSnapshot.data();
      const currentListing = currentListingSnapshot.data();
      const lock = lockSnapshot.data();
      if (currentBooking.ownerId !== ownerId || currentBooking.status !== "Pending" || currentBooking.listingId !== listingId) {
        throw new Error("This booking request changed and can no longer be confirmed.");
      }
      if (currentListing.ownerId !== ownerId || currentListing.verificationStatus !== "verified" || currentListing.listingPurpose === "sale") {
        throw new Error("This listing can no longer be booked.");
      }
      if (lock.locked !== true || lock.token !== token || lock.version !== acquiredVersion
        || (lock.leaseExpiresAt?.toMillis?.() ?? 0) <= Date.now()) {
        throw new Error("The booking confirmation lock expired. Please retry.");
      }

      transaction.update(bookingRef, {
        status: "Confirmed",
        updatedAt: serverTimestamp(),
        confirmedAt: serverTimestamp(),
      });
      transaction.update(lockRef, { locked: false, updatedAt: serverTimestamp() });
    }));
  } finally {
    await releaseBookingConfirmationLock(database, lockRef, token).catch(() => {});
  }
}

async function withPermissionStage(stage, operation) {
  try {
    return await operation();
  } catch (error) {
    if (error?.code === "permission-denied") {
      const stageLabel = typeof stage === "function" ? stage() : stage;
      throw new Error(`Permission denied while ${stageLabel}.`, { cause: error });
    }
    throw error;
  }
}

async function releaseBookingConfirmationLock(database, lockRef, token) {
  await runTransaction(database, async (transaction) => {
    const lockSnapshot = await transaction.get(lockRef);
    if (!lockSnapshot.exists()) return;
    const lock = lockSnapshot.data();
    if (lock.locked !== true || lock.token !== token) return;
    transaction.update(lockRef, { locked: false, updatedAt: serverTimestamp() });
  });
}