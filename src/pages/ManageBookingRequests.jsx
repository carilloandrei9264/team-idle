import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, query, runTransaction, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { Check } from "lucide-react";
import PublicNav from "../components/PublicNav";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { datesOverlap, toDate } from "../lib/booking";
import { createNotification, NOTIFICATION_TYPES } from "../lib/notifications";
import "./UserPages.css";

export default function ManageBookingRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => onSnapshot(
    query(collection(db, "bookings"), where("ownerId", "==", user.uid)),
    (snapshot) => {
      const docs = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      setAllBookings(docs);
      setRequests(docs.filter((item) => ["Pending", "Confirmed"].includes(item.status)));
      setLoading(false);
    },
    () => {
      setError("Booking requests could not be loaded.");
      setLoading(false);
    }
  ), [user.uid]);

  const bookingsByListing = useMemo(() => {
    const map = {};
    allBookings.forEach((booking) => {
      map[booking.listingId] ??= [];
      map[booking.listingId].push(booking);
    });
    return map;
  }, [allBookings]);

  async function updateRequest(request, status) {
    setError("");
    setMessage("");
    try {
      if (status === "Confirmed") {
        await runTransaction(db, async (transaction) => {
          const bookingRef = doc(db, "bookings", request.id);
          const bookingSnapshot = await transaction.get(bookingRef);
          if (!bookingSnapshot.exists()) {
            throw new Error("This booking request no longer exists.");
          }

          const booking = bookingSnapshot.data();
          if (booking.ownerId !== user.uid) {
            throw new Error("You can only confirm your own bookings.");
          }
          if (booking.status !== "Pending") {
            throw new Error("This booking request is no longer pending.");
          }

          const listingRef = doc(db, "listings", booking.listingId);
          const listingSnapshot = await transaction.get(listingRef);
          if (!listingSnapshot.exists()) {
            throw new Error("This listing is no longer available for booking.");
          }

          const listing = listingSnapshot.data();
          if (listing.verificationStatus !== "verified" || listing.ownerId !== user.uid || listing.listingPurpose === "sale") {
            throw new Error("This listing can no longer be booked.");
          }

          const confirmedSnapshot = await transaction.get(
            query(collection(db, "bookings"), where("listingId", "==", booking.listingId), where("status", "==", "Confirmed"))
          );

          const conflicts = confirmedSnapshot.docs.some((item) => (
            item.id !== request.id && datesOverlap(item.data().startDate, item.data().endDate, booking.startDate, booking.endDate)
          ));

          if (conflicts) {
            throw new Error("This request overlaps an existing confirmed stay.");
          }

          transaction.update(bookingRef, {
            status: "Confirmed",
            updatedAt: serverTimestamp(),
            confirmedAt: serverTimestamp(),
          });
        });

        try {
          await createNotification(db, {
            recipientId: request.renterId,
            createdBy: user.uid,
            type: NOTIFICATION_TYPES.BOOKING_UPDATE,
            title: "Booking request confirmed",
            message: `${request.listingTitle || "Your booking"} has been confirmed by the owner.`,
            link: "/my-bookings",
            entityId: request.id,
            entityType: "booking",
          });
        } catch {
          // The booking stays confirmed even if notification delivery fails.
        }
        setMessage("Booking request confirmed.");
      } else if (status === "Completed") {
        await updateDoc(doc(db, "bookings", request.id), { status, updatedAt: serverTimestamp(), completedAt: serverTimestamp() });
        setMessage("Booking marked as completed.");
      }
    } catch (updateError) {
      setError(updateError.message || "The booking request could not be updated.");
    }
  }

  async function declineRequest(request) {
    setError("");
    setMessage("");
    try {
      await deleteDoc(doc(db, "bookings", request.id));
      setMessage("Booking request declined.");
    } catch (updateError) {
      setError(updateError.message || "The booking request could not be declined.");
    }
  }

  return (
    <div className="user-page">
      <PublicNav />
      <main className="user-page__content">
        <header className="user-page__header"><div><p className="user-page__eyebrow">Owner tools</p><h1>Booking Requests</h1><p>Confirm one request only after checking its dates against existing stays.</p></div></header>
        {error && <p className="user-page__form-error" role="alert">{error}</p>}
        {message && <p className="user-page__message" role="status">{message}</p>}
        {loading ? <p className="user-page__empty">Loading requests...</p> : requests.length === 0 ? <div className="user-page__empty"><h2>No pending requests</h2><p>New renter requests for your verified listings will appear here.</p></div> : (
          <div className="user-page__list">{requests.map((request) => <RequestItem key={request.id} request={request} bookings={bookingsByListing[request.listingId] || []} onUpdate={updateRequest} onDecline={declineRequest} />)}</div>
        )}
      </main>
    </div>
  );
}

function RequestItem({ request, bookings, onUpdate, onDecline }) {
  const [saving, setSaving] = useState(false);
  const monthDates = useMemo(() => buildMonthGrid(request.startDate || new Date()), [request.startDate]);
  const blockedDates = useMemo(() => {
    const blocked = new Set();
    bookings.forEach((booking) => {
      if (booking.id === request.id || !["Confirmed", "Pending"].includes(booking.status)) return;
      const start = toDate(booking.startDate);
      const end = toDate(booking.endDate);
      if (!start || !end) return;
      const cursor = new Date(start);
      while (cursor <= end) {
        blocked.add(formatDayKey(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return blocked;
  }, [bookings, request.id]);

  async function update(status) {
    setSaving(true);
    try {
      await onUpdate(request, status);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="user-page__item booking-item">
      <div className="booking-item__main">
        <div className="user-page__item-link">
          <h2>{request.listingTitle || "Listing"}</h2>
          <p>{formatDate(request.startDate)} to {formatDate(request.endDate)}</p>
          <p>Renter: {request.renterId}</p>
        </div>
        <div className="booking-item__availability">
          <div className="booking-item__calendar" aria-label="Availability calendar for this listing">
            {monthDates.map((date) => {
              const key = formatDayKey(date);
              const isRequested = date >= toDate(request.startDate) && date <= toDate(request.endDate);
              const isBooked = blockedDates.has(key);
              return (
                <span
                  key={`${request.id}-${key}`}
                  className={[
                    "booking-item__day",
                    isRequested ? "booking-item__day--request" : "",
                    isBooked ? "booking-item__day--booked" : "",
                  ].join(" ")}
                  title={isBooked ? "Unavailable" : isRequested ? "Requested range" : "Available"}
                >
                  <span className="booking-item__day-number">{date.getDate()}</span>
                </span>
              );
            })}
          </div>
          <p className="booking-item__hint">Available days are shown in light cells; blocked days and requested dates are highlighted.</p>
        </div>
      </div>
      <div className="booking-item__actions">{request.status === "Pending" && <><button type="button" className="btn btn--primary" onClick={() => update("Confirmed")} disabled={saving}><Check size={15} aria-hidden="true" /> Confirm</button><button type="button" className="btn btn--danger" onClick={() => onDecline(request)} disabled={saving}>Decline</button></>}</div>
    </article>
  );
}

function buildMonthGrid(dateValue) {
  const baseDate = toDate(dateValue) || new Date();
  const monthStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const gridStart = new Date(monthStart);
  const offset = (monthStart.getDay() + 6) % 7;
  gridStart.setDate(monthStart.getDate() - offset);

  const cells = [];
  for (let index = 0; index < 42; index += 1) {
    const current = new Date(gridStart);
    current.setDate(gridStart.getDate() + index);
    cells.push(current);
  }
  return cells;
}

function formatDayKey(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date) : "Date unavailable";
}
