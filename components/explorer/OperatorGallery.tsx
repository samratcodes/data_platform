"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, Images, X } from "lucide-react";

// Supplier photos are arbitrary public HTTPS URLs, so remote sources skip the optimizer.
const remote = (source: string) => !source.startsWith("/");

function Lightbox({ photos, name, index, onIndex, onClose }: { photos: string[]; name: string; index: number; onIndex: (index: number) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const touch = useRef(0);
  const total = photos.length;
  const step = useCallback((amount: number) => onIndex((index + amount + total) % total), [index, onIndex, total]);

  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const scroll = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = scroll; previous?.focus(); };
  }, []);

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
    };
    document.addEventListener("keydown", keyboard);
    return () => document.removeEventListener("keydown", keyboard);
  }, [step]);

  useEffect(() => {
    strip.current?.querySelector<HTMLButtonElement>("[data-active='true']")?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [index]);

  return <dialog ref={dialog} className="op-lightbox" aria-label={`${name} photo viewer`} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <header>
      <span><Images size={14}/>{name}<em>{index + 1} / {total}</em></span>
      <button type="button" className="op-lightbox-close" onClick={onClose} aria-label="Close photo viewer"><X size={19}/></button>
    </header>
    <div
      className="op-lightbox-stage"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      onTouchStart={(event) => { touch.current = event.changedTouches[0].clientX; }}
      onTouchEnd={(event) => { const delta = event.changedTouches[0].clientX - touch.current; if (Math.abs(delta) > 45 && total > 1) step(delta < 0 ? 1 : -1); }}
    >
      {total > 1 && <button type="button" className="op-lightbox-step" data-side="left" onClick={() => step(-1)} aria-label="Previous photo"><ChevronLeft size={22}/></button>}
      <figure key={photos[index]}>
        <Image src={photos[index]} alt={`${name} photo ${index + 1} of ${total}`} fill sizes="92vw" className="object-contain" unoptimized={remote(photos[index])} priority/>
      </figure>
      {total > 1 && <button type="button" className="op-lightbox-step" data-side="right" onClick={() => step(1)} aria-label="Next photo"><ChevronRight size={22}/></button>}
    </div>
    {total > 1 && <div className="op-lightbox-strip" ref={strip}>
      {photos.map((photo, position) => <button key={photo} type="button" data-active={position === index} onClick={() => onIndex(position)} aria-label={`View photo ${position + 1}`} aria-current={position === index}>
        <Image src={photo} alt="" fill sizes="88px" className="object-cover" unoptimized={remote(photo)}/>
      </button>)}
    </div>}
  </dialog>;
}

export default function OperatorGallery({ photos, name, label }: { photos: string[]; name: string; label: string }) {
  const [open, setOpen] = useState(-1);
  const hero = photos[0];
  const side = photos.slice(1, 5);

  return <>
    <section className="op-gallery" data-count={Math.min(photos.length, 5)} aria-label={`${name} photos`}>
      <button type="button" className="op-gallery-tile op-gallery-hero" onClick={() => setOpen(0)} aria-label={`Open ${name} photo 1 in full screen`}>
        <Image src={hero} alt={`${name} — ${label}`} fill sizes="(max-width: 860px) 100vw, 55vw" className="object-cover" priority unoptimized={remote(hero)}/>
        <span className="op-gallery-shade"/>
      </button>
      {side.map((photo, position) => <button key={photo} type="button" className="op-gallery-tile" onClick={() => setOpen(position + 1)} aria-label={`Open ${name} photo ${position + 2} in full screen`}>
        <Image src={photo} alt={`${name} photo ${position + 2}`} fill sizes="(max-width: 860px) 50vw, 24vw" className="object-cover" unoptimized={remote(photo)}/>
      </button>)}
      <button type="button" className="op-gallery-all" onClick={() => setOpen(0)}><Expand size={13}/>{photos.length > 1 ? `View all ${photos.length} photos` : "View photo"}</button>
    </section>
    {open >= 0 && <Lightbox photos={photos} name={name} index={open} onIndex={setOpen} onClose={() => setOpen(-1)}/>}
  </>;
}
