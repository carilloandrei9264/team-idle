import test from "node:test";
import assert from "node:assert/strict";
import { documentResourceType, uploadToCloudinary } from "./uploadImage.js";

test("ownership PDFs use raw delivery while image documents use image delivery", () => {
  assert.equal(documentResourceType({ type: "application/pdf", name: "title.pdf" }), "raw");
  assert.equal(documentResourceType({ type: "image/png", name: "title.png" }), "auto");
  assert.equal(documentResourceType({ type: "", name: "title.PDF" }), "raw");
});

test("Cloudinary uploads include their Dynamic Folder and purpose tags", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestBody;
  globalThis.fetch = async (url, options) => {
    requestUrl = url;
    requestBody = options.body;
    return new Response(JSON.stringify({ secure_url: "https://res.cloudinary.com/test/image/upload/test.png" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const file = new Blob(["test image"], { type: "image/png" });
    const url = await uploadToCloudinary(file, "image", {
      assetFolder: "trusthome/listings/demo-listing/photos",
      tags: ["trusthome", "property-photo"],
    });

    assert.equal(url, "https://res.cloudinary.com/test/image/upload/test.png");
    assert.match(requestUrl, /\/image\/upload$/);
    assert.equal(requestBody.get("upload_preset"), "trusthome_uploads");
    assert.equal(requestBody.get("asset_folder"), "trusthome/listings/demo-listing/photos");
    assert.equal(requestBody.get("tags"), "trusthome,property-photo");
  } finally {
    globalThis.fetch = originalFetch;
  }
});