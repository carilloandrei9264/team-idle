import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export const NOTIFICATION_TYPES = {
  LISTING_REVIEW: "listing_review",
  BOOKING_UPDATE: "booking_update",
  DISPUTE_UPDATE: "dispute_update",
  BOOKING_REQUEST: "booking_request",
};

export const ADMIN_NOTIFICATION_RECIPIENT = "__admins__";
export const ADMIN_NOTIFICATION_TYPE = NOTIFICATION_TYPES.DISPUTE_UPDATE;

export function isAdminInboxNotification(notification) {
  return notification.recipientId === ADMIN_NOTIFICATION_RECIPIENT
    && notification.type === ADMIN_NOTIFICATION_TYPE;
}

export function notificationRecipientForRole(role, userId) {
  return role === "admin" ? ADMIN_NOTIFICATION_RECIPIENT : userId;
}

export function notificationInboxPath(role) {
  return role === "admin" ? "/admin/notifications" : "/notifications";
}

export async function createNotification(db, { recipientId, createdBy, type, title, message, link = null, entityId = null, entityType = null }) {
  if (!recipientId || !createdBy || !title || !message) return;
  await addDoc(collection(db, "notifications"), {
    recipientId,
    createdBy,
    type,
    title,
    message,
    link,
    entityId,
    entityType,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export function sortNotifications(notifications) {
  return [...notifications].sort((first, second) => notificationTime(second) - notificationTime(first));
}

function notificationTime(notification) {
  return notification.createdAt?.toMillis?.() || 0;
}
