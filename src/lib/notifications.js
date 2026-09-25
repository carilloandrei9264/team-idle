import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export const NOTIFICATION_TYPES = {
  LISTING_REVIEW: "listing_review",
  BOOKING_UPDATE: "booking_update",
  DISPUTE_UPDATE: "dispute_update",
  BOOKING_REQUEST: "booking_request",
};

export const ADMIN_NOTIFICATION_RECIPIENT = "__admins__";

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
