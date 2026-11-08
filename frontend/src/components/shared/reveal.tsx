"use client";
import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const visible = useInView(ref, { once: true, amount: 0.1 });
  const reduced = useReducedMotion();
  // SSR and pre-hydration content is fully visible. Only animate an on-screen arrival.
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={false}
      animate={
        visible && !reduced
          ? { y: [12, 0], opacity: [0.65, 1] }
          : { y: 0, opacity: 1 }
      }
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
