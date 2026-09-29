import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_NOTIFICATION_TYPE,
  ADMIN_NOTIFICATION_RECIPIENT,
  isAdminInboxNotification,
  notificationInboxPath,
  notificationRecipientForRole,
  NOTIFICATION_TYPES,
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

test("admin inbox contains dispute alerts but excludes booking requests", () => {
  assert.equal(ADMIN_NOTIFICATION_TYPE, NOTIFICATION_TYPES.DISPUTE_UPDATE);
  assert.equal(isAdminInboxNotification({
    recipientId: ADMIN_NOTIFICATION_RECIPIENT,
    type: NOTIFICATION_TYPES.DISPUTE_UPDATE,
  }), true);
  assert.equal(isAdminInboxNotification({
    recipientId: ADMIN_NOTIFICATION_RECIPIENT,
    type: NOTIFICATION_TYPES.BOOKING_REQUEST,
  }), false);
});

test("notifications are sorted newest first", () => {
  const older = { id: "older", createdAt: { toMillis: () => 100 } };
  const newer = { id: "newer", createdAt: { toMillis: () => 200 } };

  assert.deepEqual(sortNotifications([older, newer]).map((item) => item.id), ["newer", "older"]);
});
