import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { Link } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { formatBookingDate } from "../lib/booking";
import "./UserPages.css";

export default function MyBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
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

  async function saveDepositReference(bookingId) {
    const depositReference = depositReferences[bookingId]?.trim();
    if (!depositReference) return;
    setSavingId(bookingId);
    setError("");
    setMessage("");
    try {
      await updateDoc(doc(db, "bookings", bookingId), { depositReference, updatedAt: serverTimestamp() });
      setMessage("Deposit reference saved to the booking record.");
    } catch {
      setError("The deposit reference could not be saved.");
    } finally {
      setSavingId(null);
    }
  }

  async function markCompleted(bookingId) {
    setSavingId(bookingId);
    setError("");
    setMessage("");
    try {
      await updateDoc(doc(db, "bookings", bookingId), { status: "Completed", updatedAt: serverTimestamp(), completedAt: serverTimestamp() });
      setMessage("Booking marked as completed.");
    } catch {
      setError("The booking could not be marked as completed.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="user-page">
      <PublicNav />
      <main className="user-page__content">
        <header className="user-page__header"><div><p className="user-page__eyebrow">Your account</p><h1>My Bookings</h1><p>Track requests and confirmed stays in one place.</p></div></header>
        {error && <p className="user-page__form-error" role="alert">{error}</p>}
        {message && <p className="user-page__message" role="status">{message}</p>}
        {loading ? <p className="user-page__empty">Loading your bookings...</p> : bookings.length === 0 ? (
          <div className="user-page__empty"><h2>No bookings yet</h2><p>When you request a stay, its status will appear here.</p><Link to="/browse" className="btn btn--primary">Browse listings</Link></div>
        ) : (
          <div className="user-page__list">{bookings.map((booking) => (
            <article className="user-page__item booking-item" key={booking.id}>
              <div><h2>{booking.listingTitle || "Listing"}</h2><p>{formatBookingDate(booking.startDate)} to {formatBookingDate(booking.endDate)}</p><p className="user-page__item-meta">Owner: {booking.ownerName || "Property owner"}</p></div>
              <div className="booking-item__actions"><span className={`badge badge--${statusTone(booking.status)}`}>{booking.status}</span>{booking.status === "Confirmed" && <><label className="field"><span className="field__label">Deposit reference</span><input className="field__input" value={depositReferences[booking.id] ?? booking.depositReference ?? ""} onChange={(event) => setDepositReferences((current) => ({ ...current, [booking.id]: event.target.value }))} placeholder="GCash or bank transfer reference" /></label><button type="button" className="btn btn--secondary" onClick={() => saveDepositReference(booking.id)} disabled={savingId === booking.id || !depositReferences[booking.id]?.trim()}>{savingId === booking.id ? "Saving..." : "Save reference"}</button><button type="button" className="btn btn--primary" onClick={() => markCompleted(booking.id)} disabled={savingId === booking.id}>Mark completed</button></>}{booking.status === "Completed" && <Link to={`/bookings/${booking.id}/review`} className="btn btn--secondary">Rate stay</Link>}{["Confirmed", "Completed"].includes(booking.status) && <Link to={`/bookings/${booking.id}/dispute`} className="btn btn--danger">Raise dispute</Link>}</div>
            </article>
          ))}</div>
        )}
      </main>
    </div>
  );
}

function statusTone(status) {
  return status === "Confirmed" || status === "Completed" ? "verified" : status === "Disputed" ? "danger" : "pending";
}
