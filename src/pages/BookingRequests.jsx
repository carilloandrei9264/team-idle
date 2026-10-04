import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, runTransaction, where } from "firebase/firestore";
import { Link, useSearchParams } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { datesOverlap, formatBookingDate, toDate } from "../lib/booking";
import { createNotification, NOTIFICATION_TYPES } from "../lib/notifications";
import "./UserPages.css";

export default function BookingRequests({ embedded = false }) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [requests, setRequests] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const listingFilter = searchParams.get("listingId");
  const visibleRequests = listingFilter
    ? requests.filter((request) => request.listingId === listingFilter)
    : requests;
  const filteredListingTitle = visibleRequests[0]?.listingTitle;

  useEffect(() => onSnapshot(
    query(collection(db, "bookings"), where("ownerId", "==", user.uid)),
    (snapshot) => {
      const docs = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort(sortByCreatedAt);
      setAllBookings(docs);
      setRequests(docs);
      setLoading(false);
    },
    () => { setError("Booking requests could not be loaded."); setLoading(false); }
  ), [user.uid]);

  const bookingsByListing = useMemo(() => {
    const map = {};
    allBookings.forEach((booking) => {
      map[booking.listingId] ??= [];
      map[booking.listingId].push(booking);
    });
    return map;
  }, [allBookings]);

  async function decide(request, status) {
    setSavingId(request.id);
    setError("");
    setMessage("");
    try {
      if (status === "Confirmed") {
        const bookingDoc = await getDoc(doc(db, "bookings", request.id));
        if (!bookingDoc.exists()) {
          throw new Error("This booking request no longer exists.");
        }

        const booking = bookingDoc.data();
        if (booking.ownerId !== user.uid) {
          throw new Error("You can only approve your own requests.");
        }
        if (booking.status !== "Pending") {
          throw new Error("This request is no longer pending.");
        }

        const listingDoc = await getDoc(doc(db, "listings", booking.listingId));
        if (!listingDoc.exists()) {
          throw new Error("This listing is no longer available for booking.");
        }

        const listing = listingDoc.data();
        if (listing.verificationStatus !== "verified" || listing.ownerId !== user.uid || listing.listingPurpose === "sale") {
          throw new Error("This listing can no longer be booked.");
        }

        const confirmedSnapshot = await getDocs(
          query(
            collection(db, "bookings"),
            where("listingId", "==", booking.listingId),
            where("ownerId", "==", user.uid),
            where("status", "==", "Confirmed")
          )
        );

        const overlaps = confirmedSnapshot.docs.some((item) => item.id !== request.id && datesOverlap(item.data().startDate, item.data().endDate, booking.startDate, booking.endDate));
        if (overlaps) {
          throw new Error("This request overlaps another confirmed stay.");
        }

        await runTransaction(db, async (transaction) => {
          const bookingRef = doc(db, "bookings", request.id);
          const bookingSnapshot = await transaction.get(bookingRef);
          if (!bookingSnapshot.exists()) {
            throw new Error("This booking request no longer exists.");
          }

          const latestBooking = bookingSnapshot.data();
          if (latestBooking.ownerId !== user.uid) {
            throw new Error("You can only approve your own requests.");
          }
          if (latestBooking.status !== "Pending") {
            throw new Error("This request is no longer pending.");
          }

          transaction.update(bookingRef, {
            status: "Confirmed",
            updatedAt: new Date(),
            confirmedAt: new Date(),
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
          // The booking remains confirmed even if notification delivery fails.
        }
        setMessage("Booking request confirmed.");
        return;
      }

      setMessage("This request is waiting for confirmation.");
    } catch (decisionError) {
      setError(decisionError.message || "The booking request could not be updated.");
    } finally {
      setSavingId(null);
    }
  }

  async function decline(request) {
    setSavingId(request.id);
    setError("");
    setMessage("");
    try {
      await deleteDoc(doc(db, "bookings", request.id));
      setMessage("Booking request declined.");
    } catch (decisionError) {
      setError(`${decisionError.message || "The booking request could not be declined."}`);
    } finally {
      setSavingId(null);
    }
  }

  const content = (
    <>
      <header className="user-page__header">
        <div>
          <p className="user-page__eyebrow">Owner tools</p>
          <h1>{listingFilter ? `Requests for ${filteredListingTitle || "this listing"}` : "Booking Requests"}</h1>
          <p>Confirm one request only after checking its dates against existing stays.</p>
        </div>
        {listingFilter && <Link to="/my-activity?tab=requests" className="btn btn--secondary">Show all requests</Link>}
      </header>
      {error && <p className="user-page__form-error" role="alert">{error}</p>}
      {message && <p className="user-page__message" role="status">{message}</p>}
      {loading ? <p className="user-page__empty">Loading booking requests...</p> : requests.length === 0 ? (
        <div className="user-page__empty"><h2>No booking requests</h2><p>Requests from renters will appear here.</p></div>
      ) : visibleRequests.length === 0 ? (
        <div className="user-page__empty"><h2>No requests for this listing</h2><p>There are no booking requests for this property.</p><Link to="/my-activity?tab=requests" className="btn btn--secondary">Show all requests</Link></div>
      ) : (
        <div className="user-page__list">
          {visibleRequests.map((request) => (
            <RequestCard key={request.id} request={request} bookings={bookingsByListing[request.listingId] || []} onApprove={() => decide(request, "Confirmed")} onDecline={() => decline(request)} savingId={savingId} />
          ))}
        </div>
      )}
    </>
  );

  if (embedded) return content;

  return (
    <div className="user-page">
      <PublicNav />
      <main className="user-page__content">
        {content}
      </main>
    </div>
  );
}

function RequestCard({ request, bookings, onApprove, onDecline, savingId }) {
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

  return (
    <article className="user-page__item booking-item">
      <div className="booking-item__main">
        <div>
          <h2>{request.listingTitle || "Listing"}</h2>
          <p>{formatBookingDate(request.startDate)} to {formatBookingDate(request.endDate)}</p>
          <p className="user-page__item-meta">Renter: {request.renterName || "TrustHome user"}</p>
        </div>
        <div className="booking-item__availability">
          <div className="booking-item__calendar" aria-label="Availability calendar for this listing">
            {monthDates.map((date) => {
              const key = formatDayKey(date);
              const isRequested = request.startDate && toDate(request.startDate) <= date && toDate(request.endDate) >= date;
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
          <p className="booking-item__hint">Available dates are shown in light cells; requested and unavailable dates are highlighted.</p>
        </div>
      </div>
      <div className="booking-item__actions">
        <span className={`badge badge--${statusTone(request.status)}`}>{request.status}</span>
        {request.status === "Pending" && <>
          <button type="button" className="btn btn--primary" onClick={onApprove} disabled={savingId === request.id}>Approve</button>
          <button type="button" className="btn btn--danger" onClick={onDecline} disabled={savingId === request.id}>Decline</button>
        </>}
      </div>
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

function sortByCreatedAt(a, b) { return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0); }
function statusTone(status) { return status === "Confirmed" || status === "Completed" ? "verified" : status === "Disputed" ? "danger" : "pending"; }
