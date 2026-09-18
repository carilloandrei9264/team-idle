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
  const [savingId, setSavingId] = useState(null);

  useEffect(() => onSnapshot(
    query(collection(db, "bookings"), where("renterId", "==", user.uid)),
    (snapshot) => {
      setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
      setLoading(false);
    },
    () => { setError("Your bookings could not be loaded."); setLoading(false); }
  ), [user.uid]);

  async function cancelBooking(bookingId) {
    setSavingId(bookingId);
    setError("");
    try {
      await updateDoc(doc(db, "bookings", bookingId), { status: "Cancelled", updatedAt: serverTimestamp() });
    } catch {
      setError("The booking could not be cancelled.");
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
        {loading ? <p className="user-page__empty">Loading your bookings...</p> : bookings.length === 0 ? (
          <div className="user-page__empty"><h2>No bookings yet</h2><p>When you request a stay, its status will appear here.</p><Link to="/browse" className="btn btn--primary">Browse listings</Link></div>
        ) : (
          <div className="user-page__list">{bookings.map((booking) => (
            <article className="user-page__item booking-item" key={booking.id}>
              <div><h2>{booking.listingTitle || "Listing"}</h2><p>{formatBookingDate(booking.startDate)} to {formatBookingDate(booking.endDate)}</p><p className="user-page__item-meta">Owner: {booking.ownerName || "Property owner"}</p></div>
              <div className="booking-item__actions"><span className={`badge badge--${statusTone(booking.status)}`}>{booking.status}</span>{["Pending", "Confirmed"].includes(booking.status) && <button type="button" className="btn btn--secondary" onClick={() => cancelBooking(booking.id)} disabled={savingId === booking.id}>{savingId === booking.id ? "Cancelling..." : "Cancel"}</button>}{booking.status === "Completed" && <Link to={`/bookings/${booking.id}/review`} className="btn btn--secondary">Rate stay</Link>}{["Confirmed", "Completed"].includes(booking.status) && <Link to={`/bookings/${booking.id}/dispute`} className="btn btn--danger">Raise dispute</Link>}</div>
            </article>
          ))}</div>
        )}
      </main>
    </div>
  );
}

function statusTone(status) {
  return status === "Confirmed" || status === "Completed" ? "verified" : status === "Declined" || status === "Cancelled" ? "danger" : "pending";
}
