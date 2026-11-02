import { useEffect, useState } from "react";
import { collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { ArrowLeft, X } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { hasOpenDisputeForBooking, isDisputableBookingStatus, isValidDisputeReason, normalizeDisputeReason } from "../lib/dispute";
import { ADMIN_NOTIFICATION_RECIPIENT, createNotification, NOTIFICATION_TYPES } from "../lib/notifications";
import { ACCOUNT_ACTIVITY_ACTIONS, createAccountActivity } from "../lib/accountActivity";
import { uploadToCloudinary } from "../uploadImage";
import "./UserPages.css";

const MAX_EVIDENCE_FILES = 5;
const MAX_EVIDENCE_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_EVIDENCE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function RaiseDispute() {
  const { bookingId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [reason, setReason] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDisputeContext() {
      try {
        const [bookingSnapshot, disputeSnapshot] = await Promise.all([
          getDocs(query(collection(db, "bookings"), where("renterId", "==", user.uid))),
          getDocs(query(collection(db, "disputes"), where("raisedBy", "==", user.uid))),
        ]);
        const item = bookingSnapshot.docs.find((entry) => entry.id === bookingId);
        const userDisputes = disputeSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));

        if (!item || !isDisputableBookingStatus(item.data().status)) {
          setError("This booking cannot be disputed.");
        } else {
          setBooking({ id: item.id, ...item.data() });
          if (hasOpenDisputeForBooking(userDisputes, bookingId)) {
            setError("An open dispute already exists for this booking.");
          }
        }
      } catch {
        setError("The booking could not be loaded.");
      } finally {
        setLoading(false);
      }
    }

    loadDisputeContext();
  }, [bookingId, user.uid]);

  function handleEvidenceSelection(event) {
    const selectedFiles = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = "";
    if (evidenceFiles.length + selectedFiles.length > MAX_EVIDENCE_FILES) {
      setError(`Attach up to ${MAX_EVIDENCE_FILES} photos.`);
      return;
    }
    if (selectedFiles.some((file) => !ACCEPTED_EVIDENCE_TYPES.includes(file.type))) {
      setError("Evidence must be a JPEG, PNG, or WebP image.");
      return;
    }
    if (selectedFiles.some((file) => file.size > MAX_EVIDENCE_FILE_SIZE)) {
      setError("Each evidence photo must be 5 MB or smaller.");
      return;
    }
    setError("");
    setEvidenceFiles((current) => [
      ...current,
      ...selectedFiles.map((file) => ({ id: globalThis.crypto.randomUUID(), file })),
    ]);
  }

  function removeEvidenceFile(fileId) {
    setEvidenceFiles((current) => current.filter((item) => item.id !== fileId));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!isValidDisputeReason(reason)) { setError("Please provide at least a short description of what happened."); return; }
    setSaving(true);
    setError("");
    let submissionStage = evidenceFiles.length > 0 ? "uploading evidence" : "saving dispute";
    setSubmitStatus(evidenceFiles.length > 0 ? `Uploading photo 1 of ${evidenceFiles.length}...` : "Saving dispute...");
    const uploadedUrls = [];
    try {
      const priorStatus = booking.status;
      const disputeRef = doc(collection(db, "disputes"));
      for (let index = 0; index < evidenceFiles.length; index += 1) {
        setSubmitStatus(`Uploading photo ${index + 1} of ${evidenceFiles.length}...`);
        uploadedUrls.push(await uploadToCloudinary(evidenceFiles[index].file, "image", {
          assetFolder: `trusthome/dispute-evidence/${bookingId}`,
          tags: ["trusthome", "dispute-evidence"],
        }));
      }
      submissionStage = "saving dispute";
      setSubmitStatus("Saving dispute...");
      const batch = writeBatch(db);
      batch.set(disputeRef, {
        bookingId,
        bookingTitle: booking.listingTitle,
        ownerId: booking.ownerId,
        raisedBy: user.uid,
        raisedByName: user.displayName || "TrustHome member",
        reason: normalizeDisputeReason(reason),
        status: "Open",
        priorStatus,
        evidenceUrls: uploadedUrls,
        createdAt: serverTimestamp(),
      });
      batch.update(doc(db, "bookings", bookingId), {
        status: "Disputed",
        disputedAt: serverTimestamp(),
        disputeId: disputeRef.id,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      try {
        await createAccountActivity(db, {
          actorId: user.uid,
          actorRole: "user",
          targetUserId: booking.ownerId,
          entityType: "booking",
          entityId: bookingId,
          action: ACCOUNT_ACTIVITY_ACTIONS.DISPUTE_RAISED,
          summary: "Dispute raised on booking",
          details: { disputeId: disputeRef.id, listingTitle: booking.listingTitle || "Untitled listing" },
        });
      } catch {
        // Activity logging is non-blocking for dispute submission.
      }
      try {
        await createNotification(db, {
          recipientId: ADMIN_NOTIFICATION_RECIPIENT,
          createdBy: user.uid,
          type: NOTIFICATION_TYPES.DISPUTE_UPDATE,
          title: "New dispute submitted",
          message: `${user.displayName || "A TrustHome member"} submitted a dispute for ${booking.listingTitle || "a booking"}.`,
          link: "/admin/disputes",
          entityId: disputeRef.id,
          entityType: "dispute",
        });
      } catch {
        // The dispute remains submitted if notification delivery is unavailable.
      }
      try {
        await createNotification(db, {
          recipientId: booking.ownerId,
          createdBy: user.uid,
          type: NOTIFICATION_TYPES.DISPUTE_UPDATE,
          title: "Dispute raised on your listing",
          message: `A dispute was raised for ${booking.listingTitle || "a booking"}. TrustHome will review it.`,
          link: "/booking-requests",
          entityId: bookingId,
          entityType: "booking",
        });
      } catch {
        // The dispute remains submitted if notification delivery is unavailable.
      }
      navigate("/my-bookings", { replace: true });
    } catch {
      setError(submissionStage === "uploading evidence"
        ? "Cloudinary photo upload failed. Check your connection and try again."
        : "Your dispute could not be submitted. Please try again.");
    } finally {
      setSaving(false);
      setSubmitStatus("");
    }
  }

  return (
    <div className="user-page">
      <PublicNav />
      <main className="user-page__content user-page__content--form">
        <Link to="/my-bookings" className="user-page__back"><ArrowLeft size={16} aria-hidden="true" /> My bookings</Link>
        {loading ? <p className="user-page__empty">Loading dispute form...</p> : error && !booking ? (
          <div className="user-page__empty" role="alert"><h1>Dispute unavailable</h1><p>{error}</p></div>
        ) : <>
          <header className="user-page__header">
            <div>
              <p className="user-page__eyebrow">Accountability trail</p>
              <h1>Raise a dispute</h1>
              <p>Report an issue with {booking?.listingTitle}. TrustHome does not hold deposit funds.</p>
            </div>
          </header>
          <form className="listing-form" onSubmit={handleSubmit}>
            <section className="user-page__empty listing-form__section">
              <div className="field">
                <label className="field__label" htmlFor="dispute-reason">What happened?</label>
                <textarea id="dispute-reason" className="listing-form__textarea" rows={7} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe what happened and any relevant details." required />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="dispute-evidence">Photo evidence (optional)</label>
                <input id="dispute-evidence" className="field__input" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleEvidenceSelection} disabled={saving} />
                <span className="field__hint">Up to 5 photos, JPEG, PNG, or WebP. Maximum 5 MB each.</span>
                {evidenceFiles.length > 0 && (
                  <ul className="dispute-evidence-files">
                    {evidenceFiles.map(({ id, file }) => (
                      <li key={id}>
                        <span>{file.name}</span>
                        <button type="button" className="dispute-evidence-files__remove" onClick={() => removeEvidenceFile(id)} disabled={saving} aria-label={`Remove ${file.name}`} title="Remove photo"><X size={14} aria-hidden="true" /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
            {error && <p className="user-page__form-error" role="alert">{error}</p>}
            {saving && <p className="user-page__message" role="status">{submitStatus}</p>}
            <button type="submit" className="btn btn--danger listing-form__submit" disabled={saving}>
              {saving ? "Submitting..." : "Submit dispute"}
            </button>
          </form>
        </>}
      </main>
    </div>
  );
}
