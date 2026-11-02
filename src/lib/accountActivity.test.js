import test from "node:test";
import assert from "node:assert/strict";
import {
  formatAccountActivityAction,
  describeAccountActivityEntry,
} from "./accountActivity.js";

test("account activity labels are readable and action-aware", () => {
  assert.equal(formatAccountActivityAction("listing_created"), "Listing created");
  assert.equal(formatAccountActivityAction("booking_confirmed"), "Booking confirmed");
  assert.equal(formatAccountActivityAction("profile_updated"), "Profile updated");

  assert.equal(
    describeAccountActivityEntry({
      summary: "Listing submitted for review",
      action: "listing_created",
      details: { listingId: "abc123" },
    }),
    "Listing submitted for review",
  );

  assert.equal(
    describeAccountActivityEntry({
      summary: "",
      action: "booking_confirmed",
      details: { listingId: "abc123" },
    }),
    "Booking confirmed",
  );
});
