"use client";

import Image from "next/image";
import { useId, useRef } from "react";
import { Maximize2, X, ArrowUpRight } from "lucide-react";
import styles from "./guide-screenshot.module.css";

export function GuideScreenshot({
  src,
  alt,
  route,
  zoomLabel,
  closeLabel,
  originalLabel,
}: {
  src: string;
  alt: string;
  route: string;
  zoomLabel: string;
  closeLabel: string;
  originalLabel: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const screenshot = (
    <>
      <Image
        src={src}
        alt={alt}
        width={1440}
        height={1000}
        sizes="(max-width: 1099px) 90vw, 55vw"
      />
    </>
  );
  return (
    <figure className={`sh-guide-figure ${styles.figure}`}>
      <div className="sh-guide-browser">
        <div className="sh-guide-chrome" aria-hidden="true">
          <span className="sh-guide-dots">
            <i />
            <i />
            <i />
          </span>
          <span>{route}</span>
          <span className="sh-guide-chrome-mark">↗</span>
        </div>
        <div className={styles.image}>
          {screenshot}
          <button
            className={`sh-guide-zoom ${styles.zoom}`}
            type="button"
            aria-label={zoomLabel}
            aria-haspopup="dialog"
            onClick={() => dialog.current?.showModal()}
          >
            <Maximize2 size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      <noscript>
        <a
          className="sh-guide-original-link"
          href={src}
          target="_blank"
          rel="noreferrer"
        >
          {originalLabel}
          <ArrowUpRight size={13} aria-hidden="true" />
        </a>
      </noscript>
      <dialog
        ref={dialog}
        className="sh-guide-dialog"
        aria-labelledby={`${id}-title`}
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current.close();
        }}
      >
        <div className="sh-guide-dialog-head">
          <p id={`${id}-title`}>{alt}</p>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={() => dialog.current?.close()}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <div className="sh-guide-full-image">{screenshot}</div>
        <a
          className="sh-guide-original"
          href={src}
          target="_blank"
          rel="noreferrer"
        >
          {originalLabel}
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </dialog>
    </figure>
  );
}
