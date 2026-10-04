import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteField, doc, getDoc, getDocs, query, setDoc, Timestamp, updateDoc, where, writeBatch } from "firebase/firestore";

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
    });
    await setDoc(doc(db, "listings", "sale-1"), {
      ownerId: "owner-1",
      title: "Synthetic sale listing",
      verificationStatus: "verified",
      listingPurpose: "sale",
      rentalTerm: null,
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

test("owners can confirm pending bookings without changing protected fields", async () => {
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
  await assertSucceeds(updateDoc(doc(ownerDb, "bookings", "pending-confirmation-safe"), {
    status: "Confirmed",
    confirmedAt: new Date(),
    updatedAt: new Date(),
  }));
  await assertFails(updateDoc(doc(ownerDb, "bookings", "pending-confirmation-unsafe"), {
    status: "Confirmed",
    address: "Synthetic address",
    confirmedAt: new Date(),
    updatedAt: new Date(),
  }));
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

test("a pending listing can atomically notify admins for review", async () => {
  const ownerDb = testEnvironment.authenticatedContext("owner-1").firestore();
  const adminDb = testEnvironment.authenticatedContext("admin-1").firestore();
  const publicDb = testEnvironment.unauthenticatedContext().firestore();
  const batch = writeBatch(ownerDb);

  batch.set(doc(ownerDb, "listings", "listing-alert-1"), {
    ownerId: "owner-1",
    title: "Synthetic listing for alert",
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

test("renter booking creates are allowed for rentals and denied for sale listings", async () => {
  const renterDb = testEnvironment.authenticatedContext("renter-1").firestore();
  const bookingData = {
    ownerId: "owner-1",
    renterId: "renter-1",
    status: "Pending",
    startDate: Timestamp.fromDate(new Date("2026-10-10T00:00:00Z")),
    endDate: Timestamp.fromDate(new Date("2026-10-12T00:00:00Z")),
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