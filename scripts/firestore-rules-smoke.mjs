import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteField, doc, getDoc, setDoc, Timestamp, updateDoc, writeBatch } from "firebase/firestore";

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
    await setDoc(doc(db, "users", "admin-1"), { role: "admin", status: "active" });
    await setDoc(doc(db, "listings", "verified-1"), {
      ownerId: "owner-1",
      title: "Synthetic verified listing",
      verificationStatus: "verified",
    });
  });
});

after(async () => {
  await testEnvironment?.cleanup();
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

test("owners cannot confirm bookings with a direct Firestore update", async () => {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "bookings", "pending-confirmation-1"), {
      listingId: "verified-1",
      ownerId: "owner-1",
      renterId: "renter-1",
      status: "Pending",
      startDate: Timestamp.fromDate(new Date("2026-10-10T00:00:00Z")),
      endDate: Timestamp.fromDate(new Date("2026-10-15T00:00:00Z")),
    });
  });

  const ownerDb = testEnvironment.authenticatedContext("owner-1").firestore();
  await assertFails(updateDoc(doc(ownerDb, "bookings", "pending-confirmation-1"), {
    status: "Confirmed",
    address: "Synthetic address",
    confirmedAt: new Date(),
    updatedAt: new Date(),
  }));
});