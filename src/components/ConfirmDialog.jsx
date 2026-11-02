import { useEffect, useRef } from "react";
import "./ConfirmDialog.css";

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby="confirm-dialog-title"
      onCancel={(event) => { event.preventDefault(); onCancel(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}
    >
      <div className="confirm-dialog__content">
        <h2 id="confirm-dialog-title">{title}</h2>
        <p>{message}</p>
        <div className="confirm-dialog__actions">
          <button type="button" className="btn btn--secondary" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className={`btn ${danger ? "btn--danger" : "btn--primary"}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </dialog>
  );
}
