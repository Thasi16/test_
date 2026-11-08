import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import styles from "./feature-card.module.css";

export function FeatureCard({
  id,
  tone,
  number,
  count,
  icon,
  title,
  steps,
  action,
  href,
  screenshot,
}: {
  id: string;
  tone: string;
  number: number;
  count: number;
  icon: ReactNode;
  title: string;
  steps: string[];
  action: string;
  href: string;
  screenshot: ReactNode;
}) {
  return (
    <div
      className={`sh-feature-content sh-feature-${tone} ${styles.chapter}`}
      data-tone={tone}
    >
      <div className="sh-feature-copy">
        <div className={styles.copyBody}>
          <div className="sh-feature-card-top">
            <span className="sh-feature-icon">{icon}</span>
            <span className="sh-feature-number">
              {String(number).padStart(2, "0")}
              <span> / {String(count).padStart(2, "0")}</span>
            </span>
          </div>
          <h3 id={`${id}-title`}>{title}</h3>
          <ol className="sh-feature-steps">
            {steps.map((step, index) => (
              <li key={step}>
                <span aria-hidden="true">{index + 1}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
          <a className="sh-feature-action" href={href}>
            {action}
            <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </div>
      </div>
      <div className="sh-feature-visual">{screenshot}</div>
    </div>
  );
}
