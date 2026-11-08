"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { Pause, Play } from "lucide-react";

const subscribeReady = () => () => {};
const MotionContext = createContext({ canAnimate: false });
const desktopQuery = "(min-width: 1000px) and (min-height: 700px)";
const subscribeDesktop = (callback: () => void) => {
  const query = window.matchMedia(desktopQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};
export function useDesktopMotion() {
  const desktop = useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(desktopQuery).matches,
    () => false,
  );
  return useContext(MotionContext).canAnimate && desktop;
}
export function ImmersiveMotion({
  children,
  pause,
  resume,
}: {
  children: ReactNode;
  pause: string;
  resume: string;
}) {
  const [paused, setPaused] = useState(false);
  const ready = useSyncExternalStore(
    subscribeReady,
    () => true,
    () => false,
  );
  const reduced = useReducedMotion();
  const canAnimate = ready && !reduced && !paused;
  return (
    <MotionContext.Provider value={{ canAnimate }}>
      <main
        id="main"
        tabIndex={-1}
        className="immersive-landing"
        data-motion={ready && !reduced ? "running" : "idle"}
        data-paused={paused}
      >
        {ready && !reduced && (
          <button
            className="im-motion-control"
            onClick={() => setPaused(!paused)}
            aria-label={paused ? resume : pause}
            aria-pressed={paused}
          >
            {paused ? (
              <Play size={15} aria-hidden="true" />
            ) : (
              <Pause size={15} aria-hidden="true" />
            )}
            <span>{paused ? resume : pause}</span>
          </button>
        )}
        {children}
      </main>
    </MotionContext.Provider>
  );
}
export function SceneReveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const visible = useInView(ref, { once: true, amount: 0.12 });
  const { canAnimate } = useContext(MotionContext);
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={false}
      animate={
        visible && canAnimate
          ? { y: [22, 0], opacity: [0.7, 1] }
          : { y: 0, opacity: 1 }
      }
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
export function StoryParallax({ children }: { children: ReactNode }) {
  const ref = useRef(null);
  const enabled = useDesktopMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [24, -24]);
  return (
    <motion.div
      ref={ref}
      className="im-emotion-art"
      style={{ y: enabled ? y : 0 }}
    >
      {children}
    </motion.div>
  );
}
