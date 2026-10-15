import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export const ACCOUNT_ACTIVITY_ACTIONS = {
  PROFILE_UPDATED: "profile_updated",
  LISTING_CREATED: "listing_created",
  BOOKING_REQUESTED: "booking_requested",
  BOOKING_CONFIRMED: "booking_confirmed",
  BOOKING_COMPLETED: "booking_completed",
  PAYMENT_REFERENCE_SUBMITTED: "payment_reference_submitted",
  PAYMENT_RECEIVED: "payment_received",
  COMPLETION_REVIEWED: "completion_reviewed",
  DISPUTE_RAISED: "dispute_raised",
  DISPUTE_RESOLVED: "dispute_resolved",
  LISTING_APPROVED: "listing_approved",
  LISTING_CHANGES_REQUESTED: "listing_changes_requested",
  LISTING_REJECTED: "listing_rejected",
  LISTING_UPDATED: "listing_updated",
  BOOKING_DECLINED: "booking_declined",
  BOOKING_CANCELLED: "booking_cancelled",
  USER_SUSPENDED: "user_suspended",
  USER_REACTIVATED: "user_reactivated",
};

export function formatAccountActivityAction(action = "") {
  const normalized = String(action).trim();
  if (!normalized) return "Account activity";

  const labels = {
    profile_updated: "Profile updated",
    listing_created: "Listing created",
    booking_requested: "Booking requested",
    booking_confirmed: "Booking confirmed",
    booking_completed: "Booking completed",
    payment_reference_submitted: "Payment reference submitted",
    payment_received: "Payment received",
    completion_reviewed: "Completion reviewed",
    dispute_raised: "Dispute raised",
    dispute_resolved: "Dispute resolved",
    listing_approved: "Listing approved",
    listing_changes_requested: "Listing changes requested",
    listing_rejected: "Listing rejected",
    listing_updated: "Listing updated",
    booking_declined: "Booking declined",
    booking_cancelled: "Booking cancelled",
    user_suspended: "User suspended",
    user_reactivated: "User reactivated",
  };

  return labels[normalized] || normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function describeAccountActivityEntry(entry = {}) {
  if (typeof entry.summary === "string" && entry.summary.trim()) {
    return entry.summary.trim();
  }

  return formatAccountActivityAction(entry.action);
}

export async function createAccountActivity(db, {
  actorId,
  actorRole = "user",
  targetUserId = null,
  entityType,
  entityId,
  action,
  summary,
  details = {},
}) {
  if (!actorId || !entityType || !entityId || !action || !summary) return null;

  const activity = {
    actorId,
    actorRole,
    ...(targetUserId ? { targetUserId } : {}),
    entityType,
    entityId,
    action,
    summary,
    details: details && typeof details === "object" && !Array.isArray(details) ? details : {},
    createdAt: serverTimestamp(),
  };

  return addDoc(collection(db, "accountActivity"), activity);
}
