import { useEffect, useState } from "react";
import { collection, doc, increment, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore";
import { Check, X } from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../context/useAuth";
import { createNotification, NOTIFICATION_TYPES } from "../lib/notifications";
import { ACCOUNT_ACTIVITY_ACTIONS, createAccountActivity } from "../lib/accountActivity";
import { isCloudinaryImageUrl } from "../uploadImage";
import "./AdminData.css";

export default function AdminDisputes() {
  const { user } = useAuth();
  const [disputes, setDisputes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return onSnapshot(
      collection(db, "disputes"),
      (snapshot) => {
        const next = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .filter((item) => String(item.status || "Open").toLowerCase() === "open")
          .sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt));
        setDisputes(next);
        setSelectedId((current) => (next.some((item) => item.id === current) ? current : next[0]?.id ?? null));
        setLoading(false);
        setError("");
      },
      () => {
        setLoading(false);
        setError("We could not load open disputes. Check your connection and permissions.");
      }
    );
  }, []);

  const selected = disputes.find((item) => item.id === selectedId) ?? null;

  async function resolve(status) {
    if (!selected) return;
    if (resolutionNotes.trim().length < 10) {
      setError("Add at least 10 characters of resolution notes.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const batch = writeBatch(db);
      const nextBookingStatus = status === "Dismissed" ? (selected.priorStatus || "Confirmed") : "Disputed";

      batch.update(doc(db, "disputes", selected.id), {
        status,
        resolutionNotes: resolutionNotes.trim(),
        resolvedAt: serverTimestamp(),
        resolvedBy: user?.uid ?? null,
      });
      batch.update(doc(db, "bookings", selected.bookingId), {
        status: nextBookingStatus,
        resolvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (status === "Founded" && selected.ownerId) {
        batch.set(doc(db, "publicAccountability", selected.ownerId), {
          foundedDisputes: increment(1),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      await batch.commit();
      try {
        await createAccountActivity(db, {
          actorId: user.uid,
          actorRole: "admin",
          targetUserId: selected.raisedBy,
          entityType: "dispute",
          entityId: selected.id,
          action: ACCOUNT_ACTIVITY_ACTIONS.DISPUTE_RESOLVED,
          summary: `Dispute ${status.toLowerCase()}`,
          details: { bookingId: selected.bookingId, ownerId: selected.ownerId },
        });
      } catch {
        // Activity logging is non-blocking for dispute resolution.
      }
      try {
        await createNotification(db, {
          recipientId: selected.raisedBy,
          createdBy: user?.uid,
          type: NOTIFICATION_TYPES.DISPUTE_UPDATE,
          title: status === "Founded" ? "Dispute founded" : "Dispute dismissed",
          message: status === "Founded"
            ? "Your report was founded. The responsible account has been flagged."
            : "Your report was reviewed and dismissed by the TrustHome team.",
          link: "/my-bookings",
          entityId: selected.bookingId,
          entityType: "booking",
        });
      } catch {
        // The dispute resolution remains valid if notification delivery is unavailable.
      }
      try {
        await createNotification(db, {
          recipientId: selected.ownerId,
          createdBy: user.uid,
          type: NOTIFICATION_TYPES.DISPUTE_UPDATE,
          title: "Dispute reviewed",
          message: status === "Founded"
            ? "A dispute involving your listing was reviewed and founded by TrustHome."
            : "A dispute involving your listing was reviewed and dismissed by TrustHome.",
          link: "/booking-requests",
          entityId: selected.bookingId,
          entityType: "booking",
        });
      } catch {
        // The dispute resolution remains valid if notification delivery is unavailable.
      }
      setResolutionNotes("");
    } catch {
      setError("The dispute could not be updated. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h1 className="admin-page__title">Dispute Review Queue</h1>
          <p className="admin-page__description">Review reported booking issues and record a resolution.</p>
        </div>
      </header>
      {error && <p className="admin-page__error" role="alert">{error}</p>}
      {loading ? (
        <div className="admin-data-card admin-empty">Loading open disputes...</div>
      ) : disputes.length === 0 ? (
        <div className="admin-data-card admin-empty">No open disputes right now.</div>
      ) : (
        <div className="admin-split">
          <section className="admin-data-card admin-review-card" aria-labelledby="selected-dispute-title">
            <div className="admin-review-card__header">
              <span className="badge badge--pending">OPEN</span>
              <h2 className="admin-review-card__title" id="selected-dispute-title">
                {selected?.bookingTitle || selected?.title || `Booking #${selected?.bookingId || selected?.id}`}
              </h2>
              <p className="admin-review-card__meta">
                Raised by {selected?.raisedByName || selected?.userName || selected?.raisedBy || "Unknown user"}
              </p>
            </div>
            <p className="admin-review-card__label">Report details</p>
            <blockquote className="admin-review-card__quote">
              {selected?.reason || selected?.description || "No report details were provided."}
            </blockquote>
            {Array.isArray(selected?.evidenceUrls) && selected.evidenceUrls.length > 0 && (
              <DisputeEvidence key={selected.id} dispute={selected} />
            )}
            <label className="admin-review-card__label" htmlFor="resolutionNotes">Resolution notes</label>
            <textarea
              id="resolutionNotes"
              className="admin-review-card__field"
              rows={2}
              value={resolutionNotes}
              onChange={(event) => setResolutionNotes(event.target.value)}
              placeholder="Add context for the resolution..."
            />
            <div className="admin-review-card__actions">
              <button type="button" className="btn btn--danger" onClick={() => resolve("Founded")} disabled={saving || resolutionNotes.trim().length < 10}>
                <Check size={16} aria-hidden="true" /> Mark Founded
              </button>
              <button type="button" className="btn btn--secondary" onClick={() => resolve("Dismissed")} disabled={saving || resolutionNotes.trim().length < 10}>
                <X size={16} aria-hidden="true" /> Dismiss
              </button>
            </div>
          </section>
          <aside className="admin-data-card admin-side-list">
            <h2 className="admin-side-list__title">Other open disputes ({Math.max(disputes.length - 1, 0)})</h2>
            <ul className="admin-side-list__items">
              {disputes.filter((item) => item.id !== selectedId).map((item) => (
                <li key={item.id}>
                  <button type="button" className="admin-side-list__item" onClick={() => setSelectedId(item.id)}>
                    <span>{item.bookingTitle || `Booking #${item.bookingId || item.id}`}</span>
                    <span className="badge badge--pending">open</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </div>
  );
}

function DisputeEvidence({ dispute }) {
  const photos = dispute.evidenceUrls.filter(isCloudinaryImageUrl).slice(0, 5);

  return (
    <section className="admin-review-card__evidence">
      <p className="admin-review-card__label">Photo evidence</p>
      {photos.length === 0 ? <p>No supported Cloudinary photos are attached.</p> : (
        <div className="admin-review-card__evidence-grid">
          {photos.map((url, index) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" aria-label={`Open evidence photo ${index + 1}`}>
              <img src={url} alt={`Dispute evidence ${index + 1}`} />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function timestampValue(value) {
  return value?.toMillis?.() ?? 0;
}
