import test from "node:test";
import assert from "node:assert/strict";
import { sortNotifications } from "./notifications.js";

test("notifications are sorted newest first", () => {
  const older = { id: "older", createdAt: { toMillis: () => 100 } };
  const newer = { id: "newer", createdAt: { toMillis: () => 200 } };

  assert.deepEqual(sortNotifications([older, newer]).map((item) => item.id), ["newer", "older"]);
});
