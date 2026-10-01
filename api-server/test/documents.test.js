import assert from "node:assert/strict";
import test from "node:test";
import { getPrivateDocumentDownload, signPrivateDocumentUpload } from "../lib/documents.js";

function makeDb({ listing, privateListing, limit } = {}) {
  const writes = [];
  return {
    writes,
    collection(name) {
      return {
        doc(id) {
          const data = name === "listings" ? listing : name === "listingPrivate" ? privateListing : limit;
          const ref = { collection: name, id };
          return {
            ...ref,
            async get() { return { exists: Boolean(data), data: () => data }; },
          };
        },
      };
    },
    async runTransaction(callback) {
      const transaction = {
        async get() { return { exists: Boolean(limit), data: () => limit }; },
        set(_ref, data) { writes.push(data); },
      };
      return callback(transaction);
    },
  };
}

test("upload signature fixes the authenticated preset, folder, and asset context", async () => {
  let signedParams;
  const db = makeDb({ listing: { ownerId: "owner-1" } });
  const result = await signPrivateDocumentUpload({
    db,
    cloudinary: { utils: { api_sign_request: (params) => { signedParams = params; return "signed"; } } },
    uid: "owner-1",
    body: { listingId: "listing-1", kind: "ownership", resourceType: "raw" },
    apiKey: "public-api-key",
    apiSecret: "server-secret",
    cloudName: "trusthome",
    now: 1_800_000_000_000,
    createId: () => "asset-id",
  });
  assert.equal(result.signature, "signed");
  assert.equal(signedParams.type, "authenticated");
  assert.equal(signedParams.upload_preset, "trusthome_private_docs");
  assert.equal(signedParams.asset_folder, "trusthome/private/owner-1");
  assert.equal(signedParams.context, "listing=listing-1");
  assert.equal(signedParams.public_id, "trusthome_private_listing-1_ownership_asset-id");
  assert.equal(result.resourceType, "raw");
  assert.equal(result.params, signedParams);
});

test("upload signing rejects another owner's existing listing", async () => {
  await assert.rejects(signPrivateDocumentUpload({
    db: makeDb({ listing: { ownerId: "owner-2" } }),
    cloudinary: { utils: { api_sign_request: () => "unused" } },
    uid: "owner-1",
    body: { listingId: "listing-1", kind: "govId" },
    apiKey: "key",
    apiSecret: "secret",
    cloudName: "cloud",
  }), (error) => error.status === 403 && error.code === "NOT_OWNER");
});

test("upload signing rejects unknown kinds and rate-limits after twenty signatures", async () => {
  const dependencies = {
    db: makeDb({ listing: null, limit: { windowStart: 1_800_000_000_000, count: 20 } }),
    cloudinary: { utils: { api_sign_request: () => "unused" } },
    uid: "owner-1",
    apiKey: "key",
    apiSecret: "secret",
    cloudName: "cloud",
    now: 1_800_000_000_001,
  };
  await assert.rejects(signPrivateDocumentUpload({ ...dependencies, body: { listingId: "listing-1", kind: "passport" } }),
    (error) => error.status === 422 && error.code === "BAD_KIND");
  await assert.rejects(signPrivateDocumentUpload({ ...dependencies, body: { listingId: "listing-1", kind: "govId" } }),
    (error) => error.status === 429 && error.code === "SIGNATURE_RATE_LIMIT");
});

test("document links are short-lived and available only to owner or admin", async () => {
  const asset = { publicId: "trusthome_private_listing-1_govId_id", format: "jpg", resourceType: "image" };
  let downloadArgs;
  const dependencies = {
    db: makeDb({ listing: { ownerId: "owner-1" }, privateListing: { documents: { govId: asset } } }),
    cloudinary: { utils: { private_download_url: (...args) => { downloadArgs = args; return "signed-download"; } } },
    listingId: "listing-1",
    kind: "govId",
    now: 1_800_000_000_000,
    ttlSeconds: 300,
  };
  const ownerResult = await getPrivateDocumentDownload({ ...dependencies, uid: "owner-1", role: "user" });
  assert.deepEqual(ownerResult, { url: "signed-download", expiresAt: 1_800_000_300 });
  assert.equal(downloadArgs[2].type, "authenticated");
  assert.equal(downloadArgs[2].expires_at, ownerResult.expiresAt);
  await assert.rejects(getPrivateDocumentDownload({ ...dependencies, uid: "other", role: "user" }),
    (error) => error.status === 403 && error.code === "FORBIDDEN");
  assert.equal((await getPrivateDocumentDownload({ ...dependencies, uid: "reviewer", role: "admin" })).url, "signed-download");
});

test("document link endpoint rejects asset IDs outside the owner's listing scope", async () => {
  const dependencies = {
    db: makeDb({
      listing: { ownerId: "owner-1" },
      privateListing: { documents: { govId: { publicId: "trusthome_private_other-listing_govId_id", format: "jpg", resourceType: "image" } } },
    }),
    cloudinary: { utils: { private_download_url: () => "must-not-sign" } },
    uid: "owner-1",
    role: "user",
    listingId: "listing-1",
    kind: "govId",
  };
  await assert.rejects(getPrivateDocumentDownload(dependencies), (error) => error.status === 404 && error.code === "NO_DOCUMENT");
});