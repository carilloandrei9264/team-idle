import { useEffect, useState } from "react";
import { addDoc, collection, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import "./UserPages.css";

export default function RaiseDispute() {
  const { bookingId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getDocs(query(collection(db, "bookings"), where("renterId", "==", user.uid))).then((snapshot) => {
      const item = snapshot.docs.find((entry) => entry.id === bookingId);
      if (!item || !["Confirmed", "Completed"].includes(item.data().status)) setError("This booking cannot be disputed.");
      else setBooking({ id: item.id, ...item.data() });
      setLoading(false);
    }).catch(() => { setError("The booking could not be loaded."); setLoading(false); });
  }, [bookingId, user.uid]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await addDoc(collection(db, "disputes"), { bookingId, bookingTitle: booking.listingTitle, ownerId: booking.ownerId, raisedBy: user.uid, raisedByName: user.displayName || user.email, reason: reason.trim(), status: "Open", createdAt: serverTimestamp() });
      navigate("/my-bookings", { replace: true });
    } catch { setError("Your dispute could not be submitted."); } finally { setSaving(false); }
  }

  return <div className="user-page"><PublicNav /><main className="user-page__content user-page__content--form"><Link to="/my-bookings" className="user-page__back"><ArrowLeft size={16} aria-hidden="true" /> My bookings</Link>{loading ? <p className="user-page__empty">Loading dispute form...</p> : error && !booking ? <div className="user-page__empty" role="alert"><h1>Dispute unavailable</h1><p>{error}</p></div> : <><header className="user-page__header"><div><p className="user-page__eyebrow">Accountability trail</p><h1>Raise a dispute</h1><p>Report an issue with {booking?.listingTitle}. TrustHome does not hold deposit funds.</p></div></header><form className="listing-form" onSubmit={handleSubmit}><section className="user-page__empty listing-form__section"><div className="field"><label className="field__label" htmlFor="dispute-reason">What happened?</label><textarea id="dispute-reason" className="listing-form__textarea" rows={7} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe the issue and any relevant evidence." required /></div></section>{error && <p className="user-page__form-error" role="alert">{error}</p>}<button type="submit" className="btn btn--danger listing-form__submit" disabled={saving}>{saving ? "Submitting..." : "Submit dispute"}</button></form></>}</main></div>;
}
