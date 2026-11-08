"use client";

import { useRef, useState } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";
import { ArrowRight, BookOpen, Camera, Sparkles } from "lucide-react";
import { useDesktopMotion } from "./motion";
import {
  AiPreview,
  CameraPreview,
  LibraryPreview,
  type PreviewLabels,
} from "./visuals";

export type JourneyStep = {
  title: string;
  body: string;
  status: string;
  action: string;
  href: string;
};
export function LearningJourney({
  steps,
  labels,
  navigation,
}: {
  steps: JourneyStep[];
  labels: PreviewLabels;
  navigation: string;
}) {
  const ref = useRef(null);
  const [active, setActive] = useState(0);
  const enabled = useDesktopMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start center", "end center"],
  });
  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    if (enabled)
      setActive(
        Math.min(
          steps.length - 1,
          Math.max(0, Math.floor(progress * steps.length)),
        ),
      );
  });
  const icons = [BookOpen, Camera, Sparkles];
  return (
    <div ref={ref} className="im-journey-layout">
      <ol className="im-journey-steps">
        {steps.map((step, index) => {
          const Icon = icons[index];
          return (
            <li
              key={step.title}
              className={active === index ? "is-active" : ""}
            >
              <span className="im-step-node" aria-hidden="true">
                <Icon size={22} />
              </span>
              <div>
                <span
                  className={`im-status ${index === 2 ? "im-status-planned" : ""}`}
                >
                  {step.status}
                </span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                <a href={step.href} className="im-text-link">
                  {step.action}
                  <ArrowRight size={16} aria-hidden="true" />
                </a>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="im-journey-visual">
        <div className="im-journey-sticky">
          <div className="im-preview-chrome">
            <span aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>{labels.brand}</span>
            <span aria-hidden="true">↗</span>
          </div>
          <div className="im-journey-scenes" data-active={active}>
            <div
              className={`im-journey-scene ${active === 0 ? "is-active" : ""}`}
              aria-hidden={active !== 0}
            >
              <LibraryPreview labels={labels} />
            </div>
            <div
              className={`im-journey-scene ${active === 1 ? "is-active" : ""}`}
              aria-hidden={active !== 1}
            >
              <CameraPreview labels={labels} />
            </div>
            <div
              className={`im-journey-scene ${active === 2 ? "is-active" : ""}`}
              aria-hidden={active !== 2}
            >
              <AiPreview labels={labels} />
            </div>
          </div>
          <div
            className="im-journey-selector"
            role="group"
            aria-label={navigation}
          >
            {steps.map((step, index) => (
              <button
                key={step.title}
                aria-label={step.title}
                aria-pressed={active === index}
                onClick={() => setActive(index)}
              >
                <span>0{index + 1}</span>
                <i aria-hidden="true" />
              </button>
            ))}
          </div>
          <p className="im-preview-caption">{labels.sample}</p>
        </div>
      </div>
    </div>
  );
}
