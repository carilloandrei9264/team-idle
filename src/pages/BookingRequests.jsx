import { useEffect, useState } from "react";
import { collection, doc, getDocs, onSnapshot, query, updateDoc, serverTimestamp, where } from "firebase/firestore";
import PublicNav from "../components/PublicNav";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { bookingDatesOverlap, formatBookingDate } from "../lib/booking";
import "./UserPages.css";

export default function BookingRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => onSnapshot(
    query(collection(db, "bookings"), where("ownerId", "==", user.uid)),
    (snapshot) => {
      setRequests(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort(sortByCreatedAt));
      setLoading(false);
    },
    () => { setError("Booking requests could not be loaded."); setLoading(false); }
  ), [user.uid]);

  async function decide(request, status) {
    setSavingId(request.id);
    setError("");
    setMessage("");
    try {
      if (status === "Confirmed") {
        const ownerBookings = await getDocs(query(collection(db, "bookings"), where("ownerId", "==", user.uid)));
        const conflict = ownerBookings.docs
          .filter((item) => item.id !== request.id && item.data().listingId === request.listingId && item.data().status === "Confirmed")
          .some((item) => bookingDatesOverlap(item.data(), request.startDate.toDate(), request.endDate.toDate()));
        if (conflict) throw new Error("Those dates were confirmed for another renter first.");

        await updateDoc(doc(db, "bookings", request.id), {
          status,
          updatedAt: serverTimestamp(),
          confirmedAt: serverTimestamp(),
        });
        setMessage("Booking request confirmed.");
        return;
      }

      await updateDoc(doc(db, "bookings", request.id), {
        status,
        updatedAt: serverTimestamp(),
      });
      setMessage("Booking request declined.");
    } catch (decisionError) {
      const code = decisionError?.code ? ` (${decisionError.code})` : "";
      setError(`${decisionError.message || "The booking request could not be updated."}${code}`);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="user-page">
      <PublicNav />
      <main className="user-page__content">
        <header className="user-page__header">
          <div>
            <p className="user-page__eyebrow">Owner tools</p>
            <h1>Booking Requests</h1>
            <p>Confirm one request only after checking its dates against existing stays.</p>
          </div>
        </header>
        {error && <p className="user-page__form-error" role="alert">{error}</p>}
        {message && <p className="user-page__message" role="status">{message}</p>}
        {loading ? <p className="user-page__empty">Loading booking requests...</p> : requests.length === 0 ? (
          <div className="user-page__empty"><h2>No booking requests</h2><p>Requests from renters will appear here.</p></div>
        ) : (
          <div className="user-page__list">
            {requests.map((request) => (
              <article className="user-page__item booking-item" key={request.id}>
                <div>
                  <h2>{request.listingTitle || "Listing"}</h2>
                  <p>{formatBookingDate(request.startDate)} to {formatBookingDate(request.endDate)}</p>
                  <p className="user-page__item-meta">Renter: {request.renterName || "TrustHome user"}</p>
                </div>
                <div className="booking-item__actions">
                  <span className={`badge badge--${statusTone(request.status)}`}>{request.status}</span>
                  {request.status === "Pending" && <>
                    <button type="button" className="btn btn--primary" onClick={() => decide(request, "Confirmed")} disabled={savingId === request.id}>Approve</button>
                    <button type="button" className="btn btn--danger" onClick={() => decide(request, "Declined")} disabled={savingId === request.id}>Decline</button>
                  </>}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function sortByCreatedAt(a, b) { return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0); }
function statusTone(status) { return status === "Confirmed" || status === "Completed" ? "verified" : status === "Declined" || status === "Cancelled" ? "danger" : "pending"; }
