"use client";
import type { Locale } from "@/lib/i18n";

export function LanguageSwitch({
  locale,
  path,
  label,
  viLabel,
  enLabel,
}: {
  locale: Locale;
  path: string;
  label: string;
  viLabel: string;
  enLabel: string;
}) {
  return (
    <div className="language-switch" role="group" aria-label={label}>
      {(["vi", "en"] as const).map((lang) => (
        <a
          key={lang}
          href={`${path}?lang=${lang}`}
          lang={lang}
          hrefLang={lang}
          aria-label={lang === "vi" ? viLabel : enLabel}
          aria-current={locale === lang ? "true" : undefined}
          onClick={(event) => {
            event.currentTarget.hash = window.location.hash;
          }}
        >
          {lang.toUpperCase()}
        </a>
      ))}
    </div>
  );
}
