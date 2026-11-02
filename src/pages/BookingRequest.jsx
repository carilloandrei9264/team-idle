import { useEffect, useState } from "react";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import BookingAvailabilityCalendar from "../components/BookingAvailabilityCalendar";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { dateInputToTimestamp, dateInputValue, dateRangeIsValid, datesOverlap } from "../lib/booking";
import { formatCurrency } from "../lib/number";
import { createNotification, NOTIFICATION_TYPES } from "../lib/notifications";
import { firebaseAccessErrorMessage } from "../lib/uiState";
import useNetworkStatus from "../hooks/useNetworkStatus";
import { getListingAvailability } from "../services/api";
import "./UserPages.css";

export default function BookingRequest() {
  const { listingId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const isOnline = useNetworkStatus();
  const [listing, setListing] = useState(null);
  const [blockedRanges, setBlockedRanges] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const today = dateInputValue();

  useEffect(() => {
    let active = true;
    getDoc(doc(db, "listings", listingId)).then((snapshot) => {
      if (!active) return;
      if (snapshot.exists() && snapshot.data().verificationStatus === "verified" && snapshot.data().listingPurpose !== "sale") setListing({ id: snapshot.id, ...snapshot.data() });
      else if (snapshot.exists() && snapshot.data().listingPurpose === "sale") setError("This property is for sale and does not accept booking requests.");
      else setError("This verified listing could not be found.");
      setLoading(false);
    }).catch((loadError) => {
      if (!active) return;
      setError(firebaseAccessErrorMessage(loadError, "this listing"));
      setLoading(false);
    });
    return () => { active = false; };
  }, [listingId]);

  useEffect(() => {
    let active = true;
    getListingAvailability(listingId).then((result) => {
      if (!active) return;
      setBlockedRanges(Array.isArray(result.blockedRanges) ? result.blockedRanges : []);
    }).catch((loadError) => {
      if (!active) return;
      setAvailabilityError(firebaseAccessErrorMessage(loadError, "booking availability"));
    }).finally(() => {
      if (active) setAvailabilityLoading(false);
    });
    return () => { active = false; };
  }, [listingId]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!isOnline) {
      setError("No internet connection. Reconnect before submitting your booking request.");
      return;
    }
    if (startDate && listing?.availabilityDate && startDate < listing.availabilityDate) {
      setError(`This property is available from ${listing.availabilityDate}.`);
      return;
    }
    const requestedStart = new Date(`${startDate}T00:00:00`);
    const requestedEnd = new Date(`${endDate}T00:00:00`);
    if (!dateRangeIsValid(requestedStart, requestedEnd) || startDate < today) {
      setError("Choose a future start date and an end date after it.");
      return;
    }
    if (blockedRanges.some((range) => datesOverlap(
      range.start,
      range.end,
      dateInputToTimestamp(startDate),
      dateInputToTimestamp(endDate),
    ))) {
      setError("Those dates overlap a confirmed stay. Choose different dates.");
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
        listingPurpose: listing.listingPurpose || "rent",
        rentalTerm: listing.rentalTerm || (listing.pricePeriod === "day" ? "short_term" : "long_term"),
        startDate: dateInputToTimestamp(startDate),
        endDate: dateInputToTimestamp(endDate),
        price: listing.price ?? null,
        pricePeriod: listing.pricePeriod || "month",
        status: "Pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      let notificationDeliveryFailed = false;
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
      } catch {
        notificationDeliveryFailed = true;
      }
      navigate("/my-bookings", { replace: true, state: { bookingSubmitted: true, notificationDeliveryFailed } });
    } catch (submitError) {
      setError(submitError.message || "Your booking request could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  const startDateMin = listing?.availabilityDate && listing.availabilityDate > today ? listing.availabilityDate : today;

  return (
    <div className="user-page">
      <PublicNav />
      <main className="user-page__content user-page__content--form">
        <Link to={`/listings/${listingId}`} className="user-page__back"><ArrowLeft size={16} aria-hidden="true" /> Listing details</Link>
        {!isOnline && <p className="network-state network-state--offline" role="status">No internet connection. Booking availability may be out of date.</p>}
        {loading ? <p className="user-page__empty" role="status">Loading booking form...</p> : error && !listing ? (
          <div className="user-page__empty" role="alert"><h1>Booking unavailable</h1><p>{error}</p></div>
        ) : (
          <>
            <header className="user-page__header">
              <div><p className="user-page__eyebrow">Request a stay</p><h1>{listing.title}</h1><p>{formatCurrency(listing.price)} / {listing.pricePeriod || "month"}</p></div>
            </header>
            <form className="listing-form" onSubmit={handleSubmit}>
              <section className="user-page__empty listing-form__section">
                <div className="account-card__heading">
                  <CalendarDays size={20} aria-hidden="true" />
                  <div><h2>Choose your dates</h2><p>The owner will review this request before it is confirmed.</p></div>
                </div>
                <BookingAvailabilityCalendar
                  blockedRanges={blockedRanges}
                  availabilityDate={listing.availabilityDate}
                  startDate={startDate}
                  endDate={endDate}
                  onSelectDate={(nextStart, nextEnd) => {
                    setStartDate(nextStart);
                    setEndDate(nextEnd);
                    setError("");
                  }}
                  onInvalidRange={() => setError("Your selected stay includes dates already booked. Choose another range.")}
                />
                <div className="listing-form__grid">
                  <div className="field">
                    <label className="field__label" htmlFor="booking-start">Start date</label>
                    <input id="booking-start" className="field__input" type="date" min={startDateMin} value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="booking-end">End date</label>
                    <input id="booking-end" className="field__input" type="date" min={startDate || startDateMin} value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
                  </div>
                </div>
                {availabilityLoading && <p className="listing-form__hint" role="status">Loading availability…</p>}
                {availabilityError && <p className="listing-form__hint" role="alert">{availabilityError} Dates may be out of date; the owner will check for conflicts before confirming.</p>}
                {!availabilityLoading && !availabilityError && blockedRanges.length === 0 && <p className="listing-form__hint">No confirmed stays are currently marked unavailable.</p>}
              </section>
              {error && <p className="user-page__form-error" role="alert">{error}</p>}
              <button type="submit" className="btn btn--primary listing-form__submit" disabled={submitting || !isOnline}>
                {submitting ? "Submitting..." : "Submit booking request"}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
