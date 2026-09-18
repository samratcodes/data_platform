"use client";

import { AlertTriangle, LoaderCircle, Trash2 } from "lucide-react";
import Modal from "./Modal";

/** A small confirmation modal for destructive actions such as deleting an image. */
export default function ConfirmDialog({ title, message, confirmLabel = "Delete", busy = false, onConfirm, onCancel }: {
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return <Modal title={title} onClose={() => { if (!busy) onCancel(); }}>
    <div className="confirm-dialog">
      <p><AlertTriangle aria-hidden/>{message}</p>
      <div className="confirm-dialog-actions">
        <button type="button" className="confirm-dialog-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className="confirm-dialog-danger" onClick={onConfirm} disabled={busy} autoFocus>{busy ? <LoaderCircle className="spin" size={16}/> : <Trash2 size={16}/>}{confirmLabel}</button>
      </div>
    </div>
  </Modal>;
}
