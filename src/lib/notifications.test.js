import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_NOTIFICATION_RECIPIENT,
  notificationInboxPath,
  notificationRecipientForRole,
  sortNotifications,
} from "./notifications.js";

test("admin notification routing never uses the personal user feed", () => {
  assert.equal(notificationRecipientForRole("admin", "admin-user-1"), ADMIN_NOTIFICATION_RECIPIENT);
  assert.equal(notificationInboxPath("admin"), "/admin/notifications");
});

test("regular users are routed only to their own notification feed", () => {
  assert.equal(notificationRecipientForRole("user", "user-1"), "user-1");
  assert.equal(notificationInboxPath("user"), "/notifications");
});

test("notifications are sorted newest first", () => {
  const older = { id: "older", createdAt: { toMillis: () => 100 } };
  const newer = { id: "newer", createdAt: { toMillis: () => 200 } };

  assert.deepEqual(sortNotifications([older, newer]).map((item) => item.id), ["newer", "older"]);
});
