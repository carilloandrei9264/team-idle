import { useEffect, useState } from "react";
import { collection, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { Link } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { toDate } from "../lib/booking";
import "./UserPages.css";

export default function MyBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [ratings, setRatings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const bookingsQuery = query(collection(db, "bookings"), where("renterId", "==", user.uid));
    return onSnapshot(bookingsQuery, async (snapshot) => {
      const nextBookings = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
      setBookings(nextBookings);
      try {
        const ratingsSnapshot = await getDocs(query(collection(db, "ratings"), where("raterId", "==", user.uid)));
        const ratingMap = {};
        ratingsSnapshot.docs.forEach((item) => { ratingMap[item.data().bookingId] = item.data(); });
        setRatings(ratingMap);
      } catch {
        setError("Bookings loaded, but ratings could not be checked.");
      }
      setLoading(false);
    }, () => {
      setError("Your bookings could not be loaded. Please try again.");
      setLoading(false);
    });
  }, [user.uid]);

  return (
    <div className="user-page">
      <PublicNav />
      <main className="user-page__content">
        <header className="user-page__header">
          <div>
            <p className="user-page__eyebrow">Your account</p>
            <h1>My Bookings</h1>
            <p>Track your booking requests and completed stays.</p>
          </div>
        </header>
        {error && <p className="user-page__form-error" role="alert">{error}</p>}
        {loading ? <p className="user-page__empty">Loading your bookings...</p> : bookings.length === 0 ? (
          <div className="user-page__empty"><h2>No bookings yet</h2><p>When you request a stay, its status will appear here.</p><Link className="btn btn--primary" to="/browse">Browse listings</Link></div>
        ) : (
          <div className="user-page__list">
            {bookings.map((booking) => <BookingItem key={booking.id} booking={booking} existingRating={ratings[booking.id]} userId={user.uid} />)}
          </div>
        )}
      </main>
    </div>
  );
}

function BookingItem({ booking, existingRating, userId }) {
  const [score, setScore] = useState(existingRating?.score || "");
  const [comment, setComment] = useState(existingRating?.comment || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submitRating(event) {
    event.preventDefault();
    if (!score) return;
    setSaving(true);
    setMessage("");
    try {
      await setDoc(doc(db, "ratings", booking.id), {
        bookingId: booking.id,
        listingId: booking.listingId,
        raterId: userId,
        rateeId: booking.ownerId,
        score: Number(score),
        comment: comment.trim(),
        createdAt: serverTimestamp(),
      });
      setMessage("Rating submitted.");
    } catch {
      setMessage("Rating could not be submitted.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="user-page__item booking-item">
      <div className="user-page__item-link">
        <h2>{booking.listingTitle || "Booking request"}</h2>
        <p>{formatDate(booking.startDate)} to {formatDate(booking.endDate)}</p>
        <span className={`badge badge--${statusTone(booking.status)}`}>{booking.status}</span>
      </div>
      {booking.status === "Completed" && !existingRating && !message && (
        <form className="booking-item__rating" onSubmit={submitRating}>
          <label className="field__label" htmlFor={`rating-${booking.id}`}>Rate your stay</label>
          <select id={`rating-${booking.id}`} className="field__input" value={score} onChange={(event) => setScore(event.target.value)} required>
            <option value="">Score</option>
            {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} / 5</option>)}
          </select>
          <input className="field__input" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Optional comment" />
          <button className="btn btn--secondary" type="submit" disabled={saving}>{saving ? "Saving..." : "Submit rating"}</button>
        </form>
      )}
      {(existingRating || message) && <span className="booking-item__message">{message || `Rated ${existingRating.score}/5`}</span>}
    </article>
  );
}

function formatDate(value) {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date) : "Date unavailable";
}

function statusTone(status) {
  if (status === "Confirmed" || status === "Completed") return "verified";
  if (status === "Disputed" || status === "Cancelled") return "danger";
  return "pending";
}
