import { useEffect, useState } from "react";
import { collection, doc, increment, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore";
import { Check, X } from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../context/useAuth";
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
    setSaving(true);
    setError("");
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "disputes", selected.id), {
        status,
        resolutionNotes: resolutionNotes.trim() || null,
        resolvedAt: serverTimestamp(),
        resolvedBy: user?.uid ?? null,
      });
      if (status === "Founded" && selected.ownerId) {
        batch.set(doc(db, "publicAccountability", selected.ownerId), {
          foundedDisputes: increment(1),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      await batch.commit();
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
              <button type="button" className="btn btn--danger" onClick={() => resolve("Founded")} disabled={saving}>
                <Check size={16} aria-hidden="true" /> Mark Founded
              </button>
              <button type="button" className="btn btn--secondary" onClick={() => resolve("Dismissed")} disabled={saving}>
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

function timestampValue(value) {
  return value?.toMillis?.() ?? 0;
}
