"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export default function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    const element = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => { element?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={`sourcing-modal ${wide ? "wide" : ""}`} aria-label={title} onCancel={(event) => { event.preventDefault(); close.current(); }} onClick={(event) => { if (event.target === event.currentTarget) close.current(); }}>
    <div className="modal-content"><div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label={`Close ${title}`}><X size={20}/></button></div>{children}</div>
  </dialog>;
}
