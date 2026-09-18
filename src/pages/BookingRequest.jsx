import { useEffect, useState } from "react";
import { addDoc, collection, doc, getDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { bookingDatesOverlap, dateInputToTimestamp, dateRangeIsValid } from "../lib/booking";
import { formatCurrency } from "../lib/number";
import "./UserPages.css";

export default function BookingRequest() {
  const { listingId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getDoc(doc(db, "listings", listingId)).then((snapshot) => {
      if (snapshot.exists()) setListing({ id: snapshot.id, ...snapshot.data() });
      else setError("This listing could not be found.");
      setLoading(false);
    }).catch(() => {
      setError("This listing could not be loaded.");
      setLoading(false);
    });
  }, [listingId]);

  async function handleSubmit(event) {
    event.preventDefault();
    const requestedStart = new Date(`${startDate}T00:00:00`);
    const requestedEnd = new Date(`${endDate}T00:00:00`);
    if (!dateRangeIsValid(requestedStart, requestedEnd)) {
      setError("Choose an end date after the start date.");
      return;
    }
    if (!listing || listing.ownerId === user.uid) {
      setError("You cannot request your own listing.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const existingSnapshot = await getDocs(query(
        collection(db, "bookings"),
        where("listingId", "==", listingId),
        where("status", "in", ["Pending", "Confirmed"])
      ));
      const hasConflict = existingSnapshot.docs.some((item) => bookingDatesOverlap(item.data(), requestedStart, requestedEnd));
      if (hasConflict) {
        setError("These dates are unavailable. Choose another range.");
        return;
      }

      await addDoc(collection(db, "bookings"), {
        listingId,
        listingTitle: listing.title || "Untitled listing",
        listingPhotoUrl: listing.photoUrls?.[0] || null,
        ownerId: listing.ownerId,
        ownerName: listing.ownerName || "Property owner",
        renterId: user.uid,
        renterName: profile?.name || user.displayName || user.email,
        startDate: dateInputToTimestamp(startDate),
        endDate: dateInputToTimestamp(endDate),
        price: listing.price ?? null,
        pricePeriod: listing.pricePeriod || "month",
        status: "Pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      navigate("/my-bookings", { replace: true });
    } catch {
      setError("Your booking request could not be submitted. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="user-page">
      <PublicNav />
      <main className="user-page__content user-page__content--form">
        <Link to={`/listings/${listingId}`} className="user-page__back"><ArrowLeft size={16} aria-hidden="true" /> Listing details</Link>
        {loading ? <p className="user-page__empty">Loading booking form...</p> : error && !listing ? <div className="user-page__empty" role="alert"><h1>Booking unavailable</h1><p>{error}</p></div> : (
          <>
            <header className="user-page__header"><div><p className="user-page__eyebrow">Request a stay</p><h1>{listing?.title}</h1><p>{formatCurrency(listing?.price)} / {listing?.pricePeriod || "month"}</p></div></header>
            <form className="listing-form" onSubmit={handleSubmit}>
              <section className="user-page__empty listing-form__section">
                <div className="account-card__heading"><CalendarDays size={20} aria-hidden="true" /><div><h2>Choose your dates</h2><p>The owner will review this request before it is confirmed.</p></div></div>
                <div className="listing-form__grid">
                  <div className="field"><label className="field__label" htmlFor="booking-start">Start date</label><input id="booking-start" className="field__input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></div>
                  <div className="field"><label className="field__label" htmlFor="booking-end">End date</label><input id="booking-end" className="field__input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></div>
                </div>
              </section>
              {error && <p className="user-page__form-error" role="alert">{error}</p>}
              <button type="submit" className="btn btn--primary listing-form__submit" disabled={submitting}>{submitting ? "Checking dates..." : "Submit booking request"}</button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
