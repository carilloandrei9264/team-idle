import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/useAuth";
import { Check, X, Image as ImageIcon } from "lucide-react";
import "./AdminListings.css";

export default function AdminListings() {
  const { user } = useAuth();
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "listings"),
      where("verificationStatus", "==", "pending"),
      orderBy("createdAt", "asc")
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPending(docs);
      setLoading(false);
      // Keep the current selection if it still exists; otherwise pick the first.
      setSelectedId((current) =>
        docs.some((d) => d.id === current) ? current : docs[0]?.id ?? null
      );
    });
    return unsubscribe;
  }, []);

  const selected = pending.find((l) => l.id === selectedId) ?? null;

  async function handleApprove() {
    if (!selected) return;
    setSaving(true);
    await updateDoc(doc(db, "listings", selected.id), {
      verificationStatus: "verified",
      verifiedAt: serverTimestamp(),
      verifiedBy: user?.uid ?? null,
    });
    setSaving(false);
  }

  async function handleReject() {
    if (!selected) return;
    setSaving(true);
    await updateDoc(doc(db, "listings", selected.id), {
      verificationStatus: "rejected",
      rejectionReason: rejectReason.trim() || "No reason given",
      verifiedAt: serverTimestamp(),
      verifiedBy: user?.uid ?? null,
    });
    setRejectReason("");
    setShowRejectForm(false);
    setSaving(false);
  }

  return (
    <div className="listings-queue">
      <h1 className="listings-queue__title">Listing Review Queue</h1>

      {loading ? (
        <p className="panel__empty">Loading…</p>
      ) : pending.length === 0 ? (
        <div className="panel listings-queue__empty">
          <p className="panel__empty">No listings waiting for review right now.</p>
        </div>
      ) : (
        <div className="listings-queue__layout">
          <section className="panel review-card">
            {selected && (
              <>
                <div className="review-card__header">
                  <h2 className="review-card__title">{selected.title || "Untitled listing"}</h2>
                  <p className="review-card__meta">Submitted by {selected.ownerName || selected.ownerId}</p>
                </div>

                <p className="review-card__label">Uploaded ID document</p>
                {selected.verificationDocUrl ? (
                  <img
                    className="review-card__doc"
                    src={selected.verificationDocUrl}
                    alt={`Ownership/ID document uploaded for ${selected.title || "this listing"}`}
                  />
                ) : (
                  <div className="review-card__doc review-card__doc--placeholder">
                    <ImageIcon size={28} aria-hidden="true" />
                    <span>No document uploaded</span>
                  </div>
                )}

                <div className="review-card__match">
                  <span className="review-card__match-label">Account name on file:</span>
                  <span className="badge badge--verified">{selected.ownerName || "Unknown"}</span>
                  <span className="review-card__match-hint">Compare against the document above</span>
                </div>

                {!showRejectForm ? (
                  <div className="review-card__actions">
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={handleApprove}
                      disabled={saving}
                    >
                      <Check size={16} aria-hidden="true" />
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger"
                      onClick={() => setShowRejectForm(true)}
                      disabled={saving}
                    >
                      <X size={16} aria-hidden="true" />
                      Reject
                    </button>
                  </div>
                ) : (
                  <div className="review-card__reject-form">
                    <label className="field__label" htmlFor="rejectReason">
                      Reason for rejection
                    </label>
                    <textarea
                      id="rejectReason"
                      className="review-card__textarea"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="e.g. Name on document doesn't match account"
                      rows={3}
                    />
                    <div className="review-card__actions">
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={handleReject}
                        disabled={saving}
                      >
                        Confirm reject
                      </button>
                      <button
                        type="button"
                        className="btn btn--secondary"
                        onClick={() => setShowRejectForm(false)}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <aside className="panel up-next">
            <h2 className="panel__title">Up next ({pending.length - 1 >= 0 ? pending.length - 1 : 0})</h2>
            <ul className="up-next__list">
              {pending
                .filter((l) => l.id !== selectedId)
                .map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      className="up-next__item"
                      onClick={() => {
                        setSelectedId(l.id);
                        setShowRejectForm(false);
                      }}
                    >
                      {l.title || "Untitled listing"} <span className="badge badge--pending">pending</span>
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
