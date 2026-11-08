// Lucian UX/UI Prompt #223 — Copyright (c) 2026 Seokwoooo — MIT; see THIRD_PARTY_LICENSES.md.
"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import styles from "./shrinking-card-stack.module.css";

const TOP = 80;
const STEP = 12;
const SHRINK = 0.06;
const DARKEN = 0.18;

export function ShrinkingCardStack({
  items,
  title,
}: {
  items: { id: string; content: ReactNode }[];
  title: string;
}) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stack = root.current;
    if (!stack) return;
    const cards = Array.from(
      stack.querySelectorAll<HTMLElement>(".sh-stack-card"),
    );
    const surfaces = cards.map((card) =>
      card.querySelector<HTMLElement>(".sh-stack-surface")!,
    );
    const screen = window.matchMedia("(min-width: 768px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let active = true;
    let cardHeight = 1;
    let stickyTop = TOP;
    let keyboardWithin = false;

    function measure() {
      if (!stack) return;
      // Tall cards scroll fully into view before pinning their bottom edge.
      // A short browser viewport must not silently disable the entire stack.
      stack.style.removeProperty("--sh-stack-measured-size");
      cardHeight = Math.max(
        1,
        ...surfaces.map((surface) => surface.offsetHeight),
      );
      stickyTop = Math.min(
        screen.matches ? TOP : 20,
        innerHeight - cardHeight - (cards.length - 1) * STEP - 24,
      );
      stack.style.setProperty("--sh-stack-base-top", `${stickyTop}px`);
      stack.style.setProperty("--sh-stack-measured-size", `${cardHeight}px`);
    }

    function draw() {
      raf = 0;
      if (!stack) return;
      const enabled = !keyboardWithin;
      stack.dataset.layout = "stacked";
      stack.dataset.stacking = String(enabled);

      // Read every holder before writing GPU-friendly visual transforms.
      // Each approaching card contributes normalized scroll progress [0, 1].
      const pos = cards.map((card) => card.getBoundingClientRect().top);

      surfaces.forEach((surface, index) => {
        let depth = 0;
        if (enabled && !reduced.matches) {
          for (let next = index + 1; next < cards.length; next++) {
            const stick = stickyTop + next * STEP;
            const progress = 1 - (pos[next] - stick) / cardHeight;
            depth += Math.max(0, Math.min(1, progress));
          }
        }
        surface.style.setProperty(
          "--sh-stack-scale",
          (1 - depth * SHRINK).toFixed(3),
        );
        surface.style.setProperty(
          "--sh-stack-shade",
          (depth * DARKEN).toFixed(3),
        );
      });
    }

    function schedule() {
      if (!raf) raf = window.requestAnimationFrame(draw);
    }
    function refresh() {
      measure();
      schedule();
    }
    function onFocus(event: FocusEvent) {
      const target = event.target as HTMLElement;
      // Keep keyboard-focused card controls readable as document scrolling
      // brings later cards over earlier ones.
      keyboardWithin =
        Boolean(target.closest(".sh-stack-card")) &&
        target.matches(":focus-visible");
      window.cancelAnimationFrame(raf);
      draw();
    }
    function onBlur(event: FocusEvent) {
      if (!stack?.contains(event.relatedTarget as Node | null)) {
        keyboardWithin = false;
        schedule();
      }
    }
    function resumePointerBrowsing() {
      if (keyboardWithin) {
        keyboardWithin = false;
        schedule();
      }
    }

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("wheel", resumePointerBrowsing, { passive: true });
    stack.addEventListener("pointerdown", resumePointerBrowsing);
    stack.addEventListener("focusin", onFocus);
    stack.addEventListener("focusout", onBlur);
    window.addEventListener("resize", refresh);
    screen.addEventListener("change", refresh);
    reduced.addEventListener("change", refresh);
    const observer = new ResizeObserver(refresh);
    observer.observe(stack);
    surfaces.forEach((surface) => observer.observe(surface));
    document.fonts.ready.then(() => {
      if (active) refresh();
    });
    refresh();
    return () => {
      active = false;
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("wheel", resumePointerBrowsing);
      stack.removeEventListener("pointerdown", resumePointerBrowsing);
      stack.removeEventListener("focusin", onFocus);
      stack.removeEventListener("focusout", onBlur);
      window.removeEventListener("resize", refresh);
      screen.removeEventListener("change", refresh);
      reduced.removeEventListener("change", refresh);
    };
  }, [items.length]);

  return (
    <div
      ref={root}
      className={`sh-feature-stack ${styles.u223}`}
      data-layout="flow"
      data-stacking="false"
      role="region"
      aria-label={title}
      style={
        {
          "--sh-stack-last-top": `${TOP + (items.length - 1) * STEP}px`,
        } as CSSProperties
      }
    >
      <div className={`sh-stack-flow ${styles.flow}`}>
        <div className={styles.list}>
          {items.map((item, index) => (
            <article
              key={item.id}
              id={item.id}
              className={`sh-stack-card ${styles.card}`}
              aria-labelledby={`${item.id}-title`}
              style={
                {
                  "--sh-stack-top": `calc(var(--sh-stack-base-top, ${TOP}px) + ${index * STEP}px)`,
                  // Equalize the sticky holders' bottom edges so the complete
                  // deck leaves the section together after the final pause.
                  "--sh-stack-foot": `${(items.length - 1 - index) * STEP}px`,
                  zIndex: index + 1,
                } as CSSProperties
              }
            >
              <div className={`sh-stack-surface ${styles.surface}`}>
                {item.content}
                <span
                  className={`sh-stack-shade ${styles.shade}`}
                  aria-hidden="true"
                />
              </div>
            </article>
          ))}
          <div className={styles.end} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
