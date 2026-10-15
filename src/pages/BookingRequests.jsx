import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { formatBookingDateTime, getBookingReference, getCompletionStateLabel, getPaymentStatusLabel, toDate } from "../lib/booking";
import { ACCOUNT_ACTIVITY_ACTIONS, createAccountActivity } from "../lib/accountActivity";
import { confirmBookingRequest } from "../lib/bookingConfirmation";
import { createNotification, NOTIFICATION_TYPES } from "../lib/notifications";
import "./UserPages.css";

const REQUESTS_PER_PAGE = 6;

export default function BookingRequests({ embedded = false }) {
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const [requests, setRequests] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [pageState, setPageState] = useState({ listingFilter: null, page: 0 });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const listingFilter = searchParams.get("listingId");
  const visibleRequests = listingFilter
    ? requests.filter((request) => request.listingId === listingFilter)
    : requests;
  const pageCount = Math.max(1, Math.ceil(visibleRequests.length / REQUESTS_PER_PAGE));
  const requestPage = pageState.listingFilter === listingFilter ? pageState.page : 0;
  const currentPage = Math.min(requestPage, pageCount - 1);
  const pageRequests = visibleRequests.slice(currentPage * REQUESTS_PER_PAGE, (currentPage + 1) * REQUESTS_PER_PAGE);
  const filteredListingTitle = visibleRequests[0]?.listingTitle;

  function setRequestPage(page) {
    setPageState({ listingFilter, page });
  }

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
        await confirmBookingRequest(db, user.uid, request.id);

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
        try {
          await createAccountActivity(db, {
            actorId: user.uid,
            actorRole: profile?.role || "user",
            targetUserId: request.renterId,
            entityType: "booking",
            entityId: request.id,
            action: "booking_confirmed",
            summary: "Booking confirmed by owner",
            details: { listingId: request.listingId, listingTitle: request.listingTitle || "Untitled listing" },
          });
        } catch {
          // Activity logging is non-blocking for the confirmation flow.
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

  async function markPaymentReceived(request) {
    setSavingId(request.id);
    setError("");
    setMessage("");
    try {
      await updateDoc(doc(db, "bookings", request.id), {
        paymentStatus: "payment_received",
        updatedAt: serverTimestamp(),
      });
      try {
        await createAccountActivity(db, {
          actorId: user.uid,
          actorRole: profile?.role || "user",
          targetUserId: request.renterId,
          entityType: "booking",
          entityId: request.id,
          action: ACCOUNT_ACTIVITY_ACTIONS.PAYMENT_RECEIVED,
          summary: "Payment received",
          details: { listingId: request.listingId, paymentStatus: "payment_received" },
        });
      } catch {
        // Activity logging is non-blocking for the payment flow.
      }
      setMessage("Payment marked as received.");
    } catch (decisionError) {
      setError(decisionError.message || "The payment status could not be updated.");
    } finally {
      setSavingId(null);
    }
  }

  async function confirmCompletion(request) {
    setSavingId(request.id);
    setError("");
    setMessage("");
    try {
      await updateDoc(doc(db, "bookings", request.id), {
        ownerConfirmedCompletion: true,
        completionConfirmedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      try {
        await createAccountActivity(db, {
          actorId: user.uid,
          actorRole: profile?.role || "user",
          targetUserId: request.renterId,
          entityType: "booking",
          entityId: request.id,
          action: ACCOUNT_ACTIVITY_ACTIONS.COMPLETION_REVIEWED,
          summary: "Owner confirmed stay completion",
          details: { listingId: request.listingId, listingTitle: request.listingTitle || "Untitled listing" },
        });
      } catch {
        // Activity logging is non-blocking for the completion review flow.
      }
      setMessage("Stay completion confirmed.");
    } catch (decisionError) {
      setError(decisionError.message || "The completion review could not be confirmed.");
    } finally {
      setSavingId(null);
    }
  }

  async function decline(request) {
    setSavingId(request.id);
    setError("");
    setMessage("");
    try {
      await updateDoc(doc(db, "bookings", request.id), {
        status: "Declined",
        declinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      try {
        await createNotification(db, {
          recipientId: request.renterId,
          createdBy: user.uid,
          type: NOTIFICATION_TYPES.BOOKING_UPDATE,
          title: "Booking request declined",
          message: `${request.listingTitle || "Your booking request"} was declined by the owner.`,
          link: "/my-bookings",
          entityId: request.id,
          entityType: "booking",
        });
      } catch {
        // The decline remains valid if notification delivery is unavailable.
      }
      try {
        await createAccountActivity(db, {
          actorId: user.uid,
          actorRole: profile?.role || "user",
          targetUserId: request.renterId,
          entityType: "booking",
          entityId: request.id,
          action: ACCOUNT_ACTIVITY_ACTIONS.BOOKING_DECLINED,
          summary: "Booking request declined",
          details: { listingId: request.listingId, listingTitle: request.listingTitle || "Untitled listing" },
        });
      } catch {
        // Activity logging is non-blocking for the decline flow.
      }
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
        <>
          <div className="user-page__list">
            {pageRequests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                bookings={bookingsByListing[request.listingId] || []}
                onApprove={() => decide(request, "Confirmed")}
                onMarkPaid={() => markPaymentReceived(request)}
                onConfirmCompletion={() => confirmCompletion(request)}
                onDecline={() => decline(request)}
                savingId={savingId}
              />
            ))}
          </div>
          {visibleRequests.length > REQUESTS_PER_PAGE && (
            <nav className="booking-requests__pagination" aria-label="Booking request pages">
              <p>
                Showing {currentPage * REQUESTS_PER_PAGE + 1}–{Math.min((currentPage + 1) * REQUESTS_PER_PAGE, visibleRequests.length)} of {visibleRequests.length} requests
              </p>
              <div>
                <button type="button" className="booking-requests__page-button" onClick={() => setRequestPage(currentPage - 1)} disabled={currentPage === 0} aria-label="Previous page" title="Previous page">
                  <ChevronLeft size={17} aria-hidden="true" />
                </button>
                <span>Page {currentPage + 1} of {pageCount}</span>
                <button type="button" className="booking-requests__page-button" onClick={() => setRequestPage(currentPage + 1)} disabled={currentPage >= pageCount - 1} aria-label="Next page" title="Next page">
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
              </div>
            </nav>
          )}
        </>
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

function RequestCard({ request, bookings, onApprove, onMarkPaid, onConfirmCompletion, onDecline, savingId }) {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const startDate = toDate(request.startDate) || new Date();
    return new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  });
  const monthDates = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth]);
  const monthLabel = visibleMonth.toLocaleDateString("en-PH", { month: "long", year: "numeric" });
  const blockedDates = useMemo(() => {
    const blocked = new Set();
    bookings.forEach((booking) => {
      if (booking.id === request.id || !["Confirmed", "Pending"].includes(booking.status)) return;
      const start = toDate(booking.startDate);
      const end = toDate(booking.endDate);
      if (!start || !end) return;
      const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      while (cursor <= lastDay) {
        blocked.add(formatDayKey(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return blocked;
  }, [bookings, request.id]);

  return (
    <article className="user-page__item booking-request-card">
      <div className="booking-item__availability">
          <section className="booking-item__calendar" aria-label={`Availability calendar for ${request.listingTitle || "this booking"}`}>
            <div className="booking-item__calendar-header">
              <button type="button" className="booking-item__month-button" aria-label="Previous month" title="Previous month" onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <h3>{monthLabel}</h3>
              <button type="button" className="booking-item__month-button" aria-label="Next month" title="Next month" onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="booking-item__weekdays" aria-hidden="true">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="booking-item__days">
            {monthDates.map((date) => {
              const key = formatDayKey(date);
              const start = toDate(request.startDate);
              const end = toDate(request.endDate);
              const isRequested = start && end && formatDayKey(start) <= key && key <= formatDayKey(end);
              const isBooked = blockedDates.has(key);
              const isOutsideMonth = date.getMonth() !== visibleMonth.getMonth();
              const availability = isBooked ? "Unavailable" : isRequested ? "Requested stay" : "Available";
              return (
                <span
                  key={`${request.id}-${key}`}
                  className={[
                    "booking-item__day",
                    isOutsideMonth ? "booking-item__day--outside" : "",
                    isRequested ? "booking-item__day--request" : "",
                    isBooked ? "booking-item__day--booked" : "",
                  ].join(" ")}
                  aria-label={`${date.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}: ${availability}`}
                  title={availability}
                >
                  <span className="booking-item__day-number">{date.getDate()}</span>
                </span>
              );
            })}
            </div>
          </section>
          <div className="booking-item__legend" aria-label="Calendar key">
            <span><i className="booking-item__legend-swatch booking-item__legend-swatch--available" />Available</span>
            <span><i className="booking-item__legend-swatch booking-item__legend-swatch--requested" />Requested</span>
            <span><i className="booking-item__legend-swatch booking-item__legend-swatch--unavailable" />Unavailable</span>
          </div>
      </div>
      <div className="booking-request-card__details">
        <header className="booking-request-card__header">
          <div>
            <h2>{request.listingTitle || "Listing"}</h2>
            <p>{formatBookingDateTime(request.startDate)} to {formatBookingDateTime(request.endDate)}</p>
          </div>
          <span className={`badge badge--${statusTone(request.status)}`}>{request.status}</span>
        </header>
        <div className="booking-request-card__meta">
          <p>Reference <strong>{getBookingReference(request)}</strong></p>
          <p>Payment <strong>{getPaymentStatusLabel(request)}</strong></p>
          <p>Completion <strong>{getCompletionStateLabel(request)}</strong></p>
          <p>Renter <strong>{request.renterName || "TrustHome user"}</strong></p>
        </div>
        <div className="booking-item__actions">
        {request.status === "Pending" && <>
          <button type="button" className="btn btn--primary" onClick={onApprove} disabled={savingId === request.id}>Approve</button>
          <button type="button" className="btn btn--danger" onClick={onDecline} disabled={savingId === request.id}>Decline</button>
        </>}
        {request.status === "Confirmed" && request.depositReference && request.paymentStatus !== "payment_received" && (
          <button type="button" className="btn btn--secondary" onClick={onMarkPaid} disabled={savingId === request.id}>Mark payment received</button>
        )}
        {request.status === "Completed" && !request.ownerConfirmedCompletion && (
          <button type="button" className="btn btn--secondary" onClick={onConfirmCompletion} disabled={savingId === request.id}>Confirm completion</button>
        )}
        </div>
      </div>
    </article>
  );
}

function buildMonthGrid(dateValue) {
  const monthStart = new Date(dateValue.getFullYear(), dateValue.getMonth(), 1);
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
