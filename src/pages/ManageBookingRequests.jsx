import { useEffect, useState } from "react";
import { collection, doc, getDocs, onSnapshot, query, updateDoc, serverTimestamp, where } from "firebase/firestore";
import { Check, X } from "lucide-react";
import PublicNav from "../components/PublicNav";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { hasConfirmedConflict, toDate } from "../lib/booking";
import "./UserPages.css";

export default function ManageBookingRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => onSnapshot(
    query(collection(db, "bookings"), where("ownerId", "==", user.uid), where("status", "==", "Pending")),
    (snapshot) => {
      setRequests(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setLoading(false);
    },
    () => {
      setError("Booking requests could not be loaded.");
      setLoading(false);
    }
  ), [user.uid]);

  async function updateRequest(request, status) {
    setError("");
    setMessage("");
    try {
      if (status === "Confirmed") {
        const ownerSnapshot = await getDocs(query(collection(db, "bookings"), where("ownerId", "==", user.uid)));
        const confirmedBookings = ownerSnapshot.docs
          .filter((item) => item.id !== request.id && item.data().listingId === request.listingId && item.data().status === "Confirmed")
          .map((item) => item.data());
        if (hasConfirmedConflict(confirmedBookings, request.startDate, request.endDate)) throw new Error("BOOKING_CONFLICT");
        await updateDoc(doc(db, "bookings", request.id), { status, updatedAt: serverTimestamp(), confirmedAt: serverTimestamp() });
        setMessage("Booking request confirmed.");
      } else {
        await updateDoc(doc(db, "bookings", request.id), { status, updatedAt: serverTimestamp() });
        setMessage("Booking request declined.");
      }
    } catch (updateError) {
      const code = updateError?.code ? ` (${updateError.code})` : "";
      setError(updateError.message === "BOOKING_CONFLICT" ? "This request overlaps an existing confirmed booking." : `${updateError.message || "The booking request could not be updated."}${code}`);
    }
  }

  return (
    <div className="user-page">
      <PublicNav />
      <main className="user-page__content">
        <header className="user-page__header"><div><p className="user-page__eyebrow">Owner tools</p><h1>Booking Requests</h1><p>Confirm one request only after checking its dates against existing stays.</p></div></header>
        {error && <p className="user-page__form-error" role="alert">{error}</p>}
        {message && <p className="user-page__message" role="status">{message}</p>}
        {loading ? <p className="user-page__empty">Loading requests...</p> : requests.length === 0 ? <div className="user-page__empty"><h2>No pending requests</h2><p>New renter requests for your verified listings will appear here.</p></div> : (
          <div className="user-page__list">{requests.map((request) => <RequestItem key={request.id} request={request} onUpdate={updateRequest} />)}</div>
        )}
      </main>
    </div>
  );
}

function RequestItem({ request, onUpdate }) {
  const [saving, setSaving] = useState(false);
  async function update(status) {
    setSaving(true);
    await onUpdate(request, status);
    setSaving(false);
  }
  return (
    <article className="user-page__item booking-item">
      <div className="user-page__item-link"><h2>{request.listingTitle || "Listing"}</h2><p>{formatDate(request.startDate)} to {formatDate(request.endDate)}</p><p>Renter: {request.renterId}</p></div>
      <div className="booking-item__actions"><button type="button" className="btn btn--primary" onClick={() => update("Confirmed")} disabled={saving}><Check size={15} aria-hidden="true" /> Confirm</button><button type="button" className="btn btn--secondary" onClick={() => update("Cancelled")} disabled={saving}><X size={15} aria-hidden="true" /> Decline</button></div>
    </article>
  );
}

function formatDate(value) {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date) : "Date unavailable";
}
