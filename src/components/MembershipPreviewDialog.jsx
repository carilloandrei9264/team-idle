import { useEffect, useRef } from "react";
import { Check, QrCode, X } from "lucide-react";
import "./MembershipPreviewDialog.css";

export default function MembershipPreviewDialog({ onClose, previewUser = null }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";

    return () => {
      if (dialog?.open) dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="membership-preview"
      aria-labelledby="membership-preview-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <header className="membership-preview__header">
        <p>TrustHome plans <span>Preview only</span></p>
        <button type="button" className="membership-preview__close" onClick={onClose} aria-label="Close plans preview">
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="membership-preview__intro">
        <h2 id="membership-preview-title">Choose how you build trust</h2>
        <p>Compare the current experience with the planned TrustHome Verified profile badge.</p>
        {previewUser && (
          <p className="membership-preview__user">Previewing for {previewUser.name || previewUser.email || "Unnamed user"}. This does not change their account.</p>
        )}
      </div>

      <div className="membership-preview__plans">
        <article className="membership-preview__plan">
          <p className="membership-preview__plan-kicker">Available now</p>
          <h3>Free</h3>
          <p className="membership-preview__price">Free</p>
          <p className="membership-preview__description">The current TrustHome experience.</p>
          <ul>
            <li><Check size={15} aria-hidden="true" /> Browse and compare listings</li>
            <li><Check size={15} aria-hidden="true" /> Request and manage bookings</li>
            <li><Check size={15} aria-hidden="true" /> Manage your profile</li>
          </ul>
          <button type="button" className="btn btn--secondary membership-preview__plan-action" disabled>Current experience</button>
        </article>

        <article className="membership-preview__plan membership-preview__plan--featured">
          <p className="membership-preview__plan-kicker">Planned</p>
          <h3>TrustHome Verified</h3>
          <p className="membership-preview__price">Pricing to be announced</p>
          <p className="membership-preview__description">An optional badge for profiles that complete TrustHome's review.</p>
          <ul>
            <li><Check size={15} aria-hidden="true" /> Verified profile badge preview</li>
            <li><Check size={15} aria-hidden="true" /> Clear review status for visitors</li>
            <li><Check size={15} aria-hidden="true" /> QR payment and receipt review flow planned</li>
          </ul>
          <button type="button" className="btn btn--primary membership-preview__plan-action" disabled>Not available yet</button>
        </article>
      </div>

      <section className="membership-preview__payment" aria-labelledby="membership-payment-title">
        <span className="membership-preview__qr" aria-hidden="true"><QrCode size={34} /></span>
        <div>
          <h3 id="membership-payment-title">Payment flow preview</h3>
          <p>Future flow: scan a TrustHome QR code, submit a receipt, then wait for review before any badge is applied.</p>
        </div>
        <span className="membership-preview__not-live">Not active</span>
      </section>
      <p className="membership-preview__notice">Demo only. No payment is accepted, no receipt is uploaded, and no account is upgraded.</p>
    </dialog>
  );
}