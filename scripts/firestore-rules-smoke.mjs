import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { confirmBookingRequest } from "../src/lib/bookingConfirmation.js";

let testEnvironment;

before(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId: "demo-trusthome-private-documents",
    firestore: {
      rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
    },
  });

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "owner-1"), { role: "user", status: "active" });
    await setDoc(doc(db, "users", "renter-1"), { role: "user", status: "active" });
    await setDoc(doc(db, "users", "admin-1"), { role: "admin", status: "active" });
    await setDoc(doc(db, "listings", "verified-1"), {
      ownerId: "owner-1",
      title: "Synthetic verified listing",
      verificationStatus: "verified",
      listingPurpose: "rent",
      rentalTerm: "long_term",
      price: 12000,
      pricePeriod: "month",
    });
    await setDoc(doc(db, "listings", "sale-1"), {
      ownerId: "owner-1",
      title: "Synthetic sale listing",
      verificationStatus: "verified",
      listingPurpose: "sale",
      rentalTerm: null,
      price: 1000000,
      pricePeriod: "total",
    });
  });
});

after(async () => {
  await testEnvironment?.cleanup();
});

test("owners can repair missing active user metadata required for listing writes", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "users", "legacy-owner-1"), {
      name: "Legacy owner",
      email: "legacy-owner@example.com",
    });
  });

  const legacyOwnerDb = testEnvironment.authenticatedContext("legacy-owner-1").firestore();
  await assertSucceeds(updateDoc(doc(legacyOwnerDb, "users", "legacy-owner-1"), {
    role: "user",
    status: "active",
  }));

  const profile = await assertSucceeds(getDoc(doc(legacyOwnerDb, "users", "legacy-owner-1")));
  assert.equal(profile.data().role, "user");
  assert.equal(profile.data().status, "active");
});

test("verification URLs stay private while verified listing details remain public", async () => {
  const ownerDb = testEnvironment.authenticatedContext("owner-1").firestore();
  const adminDb = testEnvironment.authenticatedContext("admin-1").firestore();
  const publicDb = testEnvironment.unauthenticatedContext().firestore();
  const batch = writeBatch(ownerDb);

  batch.set(doc(ownerDb, "listings", "new-1"), {
    ownerId: "owner-1",
    title: "Synthetic pending listing",
    description: "A complete synthetic listing used for rules verification.",
    city: "Manila",
    price: 12000,
    bedrooms: 1,
    bathrooms: 1,
    photoUrls: ["photo-1", "photo-2", "photo-3", "photo-4"],
    verificationStatus: "pending",
    listingPurpose: "rent",
    rentalTerm: "long_term",
    mapLocation: null,
  });
  batch.set(doc(ownerDb, "listingPrivate", "new-1"), {
    ownerId: "owner-1",
    address: "Synthetic address",
    ownershipDocumentUrl: "https://example.test/ownership.png",
    governmentIdUrl: "https://example.test/id.png",
    updatedAt: new Date(),
  });

  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(doc(ownerDb, "listingPrivate", "new-1")));
  await assertSucceeds(getDoc(doc(adminDb, "listingPrivate", "new-1")));
  await assertFails(getDoc(doc(publicDb, "listingPrivate", "new-1")));

  const publicListing = await assertSucceeds(getDoc(doc(publicDb, "listings", "verified-1")));
  assert.equal(publicListing.data().ownershipDocumentUrl, undefined);
  assert.equal(publicListing.data().governmentIdUrl, undefined);
  assert.equal(publicListing.data().verificationDocUrl, undefined);
});

test("owners can set supported optional condition and furnishing details", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "listings", "details-listing"), {
      ownerId: "owner-1",
      title: "Synthetic details listing",
      description: "A complete synthetic listing used for rules verification.",
      city: "Manila",
      price: 12000,
      bedrooms: 1,
      bathrooms: 1,
      photoUrls: ["photo-1", "photo-2", "photo-3", "photo-4"],
      verificationStatus: "pending",
      listingPurpose: "rent",
      rentalTerm: "long_term",
      mapLocation: null,
    });
  });

  const ownerDb = testEnvironment.authenticatedContext("owner-1").firestore();
  const listingRef = doc(ownerDb, "listings", "details-listing");
  await assertSucceeds(updateDoc(listingRef, {
    propertyCondition: "good",
    furnishingStatus: "partially_furnished",
  }));
  await assertFails(updateDoc(listingRef, { propertyCondition: "unknown" }));
  await assertFails(updateDoc(listingRef, { furnishingStatus: "unknown" }));
});

test("owners cannot create or add verification URLs on public listings", async () => {
  const ownerDb = testEnvironment.authenticatedContext("owner-1").firestore();

  await assertFails(setDoc(doc(ownerDb, "listings", "public-url-create"), {
    ownerId: "owner-1",
    title: "Synthetic listing",
    verificationStatus: "pending",
    ownershipDocumentUrl: "https://example.test/ownership.png",
  }));

  await assertFails(updateDoc(doc(ownerDb, "listings", "new-1"), {
    ownershipDocumentUrl: "https://example.test/ownership.png",
  }));
});

test("owners can remove legacy public verification URL fields", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "listings", "legacy-owner-1"), {
      ownerId: "owner-1",
      title: "Legacy pending listing",
      description: "A complete synthetic listing used for rules verification.",
      city: "Manila",
      price: 12000,
      bedrooms: 1,
      bathrooms: 1,
      photoUrls: ["photo-1", "photo-2", "photo-3", "photo-4"],
      verificationStatus: "pending",
      ownershipDocumentUrl: "https://example.test/ownership.png",
      governmentIdUrl: "https://example.test/id.png",
    });
  });

  const ownerDb = testEnvironment.authenticatedContext("owner-1").firestore();
  await assertSucceeds(updateDoc(doc(ownerDb, "listings", "legacy-owner-1"), {
    ownershipDocumentUrl: deleteField(),
    governmentIdUrl: deleteField(),
  }));
});

test("admins can move legacy verification URLs to listingPrivate atomically", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "listings", "legacy-admin-1"), {
      ownerId: "owner-1",
      title: "Legacy listing for review",
      verificationStatus: "pending",
      ownershipDocumentUrl: "https://example.test/ownership.png",
      governmentIdUrl: "https://example.test/id.png",
    });
  });

  const adminDb = testEnvironment.authenticatedContext("admin-1").firestore();
  const batch = writeBatch(adminDb);
  batch.update(doc(adminDb, "listings", "legacy-admin-1"), {
    ownershipDocumentUrl: deleteField(),
    governmentIdUrl: deleteField(),
    verificationDocUrl: deleteField(),
  });
  batch.set(doc(adminDb, "listingPrivate", "legacy-admin-1"), {
    ownerId: "owner-1",
    ownershipDocumentUrl: "https://example.test/ownership.png",
    governmentIdUrl: "https://example.test/id.png",
    updatedAt: new Date(),
  }, { merge: true });

  await assertSucceeds(batch.commit());
  const privateRecord = await assertSucceeds(getDoc(doc(adminDb, "listingPrivate", "legacy-admin-1")));
  assert.equal(privateRecord.data().ownershipDocumentUrl, "https://example.test/ownership.png");
  assert.equal(privateRecord.data().governmentIdUrl, "https://example.test/id.png");
});

test("owners must advance the listing lock in the same transaction to confirm", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    for (const bookingId of ["pending-confirmation-safe", "pending-confirmation-unsafe"]) {
      await setDoc(doc(context.firestore(), "bookings", bookingId), {
        listingId: "verified-1",
        ownerId: "owner-1",
        renterId: "renter-1",
        status: "Pending",
        startDate: Timestamp.fromDate(new Date("2026-10-10T00:00:00Z")),
        endDate: Timestamp.fromDate(new Date("2026-10-15T00:00:00Z")),
      });
    }
  });

  const ownerDb = testEnvironment.authenticatedContext("owner-1").firestore();
  await assertFails(updateDoc(doc(ownerDb, "bookings", "pending-confirmation-unsafe"), {
    status: "Confirmed", confirmedAt: new Date(), updatedAt: new Date(),
  }));
});

test("concurrent overlapping confirmations allow only one request to win", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "listings", "race-listing"), {
      ownerId: "owner-1",
      verificationStatus: "verified",
      listingPurpose: "rent",
    });
    await setDoc(doc(db, "listingPrivate", "race-listing"), {
      ownerId: "owner-1",
      address: "Race listing private address",
    });
    for (const bookingId of ["race-request-a", "race-request-b"]) {
      await setDoc(doc(db, "bookings", bookingId), {
        listingId: "race-listing",
        ownerId: "owner-1",
        renterId: `renter-${bookingId}`,
        status: "Pending",
        startDate: Timestamp.fromDate(new Date("2026-10-20T00:00:00Z")),
        endDate: Timestamp.fromDate(new Date("2026-10-25T00:00:00Z")),
      });
    }
  });

  const ownerDb = testEnvironment.authenticatedContext("owner-1").firestore();
  const results = await Promise.allSettled([
    confirmBookingRequest(ownerDb, "owner-1", "race-request-a"),
    confirmBookingRequest(ownerDb, "owner-1", "race-request-b"),
  ]);

  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
    results.map((result) => result.status === "rejected" ? result.reason.message : "confirmed").join(" | ")
  );
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);

  const confirmed = await assertSucceeds(getDocs(query(
    collection(ownerDb, "bookings"),
    where("listingId", "==", "race-listing"),
    where("ownerId", "==", "owner-1"),
    where("status", "==", "Confirmed")
  )));
  assert.equal(confirmed.size, 1);

  const publicDb = testEnvironment.unauthenticatedContext().firestore();
  const availabilityRef = doc(publicDb, "listingAvailability", "race-listing");
  const availability = await assertSucceeds(getDoc(availabilityRef));
  assert.equal(availability.data().blocked.length, 1);
  assert.deepEqual(Object.keys(availability.data().blocked[0]).sort(), ["end", "start"]);
  await assertFails(updateDoc(doc(ownerDb, "listingAvailability", "race-listing"), {
    blocked: [{ start: Timestamp.fromDate(new Date("2026-12-01T00:00:00Z")), end: Timestamp.fromDate(new Date("2026-12-02T00:00:00Z")) }],
    updatedAt: serverTimestamp(),
  }));
});

test("owners can reuse a released confirmation lock for another request", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "listings", "reusable-lock-listing"), {
      ownerId: "owner-1",
      verificationStatus: "verified",
      listingPurpose: "rent",
    });
    await setDoc(doc(db, "listingPrivate", "reusable-lock-listing"), {
      ownerId: "owner-1",
      address: "Reusable listing private address",
    });
    for (const [bookingId, start, end] of [
      ["reusable-lock-request-a", "2026-11-01T00:00:00Z", "2026-11-02T00:00:00Z"],
      ["reusable-lock-request-b", "2026-11-03T00:00:00Z", "2026-11-04T00:00:00Z"],
    ]) {
      await setDoc(doc(db, "bookings", bookingId), {
        listingId: "reusable-lock-listing",
        ownerId: "owner-1",
        renterId: `renter-${bookingId}`,
        status: "Pending",
        startDate: Timestamp.fromDate(new Date(start)),
        endDate: Timestamp.fromDate(new Date(end)),
      });
    }
  });

  const ownerDb = testEnvironment.authenticatedContext("owner-1").firestore();
  await confirmBookingRequest(ownerDb, "owner-1", "reusable-lock-request-a");
  await confirmBookingRequest(ownerDb, "owner-1", "reusable-lock-request-b");

  const firstBooking = await assertSucceeds(getDoc(doc(ownerDb, "bookings", "reusable-lock-request-a")));
  const secondBooking = await assertSucceeds(getDoc(doc(ownerDb, "bookings", "reusable-lock-request-b")));
  assert.equal(firstBooking.data().status, "Confirmed");
  assert.equal(secondBooking.data().status, "Confirmed");
});

test("owner confirmations tolerate a small client clock offset when creating a lock", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "listings", "clock-offset-listing"), {
      ownerId: "owner-1",
      verificationStatus: "verified",
      listingPurpose: "rent",
    });
    await setDoc(doc(db, "listingPrivate", "clock-offset-listing"), {
      ownerId: "owner-1",
      address: "Clock offset listing private address",
    });
    await setDoc(doc(db, "bookings", "clock-offset-request"), {
      listingId: "clock-offset-listing",
      ownerId: "owner-1",
      renterId: "renter-clock-offset",
      status: "Pending",
      startDate: Timestamp.fromDate(new Date("2026-11-10T00:00:00Z")),
      endDate: Timestamp.fromDate(new Date("2026-11-11T00:00:00Z")),
    });
  });

  const ownerDb = testEnvironment.authenticatedContext("owner-1").firestore();
  const originalDateNow = Date.now;
  Date.now = () => originalDateNow() + 30_000;
  try {
    await confirmBookingRequest(ownerDb, "owner-1", "clock-offset-request");
  } finally {
    Date.now = originalDateNow;
  }

  const booking = await assertSucceeds(getDoc(doc(ownerDb, "bookings", "clock-offset-request")));
  assert.equal(booking.data().status, "Confirmed");
});

test("owners can query confirmed bookings when the query is scoped to their bookings", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "bookings", "confirmed-owner-booking"), {
      listingId: "query-test-listing",
      ownerId: "owner-1",
      renterId: "renter-1",
      status: "Confirmed",
    });
    await setDoc(doc(db, "bookings", "confirmed-other-owner-booking"), {
      listingId: "query-test-listing",
      ownerId: "owner-2",
      renterId: "renter-2",
      status: "Confirmed",
    });
  });

  const ownerDb = testEnvironment.authenticatedContext("owner-1").firestore();
  const scopedQuery = query(
    collection(ownerDb, "bookings"),
    where("listingId", "==", "query-test-listing"),
    where("ownerId", "==", "owner-1"),
    where("status", "==", "Confirmed")
  );
  const snapshot = await assertSucceeds(getDocs(scopedQuery));
  assert.equal(snapshot.size, 1);

  const unscopedQuery = query(
    collection(ownerDb, "bookings"),
    where("listingId", "==", "query-test-listing"),
    where("status", "==", "Confirmed")
  );
  await assertFails(getDocs(unscopedQuery));
});

test("renters can query their own requests for a listing to detect duplicate stays", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "bookings", "renter-duplicate-query-own"), {
      listingId: "verified-1",
      ownerId: "owner-1",
      renterId: "renter-1",
      status: "Pending",
    });
    await setDoc(doc(db, "bookings", "renter-duplicate-query-other"), {
      listingId: "verified-1",
      ownerId: "owner-1",
      renterId: "renter-2",
      status: "Pending",
    });
  });

  const renterDb = testEnvironment.authenticatedContext("renter-1").firestore();
  const ownListingRequests = await assertSucceeds(getDocs(query(
    collection(renterDb, "bookings"),
    where("renterId", "==", "renter-1"),
    where("listingId", "==", "verified-1")
  )));
  const returnedIds = ownListingRequests.docs.map((item) => item.id);
  assert.equal(returnedIds.includes("renter-duplicate-query-own"), true);
  assert.equal(returnedIds.includes("renter-duplicate-query-other"), false);
});

test("renters can mark confirmed bookings complete only after checkout", async () => {
  const now = Date.now();
  const futureEnd = Timestamp.fromDate(new Date(now + 60 * 60 * 1000));
  const pastEnd = Timestamp.fromDate(new Date(now - 60 * 60 * 1000));
  const legacyEndBeforeGrace = Timestamp.fromDate(new Date(now - 60 * 60 * 1000));
  const legacyEndAfterGrace = Timestamp.fromDate(new Date(now - 25 * 60 * 60 * 1000));
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [bookingId, endDate, bookingTimeZone] of [
      ["complete-too-early", futureEnd, "Asia/Manila"],
      ["complete-after-checkout", pastEnd, "Asia/Manila"],
      ["complete-legacy-too-early", legacyEndBeforeGrace, null],
      ["complete-legacy-after-grace", legacyEndAfterGrace, null],
    ]) {
      await setDoc(doc(db, "bookings", bookingId), {
        listingId: "verified-1",
        ownerId: "owner-1",
        renterId: "renter-1",
        status: "Confirmed",
        startDate: Timestamp.fromDate(new Date(now - 48 * 60 * 60 * 1000)),
        endDate,
        ...(bookingTimeZone ? { bookingTimeZone } : {}),
      });
    }
  });

  const renterDb = testEnvironment.authenticatedContext("renter-1").firestore();
  const complete = (bookingId) => updateDoc(doc(renterDb, "bookings", bookingId), {
    status: "Completed",
    completedAt: new Date(),
    updatedAt: new Date(),
    completionRequestedAt: new Date(),
    completionRequestedBy: "renter",
    ownerConfirmedCompletion: false,
  });

  await assertFails(complete("complete-too-early"));
  await assertSucceeds(complete("complete-after-checkout"));
  await assertFails(complete("complete-legacy-too-early"));
  await assertSucceeds(complete("complete-legacy-after-grace"));
});

test("owners can confirm a renter-reported completion once", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "bookings", "owner-confirm-completion"), {
      listingId: "verified-1",
      ownerId: "owner-1",
      renterId: "renter-1",
      status: "Completed",
      ownerConfirmedCompletion: false,
    });
  });

  const ownerDb = testEnvironment.authenticatedContext("owner-1").firestore();
  const bookingRef = doc(ownerDb, "bookings", "owner-confirm-completion");
  await assertSucceeds(updateDoc(bookingRef, {
    ownerConfirmedCompletion: true,
    completionConfirmedAt: new Date(),
    updatedAt: new Date(),
  }));
  await assertFails(updateDoc(bookingRef, {
    ownerConfirmedCompletion: true,
    completionConfirmedAt: new Date(),
    updatedAt: new Date(),
  }));
});

test("a pending listing can atomically notify admins for review", async () => {
  const ownerDb = testEnvironment.authenticatedContext("owner-1").firestore();
  const adminDb = testEnvironment.authenticatedContext("admin-1").firestore();
  const publicDb = testEnvironment.unauthenticatedContext().firestore();
  const batch = writeBatch(ownerDb);

  batch.set(doc(ownerDb, "listings", "listing-alert-1"), {
    ownerId: "owner-1",
    title: "Synthetic listing for alert",
    description: "A complete synthetic listing used for rules verification.",
    city: "Manila",
    price: 12000,
    bedrooms: 1,
    bathrooms: 1,
    photoUrls: ["photo-1", "photo-2", "photo-3", "photo-4"],
    verificationStatus: "pending",
    listingPurpose: "rent",
    rentalTerm: "long_term",
    mapLocation: null,
  });
  batch.set(doc(ownerDb, "listingPrivate", "listing-alert-1"), {
    ownerId: "owner-1",
    address: "Synthetic address",
    updatedAt: new Date(),
  });
  batch.set(doc(ownerDb, "notifications", "listing-alert-1"), {
    recipientId: "__admins__",
    createdBy: "owner-1",
    type: "listing_submitted",
    title: "New listing submitted for review",
    message: "Synthetic listing for alert was submitted.",
    link: "/admin/listings?listingId=listing-alert-1",
    entityId: "listing-alert-1",
    entityType: "listing",
    read: false,
    createdAt: new Date(),
  });

  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(doc(adminDb, "notifications", "listing-alert-1")));
  await assertFails(getDoc(doc(publicDb, "notifications", "listing-alert-1")));
  await assertFails(setDoc(doc(ownerDb, "notifications", "orphan-listing-alert"), {
    recipientId: "__admins__",
    createdBy: "owner-1",
    type: "listing_submitted",
    title: "Orphan alert",
    message: "No matching pending listing.",
    entityId: "missing-listing",
    entityType: "listing",
    read: false,
  }));
});

test("users can create append-only activity entries for their own account actions", async () => {
  const renterDb = testEnvironment.authenticatedContext("renter-1").firestore();
  const adminDb = testEnvironment.authenticatedContext("admin-1").firestore();
  const activityId = "activity-renter-self-1";

  await assertSucceeds(setDoc(doc(renterDb, "accountActivity", activityId), {
    actorId: "renter-1",
    actorRole: "user",
    targetUserId: "renter-1",
    entityType: "account",
    entityId: "renter-1",
    action: "profile_updated",
    summary: "Profile was updated.",
    details: { updatedField: "displayName" },
    createdAt: serverTimestamp(),
  }));

  await assertSucceeds(getDoc(doc(renterDb, "accountActivity", activityId)));
  await assertSucceeds(getDoc(doc(adminDb, "accountActivity", activityId)));
  await assertFails(updateDoc(doc(renterDb, "accountActivity", activityId), {
    summary: "Unauthorized edit",
  }));
  await assertFails(deleteDoc(doc(renterDb, "accountActivity", activityId)));

  await assertFails(setDoc(doc(renterDb, "accountActivity", "activity-renter-other-1"), {
    actorId: "renter-2",
    actorRole: "user",
    targetUserId: "renter-1",
    entityType: "account",
    entityId: "renter-1",
    action: "profile_updated",
    summary: "Other user attempted to log this action.",
    details: {},
    createdAt: serverTimestamp(),
  }));
});

test("renter booking creates are allowed for rentals and denied for sale listings", async () => {
  const renterDb = testEnvironment.authenticatedContext("renter-1").firestore();
  const startDate = Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const endDate = Timestamp.fromDate(new Date(Date.now() + 48 * 60 * 60 * 1000));
  const bookingData = {
    listingTitle: "Synthetic verified listing",
    listingPhotoUrl: null,
    ownerId: "owner-1",
    ownerName: "Property owner",
    renterId: "renter-1",
    renterName: "TrustHome member",
    listingPurpose: "rent",
    rentalTerm: "long_term",
    status: "Pending",
    startDate,
    endDate,
    bookingTimeZone: "Asia/Manila",
    price: 12000,
    pricePeriod: "month",
    bookingReference: "BK-RENT01",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await assertSucceeds(setDoc(doc(renterDb, "bookings", "rent-booking-1"), {
    ...bookingData,
    listingId: "verified-1",
  }));
  await assertFails(setDoc(doc(renterDb, "bookings", "sale-booking-1"), {
    ...bookingData,
    listingId: "sale-1",
  }));
});

test("renter cannot change a booking reference after creation", async () => {
  const renterDb = testEnvironment.authenticatedContext("renter-1").firestore();
  const bookingRef = doc(renterDb, "bookings", "pending-booking-ref");

  await assertSucceeds(setDoc(bookingRef, {
    listingId: "verified-1",
    listingTitle: "Synthetic verified listing",
    listingPhotoUrl: null,
    ownerId: "owner-1",
    ownerName: "Property owner",
    renterId: "renter-1",
    renterName: "TrustHome member",
    listingPurpose: "rent",
    rentalTerm: "long_term",
    status: "Pending",
    startDate: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    endDate: Timestamp.fromDate(new Date(Date.now() + 48 * 60 * 60 * 1000)),
    bookingTimeZone: "Asia/Manila",
    price: 12000,
    pricePeriod: "month",
    bookingReference: "TH-INV-001",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));

  await assertFails(updateDoc(bookingRef, {
    bookingReference: "TH-INV-002",
    updatedAt: serverTimestamp(),
  }));
});

test("owners can decline pending bookings without deleting their history", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "bookings", "pending-decline"), {
      listingId: "verified-1",
      ownerId: "owner-1",
      renterId: "renter-1",
      status: "Pending",
    });
  });

  const ownerDb = testEnvironment.authenticatedContext("owner-1").firestore();
  const renterDb = testEnvironment.authenticatedContext("renter-1").firestore();
  const bookingRef = doc(ownerDb, "bookings", "pending-decline");
  const decline = {
    status: "Declined",
    declinedAt: new Date(),
    updatedAt: new Date(),
  };

  await assertFails(updateDoc(doc(renterDb, "bookings", "pending-decline"), decline));
  await assertSucceeds(updateDoc(bookingRef, decline));
  assert.equal((await assertSucceeds(getDoc(bookingRef))).data().status, "Declined");
});

test("renters can cancel their own pending bookings once", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "bookings", "pending-cancel"), {
      listingId: "verified-1",
      ownerId: "owner-1",
      renterId: "renter-1",
      status: "Pending",
    });
  });

  const renterDb = testEnvironment.authenticatedContext("renter-1").firestore();
  const bookingRef = doc(renterDb, "bookings", "pending-cancel");
  const cancel = {
    status: "Cancelled",
    cancelledAt: new Date(),
    updatedAt: new Date(),
  };

  await assertSucceeds(updateDoc(bookingRef, cancel));
  await assertFails(updateDoc(bookingRef, cancel));
});

test("renter can submit a payment reference without marking payment received", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "bookings", "confirmed-payment-reference"), {
      listingId: "verified-1",
      ownerId: "owner-1",
      renterId: "renter-1",
      status: "Confirmed",
      paymentStatus: "awaiting_payment",
      startDate: Timestamp.fromDate(new Date("2026-10-14T00:00:00Z")),
      endDate: Timestamp.fromDate(new Date("2026-10-16T00:00:00Z")),
    });
  });

  const renterDb = testEnvironment.authenticatedContext("renter-1").firestore();
  const bookingRef = doc(renterDb, "bookings", "confirmed-payment-reference");
  await assertSucceeds(updateDoc(bookingRef, {
    depositReference: "1234567890",
    paymentStatus: "reference_submitted",
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(bookingRef, {
    paymentStatus: "payment_received",
    updatedAt: serverTimestamp(),
  }));
});

test("owner can mark a submitted payment reference as received", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "bookings", "owner-payment-reference"), {
      listingId: "verified-1",
      ownerId: "owner-1",
      renterId: "renter-1",
      status: "Confirmed",
      depositReference: "1234567890",
      paymentStatus: "reference_submitted",
    });
    await setDoc(doc(db, "bookings", "owner-payment-without-reference"), {
      listingId: "verified-1",
      ownerId: "owner-1",
      renterId: "renter-1",
      status: "Confirmed",
      paymentStatus: "awaiting_payment",
    });
  });

  const ownerDb = testEnvironment.authenticatedContext("owner-1").firestore();
  await assertSucceeds(updateDoc(doc(ownerDb, "bookings", "owner-payment-reference"), {
    paymentStatus: "payment_received",
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(ownerDb, "bookings", "owner-payment-without-reference"), {
    paymentStatus: "payment_received",
    updatedAt: serverTimestamp(),
  }));
});

test("dispute submissions accept at most five evidence URLs", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const bookingId of ["dispute-evidence-5", "dispute-evidence-6"]) {
      await setDoc(doc(db, "bookings", bookingId), {
        listingId: "verified-1",
        ownerId: "owner-1",
        renterId: "renter-1",
        status: "Confirmed",
      });
    }
  });

  const renterDb = testEnvironment.authenticatedContext("renter-1").firestore();
  async function submitDispute(disputeId, evidenceCount) {
    const bookingId = `dispute-evidence-${evidenceCount}`;
    const batch = writeBatch(renterDb);
    batch.set(doc(renterDb, "disputes", disputeId), {
      bookingId,
      ownerId: "owner-1",
      raisedBy: "renter-1",
      reason: "Synthetic dispute with evidence photos.",
      status: "Open",
      evidenceUrls: Array.from({ length: evidenceCount }, (_, index) => (
        `https://res.cloudinary.com/v6pkogdi/image/upload/photo-${index}.jpg`
      )),
    });
    batch.update(doc(renterDb, "bookings", bookingId), {
      status: "Disputed",
      disputedAt: serverTimestamp(),
      disputeId,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  }

  await assertSucceeds(submitDispute("dispute-evidence-five-id", 5));
  await assertFails(submitDispute("dispute-evidence-six-id", 6));
});

test("reviews match the completed booking and never publish reviewer email", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const bookingId of ["rating-valid-booking", "rating-wrong-listing", "rating-email-name"]) {
      await setDoc(doc(db, "bookings", bookingId), {
        listingId: "verified-1",
        ownerId: "owner-1",
        renterId: "renter-1",
        status: "Completed",
      });
    }
  });

  const renterDb = testEnvironment.authenticatedContext("renter-1").firestore();
  const validRating = {
    bookingId: "rating-valid-booking",
    listingId: "verified-1",
    ownerId: "owner-1",
    renterId: "renter-1",
    reviewerId: "renter-1",
    reviewerName: "TrustHome member",
    score: 5,
    comment: "A helpful and comfortable stay.",
    createdAt: serverTimestamp(),
  };
  await assertSucceeds(setDoc(doc(renterDb, "ratings", "rating-valid-booking_renter-1"), validRating));
  await assertFails(setDoc(doc(renterDb, "ratings", "rating-wrong-listing_renter-1"), {
    ...validRating,
    bookingId: "rating-wrong-listing",
    listingId: "another-listing",
  }));
  await assertFails(setDoc(doc(renterDb, "ratings", "rating-email-name_renter-1"), {
    ...validRating,
    bookingId: "rating-email-name",
    reviewerName: "renter@example.com",
  }));
});

test("public profiles only expose the owner's verified contact fields", async () => {
  const renterDb = testEnvironment.authenticatedContext("renter-1", { email: "renter@example.com" }).firestore();
  const profileRef = doc(renterDb, "publicProfiles", "renter-1");
  await assertSucceeds(setDoc(profileRef, {
    userId: "renter-1",
    name: "Renter",
    contactEmail: "renter@example.com",
    contactPhone: "+639123456789",
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(profileRef, { contactEmail: "other@example.com" }));
  await assertFails(updateDoc(profileRef, { contactPhone: "12345" }));
  await assertFails(updateDoc(profileRef, { privateNote: "not public" }));
});

test("activity entries cannot target unrelated users", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "bookings", "activity-party-booking"), {
      ownerId: "owner-1",
      renterId: "renter-1",
      status: "Confirmed",
    });
  });

  const renterDb = testEnvironment.authenticatedContext("renter-1").firestore();
  const activity = {
    actorId: "renter-1",
    actorRole: "user",
    entityType: "booking",
    entityId: "activity-party-booking",
    action: "booking_requested",
    summary: "Booking request submitted",
    details: {},
    createdAt: serverTimestamp(),
  };
  await assertSucceeds(setDoc(doc(renterDb, "accountActivity", "activity-booking-party"), {
    ...activity,
    targetUserId: "owner-1",
  }));
  await assertFails(setDoc(doc(renterDb, "accountActivity", "activity-unrelated-target"), {
    ...activity,
    entityType: "account",
    entityId: "renter-2",
    targetUserId: "renter-2",
  }));
});

test("admins must provide meaningful dispute resolution notes", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "disputes", "resolution-notes-required"), {
      bookingId: "completed-dispute-booking",
      ownerId: "owner-1",
      raisedBy: "renter-1",
      status: "Open",
    });
  });

  const adminDb = testEnvironment.authenticatedContext("admin-1").firestore();
  const disputeRef = doc(adminDb, "disputes", "resolution-notes-required");
  const decision = { status: "Dismissed", resolvedAt: serverTimestamp(), resolvedBy: "admin-1" };
  await assertFails(updateDoc(disputeRef, { ...decision, resolutionNotes: "No" }));
  await assertSucceeds(updateDoc(disputeRef, { ...decision, resolutionNotes: "Reviewed the supporting details." }));
});

test("admins cannot suspend their own account", async () => {
  const adminDb = testEnvironment.authenticatedContext("admin-1").firestore();
  await assertFails(updateDoc(doc(adminDb, "users", "admin-1"), { status: "suspended" }));
});