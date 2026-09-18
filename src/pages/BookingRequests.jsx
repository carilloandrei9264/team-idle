import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, runTransaction, updateDoc, serverTimestamp, where } from "firebase/firestore";
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

  useEffect(() => onSnapshot(
    query(collection(db, "bookings"), where("ownerId", "==", user.uid)),
    (snapshot) => { setRequests(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort(sortByCreatedAt)); setLoading(false); },
    () => { setError("Booking requests could not be loaded."); setLoading(false); }
  ), [user.uid]);

  async function decide(request, status) {
    setSavingId(request.id);
    setError("");
    try {
      if (status === "Confirmed") {
        await runTransaction(db, async (transaction) => {
          const requestRef = doc(db, "bookings", request.id);
          const requestSnapshot = await transaction.get(requestRef);
          const listingBookings = await transaction.get(query(collection(db, "bookings"), where("listingId", "==", request.listingId)));
          if (!requestSnapshot.exists() || requestSnapshot.data().status !== "Pending") throw new Error("This booking request is no longer pending.");
          const conflict = listingBookings.docs
            .filter((item) => item.id !== request.id && item.data().status === "Confirmed")
            .some((item) => bookingDatesOverlap(item.data(), request.startDate.toDate(), request.endDate.toDate()));
          if (conflict) throw new Error("Those dates were confirmed for another renter first.");
          transaction.update(requestRef, { status, updatedAt: serverTimestamp(), confirmedAt: serverTimestamp() });
        });
        return;
      }
      await updateDoc(doc(db, "bookings", request.id), { status, updatedAt: serverTimestamp(), ...(status === "Confirmed" ? { confirmedAt: serverTimestamp() } : {}) });
    } catch (decisionError) {
      setError(decisionError.message || "The booking request could not be updated.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="user-page">
      <PublicNav />
      <main className="user-page__content">
        <header className="user-page__header"><div><p className="user-page__eyebrow">Owner tools</p><h1>Booking Requests</h1><p>Review requests for the listings you manage.</p></div></header>
        {error && <p className="user-page__form-error" role="alert">{error}</p>}
        {loading ? <p className="user-page__empty">Loading booking requests...</p> : requests.length === 0 ? <div className="user-page__empty"><h2>No booking requests</h2><p>Requests from renters will appear here.</p></div> : <div className="user-page__list">{requests.map((request) => <article className="user-page__item booking-item" key={request.id}><div><h2>{request.listingTitle || "Listing"}</h2><p>{formatBookingDate(request.startDate)} to {formatBookingDate(request.endDate)}</p><p className="user-page__item-meta">Renter: {request.renterName || "TrustHome user"}</p></div><div className="booking-item__actions"><span className={`badge badge--${statusTone(request.status)}`}>{request.status}</span>{request.status === "Pending" && <><button type="button" className="btn btn--primary" onClick={() => decide(request, "Confirmed")} disabled={savingId === request.id}>Approve</button><button type="button" className="btn btn--danger" onClick={() => decide(request, "Declined")} disabled={savingId === request.id}>Decline</button></>}</div></article>)}</div>}
      </main>
    </div>
  );
}

function sortByCreatedAt(a, b) { return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0); }
function statusTone(status) { return status === "Confirmed" || status === "Completed" ? "verified" : status === "Declined" || status === "Cancelled" ? "danger" : "pending"; }
