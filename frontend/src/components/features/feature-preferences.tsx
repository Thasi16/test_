"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";

export function FeaturePreferences({
  children,
  lightLabel,
  darkLabel,
}: {
  children: ReactNode;
  lightLabel: string;
  darkLabel: string;
}) {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      let preference: string | null = null;
      try {
        preference = localStorage.getItem("sh-feature-theme");
      } catch {}
      setTheme(
        preference === "light" || preference === "dark"
          ? preference
          : query.matches
            ? "dark"
            : "light",
      );
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const toggle = () => {
    const next = (
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : theme === "dark"
    )
      ? "light"
      : "dark";
    setTheme(next);
    try {
      localStorage.setItem("sh-feature-theme", next);
    } catch {}
  };
  return (
    <main id="main" tabIndex={-1} className="sh-features" data-theme={theme}>
      <div className="sh-features-container sh-features-appearance">
        <button type="button" onClick={toggle}>
          <Sun className="sh-theme-sun" size={15} aria-hidden="true" />
          <Moon className="sh-theme-moon" size={15} aria-hidden="true" />
          <span className="sh-theme-sun">{lightLabel}</span>
          <span className="sh-theme-moon">{darkLabel}</span>
        </button>
      </div>
      {children}
    </main>
  );
}
