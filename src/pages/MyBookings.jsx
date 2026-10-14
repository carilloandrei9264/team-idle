import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { Link } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { canRenterCompleteBooking, canRevealExactAddress, formatBookingDateTime, getBookingReference, getCompletionStateLabel, getPaymentStatusLabel } from "../lib/booking";
import { createAccountActivity } from "../lib/accountActivity";
import "./UserPages.css";

export default function MyBookings({ embedded = false }) {
  const { user, profile } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [reviewStatus, setReviewStatus] = useState({ loading: true, bookingIds: new Set(), unavailable: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [depositReferences, setDepositReferences] = useState({});

  useEffect(() => onSnapshot(
    query(collection(db, "bookings"), where("renterId", "==", user.uid)),
    (snapshot) => {
      setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
      setLoading(false);
    },
    () => { setError("Your bookings could not be loaded."); setLoading(false); }
  ), [user.uid]);

  useEffect(() => onSnapshot(
    query(collection(db, "ratings"), where("reviewerId", "==", user.uid)),
    (snapshot) => setReviewStatus({
      loading: false,
      bookingIds: new Set(snapshot.docs.map((item) => item.data().bookingId)),
      unavailable: false,
    }),
    () => setReviewStatus({ loading: false, bookingIds: new Set(), unavailable: true })
  ), [user.uid]);

  async function saveDepositReference(bookingId) {
    const depositReference = depositReferences[bookingId]?.trim();
    if (!depositReference) return;
    setSavingId(bookingId);
    setError("");
    setMessage("");
    try {
      await updateDoc(doc(db, "bookings", bookingId), { depositReference, paymentStatus: "reference_submitted", updatedAt: serverTimestamp() });
      setMessage("Deposit reference saved to the booking record.");
    } catch {
      setError("The deposit reference could not be saved.");
    } finally {
      setSavingId(null);
    }
  }

  async function markCompleted(booking) {
    if (!canRenterCompleteBooking(booking)) {
      setError("You can mark this stay complete after its check-out time.");
      return;
    }

    setSavingId(booking.id);
    setError("");
    setMessage("");
    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        status: "Completed",
        updatedAt: serverTimestamp(),
        completedAt: serverTimestamp(),
        completionRequestedAt: serverTimestamp(),
        completionRequestedBy: "renter",
        ownerConfirmedCompletion: false,
      });
      try {
        await createAccountActivity(db, {
          actorId: user.uid,
          actorRole: profile?.role || "user",
          targetUserId: booking.ownerId || user.uid,
          entityType: "booking",
          entityId: booking.id,
          action: "booking_completed",
          summary: "Stay completed by renter",
          details: { listingId: booking.listingId, listingTitle: booking.listingTitle || "Untitled listing" },
        });
      } catch {
        // Activity logging is non-blocking for the completion flow.
      }
      setMessage("Booking marked as completed and sent to the owner for review.");
    } catch {
      setError("The booking could not be marked as completed.");
    } finally {
      setSavingId(null);
    }
  }

  const content = (
    <>
      {!embedded && <header className="user-page__header"><div><p className="user-page__eyebrow">Your account</p><h1>My Bookings</h1><p>Track requests and confirmed stays in one place.</p></div></header>}
      {error && <p className="user-page__form-error" role="alert">{error}</p>}
      {message && <p className="user-page__message" role="status">{message}</p>}
      {loading ? <p className="user-page__empty">Loading your bookings...</p> : bookings.length === 0 ? (
        <div className="user-page__empty"><h2>No bookings yet</h2><p>When you request a stay, its status will appear here.</p><Link to="/browse" className="btn btn--primary">Browse listings</Link></div>
      ) : (
        <div className="user-page__list my-bookings__list">{bookings.map((booking) => (
          <article className="user-page__item booking-item booking-item--renter" key={booking.id}>
            <div className="booking-item__details">
              <div className="booking-item__heading">
                <h2>{booking.listingTitle || "Listing"}</h2>
                <span className={`badge badge--${statusTone(booking.status)}`}>{booking.status}</span>
              </div>
              <p className="booking-item__dates">{formatBookingDateTime(booking.startDate)} to {formatBookingDateTime(booking.endDate)}</p>
              <p className="user-page__item-meta">Reference: {getBookingReference(booking)}</p>
              <p className="user-page__item-meta">Payment status: {getPaymentStatusLabel(booking)}</p>
              <p className="user-page__item-meta">Completion: {getCompletionStateLabel(booking)}</p>
              <p className="user-page__item-meta">Owner: {booking.ownerName || "Property owner"}</p>
              {canRevealExactAddress(booking.status) && booking.address && (
                <p className="user-page__item-meta">Address: {booking.address}</p>
              )}
            </div>
            <div className="booking-item__actions">
              {booking.status === "Confirmed" && <>
                <div className="booking-item__payment">
                  <label className="field"><span className="field__label">Deposit reference</span>
                    <div className="booking-item__payment-controls">
                      <input className="field__input" value={depositReferences[booking.id] ?? booking.depositReference ?? ""} onChange={(event) => setDepositReferences((current) => ({ ...current, [booking.id]: event.target.value }))} placeholder="GCash or bank transfer" />
                      <button type="button" className="btn btn--secondary" onClick={() => saveDepositReference(booking.id)} disabled={savingId === booking.id || !depositReferences[booking.id]?.trim()}>{savingId === booking.id ? "Saving..." : "Save"}</button>
                    </div>
                  </label>
                </div>
                {canRenterCompleteBooking(booking)
                  ? <button type="button" className="btn btn--primary" onClick={() => markCompleted(booking)} disabled={savingId === booking.id}>Mark completed</button>
                  : <p className="booking-item__availability">Available after check-out: {formatBookingDateTime(booking.endDate)} (PHT)</p>}
              </>}
              {booking.status === "Completed" && (reviewStatus.loading ? <span>Checking review...</span> : reviewStatus.unavailable ? <span>Review status unavailable</span> : reviewStatus.bookingIds.has(booking.id) ? <span className="badge badge--verified">Reviewed</span> : <Link to={`/bookings/${booking.id}/review`} className="btn btn--secondary">Rate stay</Link>)}
              {["Confirmed", "Completed"].includes(booking.status) && <Link to={`/bookings/${booking.id}/dispute`} className="btn btn--danger">Raise dispute</Link>}
            </div>
          </article>
        ))}</div>
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

function statusTone(status) {
  return status === "Confirmed" || status === "Completed" ? "verified" : status === "Disputed" ? "danger" : "pending";
}
