import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";

const projectId = "demo-trusthome-storage-rules";
let testEnvironment;

before(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8082,
      rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
    },
    storage: {
      host: "127.0.0.1",
      port: 9200,
      rules: await readFile(new URL("../storage.rules", import.meta.url), "utf8"),
    },
  });

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, "users", "owner-1"), { role: "user", status: "active" }),
      setDoc(doc(db, "users", "renter-1"), { role: "user", status: "active" }),
      setDoc(doc(db, "users", "admin-1"), { role: "admin", status: "active" }),
    ]);
  });
});

after(async () => {
  await testEnvironment?.cleanup();
});

test("verification storage permits the owner and admin but rejects other users", async () => {
  const bucketUrl = `gs://${projectId}.firebasestorage.app`;
  const ownerStorage = testEnvironment.authenticatedContext("owner-1").storage(bucketUrl);
  const renterStorage = testEnvironment.authenticatedContext("renter-1").storage(bucketUrl);
  const adminStorage = testEnvironment.authenticatedContext("admin-1").storage(bucketUrl);
  const publicStorage = testEnvironment.unauthenticatedContext().storage(bucketUrl);
  const path = "verification/owner-1/listing-1/ownership-document-proof.pdf";
  const file = new Blob(["synthetic verification document"], { type: "application/pdf" });

  await assertSucceeds(uploadBytes(ref(ownerStorage, path), file));
  assert.equal((await assertSucceeds(getBytes(ref(ownerStorage, path)))).byteLength, file.size);
  assert.equal((await assertSucceeds(getBytes(ref(adminStorage, path)))).byteLength, file.size);
  await assertFails(getBytes(ref(renterStorage, path)));
  await assertFails(getBytes(ref(publicStorage, path)));
  await assertFails(uploadBytes(ref(renterStorage, path), file));
  await assertFails(uploadBytes(
    ref(ownerStorage, "verification/owner-1/listing-1/invalid.exe"),
    new Blob(["not an accepted document"], { type: "application/x-msdownload" })
  ));
});

