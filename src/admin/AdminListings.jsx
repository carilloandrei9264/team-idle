import { useEffect, useState } from "react";
import {
  collection,
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
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "listings"), (snap) => {
      const docs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((listing) => listing.verificationStatus === "pending")
        .sort((a, b) => timestampValue(a.createdAt) - timestampValue(b.createdAt));
      setPending(docs);
      setLoading(false);
      setError("");
      // Keep the current selection if it still exists; otherwise pick the first.
      setSelectedId((current) =>
        docs.some((d) => d.id === current) ? current : docs[0]?.id ?? null
      );
    }, () => {
      setLoading(false);
      setError("The review queue could not be loaded. Check your connection and Firestore index, then refresh.");
    });
    return unsubscribe;
  }, []);

  const selected = pending.find((l) => l.id === selectedId) ?? null;

  async function handleApprove() {
    if (!selected) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateDoc(doc(db, "listings", selected.id), {
        verificationStatus: "verified",
        verifiedAt: serverTimestamp(),
        verifiedBy: user?.uid ?? null,
      });
      setPending((current) => current.filter((listing) => listing.id !== selected.id));
      setMessage("Listing approved and removed from the pending review queue.");
    } catch {
      setError("The listing could not be approved. Confirm that your account has admin permissions and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReject() {
    if (!selected) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateDoc(doc(db, "listings", selected.id), {
        verificationStatus: "rejected",
        rejectionReason: rejectReason.trim() || "No reason given",
        verifiedAt: serverTimestamp(),
        verifiedBy: user?.uid ?? null,
      });
      setPending((current) => current.filter((listing) => listing.id !== selected.id));
      setRejectReason("");
      setShowRejectForm(false);
      setMessage("Listing rejected and removed from the pending review queue.");
    } catch {
      setError("The listing could not be rejected. Confirm that your account has admin permissions and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="listings-queue">
      <h1 className="listings-queue__title">Listing Review Queue</h1>

      {error && <p className="listings-queue__error" role="alert">{error}</p>}
      {message && <p className="listings-queue__message" role="status">{message}</p>}

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

                <DocumentPreview url={selected.ownershipDocumentUrl || selected.verificationDocUrl} title={selected.title} label="Ownership document" />
                {selected.governmentIdUrl && <DocumentPreview url={selected.governmentIdUrl} title={selected.title} label="Government photo ID" />}

                <p className="review-card__label">Property photos</p>
                {selected.photoUrls?.length ? (
                  <div className="review-card__photos">
                    {selected.photoUrls.map((photoUrl, index) => (
                      <img key={photoUrl} className="review-card__photo" src={photoUrl} alt={`Property photo ${index + 1}`} />
                    ))}
                  </div>
                ) : (
                  <div className="review-card__doc review-card__doc--placeholder">
                    <ImageIcon size={28} aria-hidden="true" />
                    <span>No property photos uploaded</span>
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

function DocumentPreview({ url, title, label = "Uploaded document" }) {
  if (!url) {
    return <div className="review-card__doc review-card__doc--placeholder"><ImageIcon size={28} aria-hidden="true" /><span>No document uploaded</span></div>;
  }

  const isPdf = /(?:\.pdf(?:$|[?#])|[?&]resource_type=raw)/i.test(url);
  return (
    <div className="review-card__document">
      <p className="review-card__label">{label}</p>
      {isPdf ? (
        <iframe className="review-card__pdf" src={url} title={`Ownership document for ${title || "listing"}`} />
      ) : (
        <img className="review-card__doc" src={url} alt={`Ownership/ID document uploaded for ${title || "this listing"}`} />
      )}
      <a className="review-card__document-link" href={url} target="_blank" rel="noreferrer">Open uploaded document</a>
    </div>
  );
}

function timestampValue(value) {
  return value?.toMillis?.() ?? 0;
}
