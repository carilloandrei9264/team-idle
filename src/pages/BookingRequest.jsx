import { useEffect, useState } from "react";
import { addDoc, collection, getDocs, query, serverTimestamp, Timestamp, where } from "firebase/firestore";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { hasConfirmedConflict, isValidDateRange } from "../lib/booking";
import { formatCurrency } from "../lib/number";
import "./UserPages.css";

export default function BookingRequest() {
  const { listingId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getDocs(query(collection(db, "listings"), where("verificationStatus", "==", "verified")))
      .then((snapshot) => {
        if (!active) return;
        const match = snapshot.docs.find((item) => item.id === listingId);
        if (match) setListing({ id: match.id, ...match.data() });
        else setError("This listing is unavailable for booking.");
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("The listing could not be loaded. Please try again.");
        setLoading(false);
      });
    return () => { active = false; };
  }, [listingId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!listing) return;
    if (listing.ownerId === user.uid) {
      setError("You cannot request a booking for your own listing.");
      return;
    }
    if (!isValidDateRange(startDate, endDate)) {
      setError("Choose an end date after the start date.");
      return;
    }

    setSubmitting(true);
    try {
      const confirmedSnapshot = await getDocs(query(
        collection(db, "bookings"),
        where("listingId", "==", listingId),
        where("status", "==", "Confirmed")
      ));
      const confirmedBookings = confirmedSnapshot.docs.map((item) => item.data());
      if (hasConfirmedConflict(confirmedBookings, startDate, endDate)) {
        setError("Those dates are unavailable. Choose a different range.");
        return;
      }

      await addDoc(collection(db, "bookings"), {
        listingId,
        listingTitle: listing.title || "Untitled listing",
        ownerId: listing.ownerId,
        renterId: user.uid,
        startDate: Timestamp.fromDate(new Date(`${startDate}T00:00:00`)),
        endDate: Timestamp.fromDate(new Date(`${endDate}T00:00:00`)),
        status: "Pending",
        depositReference: "",
        createdAt: serverTimestamp(),
      });
      navigate("/my-bookings", { replace: true });
    } catch (submitError) {
      setError(submitError.message || "The booking request could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="user-page">
      <PublicNav />
      <main className="user-page__content user-page__content--form">
        <Link to={`/listings/${listingId}`} className="user-page__back"><ArrowLeft size={16} aria-hidden="true" /> Listing details</Link>
        {loading ? <p className="user-page__empty">Loading booking details...</p> : error && !listing ? (
          <div className="user-page__empty" role="alert"><h1>Booking unavailable</h1><p>{error}</p></div>
        ) : (
          <>
            <header className="user-page__header">
              <div>
                <p className="user-page__eyebrow">Booking request</p>
                <h1>Choose your dates</h1>
                <p>{listing.title} · {formatCurrency(listing.price)}/{listing.pricePeriod || "month"}</p>
              </div>
            </header>
            <form className="booking-form user-page__empty" onSubmit={handleSubmit}>
              <div className="booking-form__icon" aria-hidden="true"><CalendarDays size={22} /></div>
              <p className="booking-form__hint">Pending requests do not block other renters. The dates become unavailable only after the owner confirms one request.</p>
              <div className="listing-form__grid">
                <div className="field">
                  <label className="field__label" htmlFor="start-date">Start date</label>
                  <input id="start-date" className="field__input" type="date" value={startDate} min={today()} onChange={(event) => setStartDate(event.target.value)} required />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="end-date">End date</label>
                  <input id="end-date" className="field__input" type="date" value={endDate} min={startDate || today()} onChange={(event) => setEndDate(event.target.value)} required />
                </div>
              </div>
              {error && <p className="user-page__form-error" role="alert">{error}</p>}
              <button type="submit" className="btn btn--primary" disabled={submitting || listing.ownerId === user.uid}>
                {submitting ? "Checking availability..." : "Submit booking request"}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
