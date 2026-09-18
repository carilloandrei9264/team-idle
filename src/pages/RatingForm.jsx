import { useEffect, useState } from "react";
import { addDoc, collection, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import { ArrowLeft, Star } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import "./UserPages.css";

export default function RatingForm() {
  const { bookingId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getDocs(query(collection(db, "bookings"), where("renterId", "==", user.uid))).then((snapshot) => {
      const item = snapshot.docs.find((entry) => entry.id === bookingId);
      if (!item || item.data().status !== "Completed") setError("This booking is not available for review.");
      else setBooking({ id: item.id, ...item.data() });
      setLoading(false);
    }).catch(() => { setError("The booking could not be loaded."); setLoading(false); });
  }, [bookingId, user.uid]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const existing = await getDocs(query(collection(db, "ratings"), where("bookingId", "==", bookingId), where("reviewerId", "==", user.uid)));
      if (!existing.empty) throw new Error("You have already reviewed this booking.");
      await addDoc(collection(db, "ratings"), { bookingId, listingId: booking.listingId, ownerId: booking.ownerId, renterId: booking.renterId, reviewerId: user.uid, reviewerName: user.displayName || user.email, score: Number(score), comment: comment.trim(), createdAt: serverTimestamp() });
      navigate("/my-bookings", { replace: true });
    } catch (submitError) { setError(submitError.message || "Your review could not be submitted."); } finally { setSaving(false); }
  }

  return <div className="user-page"><PublicNav /><main className="user-page__content user-page__content--form"><Link to="/my-bookings" className="user-page__back"><ArrowLeft size={16} aria-hidden="true" /> My bookings</Link>{loading ? <p className="user-page__empty">Loading review form...</p> : error && !booking ? <div className="user-page__empty" role="alert"><h1>Review unavailable</h1><p>{error}</p></div> : <><header className="user-page__header"><div><p className="user-page__eyebrow">Completed stay</p><h1>Review {booking?.listingTitle}</h1><p>Help other users understand what to expect.</p></div></header><form className="listing-form" onSubmit={handleSubmit}><section className="user-page__empty listing-form__section"><div className="field"><label className="field__label" htmlFor="rating-score">Rating</label><select id="rating-score" className="field__input" value={score} onChange={(event) => setScore(event.target.value)}>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} {value === 1 ? "star" : "stars"}</option>)}</select></div><div className="field"><label className="field__label" htmlFor="rating-comment">Comment</label><textarea id="rating-comment" className="listing-form__textarea" rows={5} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="What was your experience?" required /></div><p className="listing-form__hint"><Star size={15} aria-hidden="true" /> Ratings are available after a booking is completed.</p></section>{error && <p className="user-page__form-error" role="alert">{error}</p>}<button type="submit" className="btn btn--primary listing-form__submit" disabled={saving}>{saving ? "Submitting..." : "Submit review"}</button></form></>}</main></div>;
}
