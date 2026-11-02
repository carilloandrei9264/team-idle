import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import BookingAvailabilityCalendar from "../components/BookingAvailabilityCalendar";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { createAccountActivity } from "../lib/accountActivity";
import { dateInputValue, dateRangeIsValid, dateTimeInputToTimestamp, datesOverlap, getBookingReference, hasRenterBookingConflict } from "../lib/booking";
import { formatCurrency } from "../lib/number";
import { createNotification, NOTIFICATION_TYPES } from "../lib/notifications";
import { firebaseAccessErrorMessage } from "../lib/uiState";
import useNetworkStatus from "../hooks/useNetworkStatus";
import "./UserPages.css";

export default function BookingRequest() {
  const { listingId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const isOnline = useNetworkStatus();
  const [listing, setListing] = useState(null);
  const [availabilityState, setAvailabilityState] = useState({
    listingId: null,
    loading: true,
    unavailable: false,
    blockedRanges: [],
  });
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const today = dateInputValue();
  const startDateMin = listing?.availabilityDate && listing.availabilityDate > today
    ? listing.availabilityDate
    : today;
  const currentAvailability = availabilityState.listingId === listingId ? availabilityState : null;
  const availabilityLoading = !currentAvailability || currentAvailability.loading;
  const availabilityUnavailable = currentAvailability?.unavailable || false;
  const blockedRanges = currentAvailability?.blockedRanges || [];

  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, "listings", listingId)).then((snapshot) => {
      if (cancelled) return;
      if (snapshot.exists() && snapshot.data().verificationStatus === "verified" && snapshot.data().listingPurpose !== "sale") setListing({ id: snapshot.id, ...snapshot.data() });
      else if (snapshot.exists() && snapshot.data().listingPurpose === "sale") setError("This property is for sale and does not accept booking requests.");
      else setError("This verified listing could not be found.");
      setLoading(false);
    }).catch((loadError) => {
      if (cancelled) return;
      setError(firebaseAccessErrorMessage(loadError, "this listing"));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [listingId]);

  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, "listingAvailability", listingId)).then((snapshot) => {
      if (cancelled) return;
      const ranges = snapshot.exists() && Array.isArray(snapshot.data().blocked) ? snapshot.data().blocked : [];
      setAvailabilityState({
        listingId,
        loading: false,
        unavailable: false,
        blockedRanges: ranges.filter((range) => range?.start?.toDate?.() && range?.end?.toDate?.() && range.end.toDate() > new Date()),
      });
    }).catch(() => {
      if (cancelled) return;
      setAvailabilityState({ listingId, loading: false, unavailable: true, blockedRanges: [] });
    });
    return () => { cancelled = true; };
  }, [listingId]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!isOnline) {
      setError("No internet connection. Reconnect before submitting your booking request.");
      return;
    }
    if (listing?.availabilityDate && startDate < listing.availabilityDate) {
      setError(`This property is available from ${listing.availabilityDate}.`);
      return;
    }
    const requestedStart = dateTimeInputToTimestamp(startDate, startTime);
    const requestedEnd = dateTimeInputToTimestamp(endDate, endTime);
    if (!requestedStart || !requestedEnd
      || !dateRangeIsValid(requestedStart.toDate(), requestedEnd.toDate())
      || requestedStart.toDate() <= new Date()) {
      setError("Choose a future check-in date and time, and a check-out after it. Times use Philippine time.");
      return;
    }
    if (blockedRanges.some((range) => datesOverlap(range.start, range.end, requestedStart, requestedEnd))) {
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
      const existingBookings = await getDocs(query(
        collection(db, "bookings"),
        where("renterId", "==", user.uid),
        where("listingId", "==", listingId)
      ));
      if (hasRenterBookingConflict(
        existingBookings.docs.map((item) => item.data()),
        requestedStart,
        requestedEnd
      )) {
        throw new Error("You already have a pending or active booking that overlaps this listing's dates.");
      }

      const bookingRef = doc(collection(db, "bookings"));
      await setDoc(bookingRef, {
        listingId,
        listingTitle: listing.title || "Untitled listing",
        listingPhotoUrl: listing.photoUrls?.[0] || null,
        ownerId: listing.ownerId,
        ownerName: listing.ownerName || "Property owner",
        renterId: user.uid,
        renterName: profile?.name || user.displayName || "TrustHome member",
        listingPurpose: listing.listingPurpose || "rent",
        rentalTerm: listing.rentalTerm || (listing.pricePeriod === "day" ? "short_term" : "long_term"),
        startDate: requestedStart,
        endDate: requestedEnd,
        bookingTimeZone: "Asia/Manila",
        price: listing.price ?? null,
        pricePeriod: listing.pricePeriod || "month",
        status: "Pending",
        bookingReference: getBookingReference({ id: bookingRef.id }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      try {
        await createAccountActivity(db, {
          actorId: user.uid,
          actorRole: profile?.role || "user",
          targetUserId: user.uid,
          entityType: "booking",
          entityId: bookingRef.id,
          action: "booking_requested",
          summary: "Booking request submitted",
          details: { listingId, listingTitle: listing.title || "Untitled listing" },
        });
      } catch {
        // Activity logging is non-blocking for the booking flow.
      }
      try {
        await createNotification(db, {
          recipientId: listing.ownerId,
          createdBy: user.uid,
          type: NOTIFICATION_TYPES.BOOKING_REQUEST,
          title: "New booking request",
          message: `${profile?.name || user.displayName || "A TrustHome member"} requested ${listing.title || "your listing"}.`,
          link: "/booking-requests",
          entityId: bookingRef.id,
          entityType: "booking",
        });
      } catch {
        // The booking remains valid if notification delivery is temporarily unavailable.
      }
      navigate("/my-bookings", { replace: true, state: { bookingSubmitted: true } });
    } catch (submitError) {
      setError(submitError.code
        ? firebaseAccessErrorMessage(submitError, "your booking request")
        : submitError.message || "Your booking request could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="user-page">
      <PublicNav />
      <main className="user-page__content user-page__content--form">
        <Link to={`/listings/${listingId}`} className="user-page__back"><ArrowLeft size={16} aria-hidden="true" /> Listing details</Link>
        {!isOnline && <p className="network-state network-state--offline" role="status">No internet connection. Booking availability may be out of date.</p>}
        {loading ? <p className="user-page__empty">Loading booking form...</p> : error && !listing ? (
          <div className="user-page__empty" role="alert"><h1>Booking unavailable</h1><p>{error}</p></div>
        ) : (
          <>
            <header className="user-page__header">
              <div><p className="user-page__eyebrow">Request a stay</p><h1>{listing.title}</h1><p>{formatCurrency(listing.price)} / {listing.pricePeriod || "month"}</p></div>
            </header>
            <form className="listing-form" onSubmit={handleSubmit} aria-describedby={error ? "booking-form-error" : undefined}>
              <section className="user-page__empty listing-form__section">
                <div className="account-card__heading">
                  <CalendarDays size={20} aria-hidden="true" />
                  <div><h2>Choose your stay</h2><p>Select check-in and check-out times in Philippine time.</p></div>
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
                />
                <div className="listing-form__grid">
                  <div className="field">
                    <label className="field__label" htmlFor="booking-start">Check-in date and time (PHT)</label>
                    <input
                      id="booking-start"
                      className="field__input"
                      type="datetime-local"
                      min={`${startDateMin}T00:00`}
                      step="60"
                      value={startDate && startTime ? `${startDate}T${startTime}` : ""}
                      onChange={(event) => {
                        const [date = "", time = ""] = event.target.value.split("T");
                        setStartDate(date);
                        setStartTime(time);
                        setError("");
                      }}
                      required
                    />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="booking-end">Check-out date and time (PHT)</label>
                    <input
                      id="booking-end"
                      className="field__input"
                      type="datetime-local"
                      min={startDate && startTime ? `${startDate}T${startTime}` : `${startDate || today}T00:00`}
                      step="60"
                      value={endDate && endTime ? `${endDate}T${endTime}` : ""}
                      onChange={(event) => {
                        const [date = "", time = ""] = event.target.value.split("T");
                        setEndDate(date);
                        setEndTime(time);
                        setError("");
                      }}
                      required
                    />
                  </div>
                </div>
                {availabilityLoading && <p className="listing-form__hint" role="status">Loading availability…</p>}
                {availabilityUnavailable && <p className="listing-form__hint" role="alert">Availability could not be loaded. Dates may be out of date; the owner will recheck for conflicts before confirming.</p>}
                {!availabilityLoading && !availabilityUnavailable && blockedRanges.length === 0 && <p className="listing-form__hint">No confirmed stays are currently marked unavailable.</p>}
              </section>
              {error && <p id="booking-form-error" className="user-page__form-error" role="alert">{error}</p>}
              <button type="submit" className="btn btn--primary listing-form__submit" disabled={submitting || !isOnline}>
                {submitting ? "Checking dates..." : "Submit booking request"}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
