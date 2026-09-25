import { useEffect, useState } from "react";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { dateInputToTimestamp, dateInputValue, dateRangeIsValid } from "../lib/booking";
import { formatCurrency } from "../lib/number";
import { ADMIN_NOTIFICATION_RECIPIENT, createNotification, NOTIFICATION_TYPES } from "../lib/notifications";
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
  const today = dateInputValue();

  useEffect(() => {
    getDoc(doc(db, "listings", listingId)).then((snapshot) => {
      if (snapshot.exists() && snapshot.data().verificationStatus === "verified") setListing({ id: snapshot.id, ...snapshot.data() });
      else setError("This verified listing could not be found.");
      setLoading(false);
    }).catch(() => { setError("This listing could not be loaded."); setLoading(false); });
  }, [listingId]);

  async function handleSubmit(event) {
    event.preventDefault();
    const requestedStart = new Date(`${startDate}T00:00:00`);
    const requestedEnd = new Date(`${endDate}T00:00:00`);
    if (!dateRangeIsValid(requestedStart, requestedEnd) || startDate < today) {
      setError("Choose a future start date and an end date after it.");
      return;
    }
    if (!listing || listing.ownerId === user.uid) {
      setError("You cannot request your own listing.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const bookingRef = await addDoc(collection(db, "bookings"), {
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
      try {
        await createNotification(db, {
          recipientId: listing.ownerId,
          createdBy: user.uid,
          type: NOTIFICATION_TYPES.BOOKING_REQUEST,
          title: "New booking request",
          message: `${profile?.name || user.displayName || user.email} requested ${listing.title || "your listing"}.`,
          link: "/booking-requests",
          entityId: bookingRef.id,
          entityType: "booking",
        });
        await createNotification(db, {
          recipientId: ADMIN_NOTIFICATION_RECIPIENT,
          createdBy: user.uid,
          type: NOTIFICATION_TYPES.BOOKING_REQUEST,
          title: "New booking request",
          message: `${profile?.name || user.displayName || user.email} requested ${listing.title || "a listing"}.`,
          link: "/admin",
          entityId: bookingRef.id,
          entityType: "booking",
        });
      } catch {
        // The booking remains valid if notification delivery is temporarily unavailable.
      }
      navigate("/my-bookings", { replace: true });
    } catch (submitError) {
      setError(submitError.message || "Your booking request could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="user-page"><PublicNav /><main className="user-page__content user-page__content--form"><Link to={`/listings/${listingId}`} className="user-page__back"><ArrowLeft size={16} aria-hidden="true" /> Listing details</Link>{loading ? <p className="user-page__empty">Loading booking form...</p> : error && !listing ? <div className="user-page__empty" role="alert"><h1>Booking unavailable</h1><p>{error}</p></div> : <><header className="user-page__header"><div><p className="user-page__eyebrow">Request a stay</p><h1>{listing.title}</h1><p>{formatCurrency(listing.price)} / {listing.pricePeriod || "month"}</p></div></header><form className="listing-form" onSubmit={handleSubmit}><section className="user-page__empty listing-form__section"><div className="account-card__heading"><CalendarDays size={20} aria-hidden="true" /><div><h2>Choose your dates</h2><p>The owner will review this request before it is confirmed.</p></div></div><div className="listing-form__grid"><div className="field"><label className="field__label" htmlFor="booking-start">Start date</label><input id="booking-start" className="field__input" type="date" min={today} value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></div><div className="field"><label className="field__label" htmlFor="booking-end">End date</label><input id="booking-end" className="field__input" type="date" min={startDate || today} value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></div></div></section>{error && <p className="user-page__form-error" role="alert">{error}</p>}<button type="submit" className="btn btn--primary listing-form__submit" disabled={submitting}>{submitting ? "Checking dates..." : "Submit booking request"}</button></form></>}</main></div>;
}
