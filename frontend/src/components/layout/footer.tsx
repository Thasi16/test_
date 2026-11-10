import Image from "next/image";
import { ArrowUp, ArrowUpRight } from "lucide-react";
import { dictionary, localized, type Locale } from "@/lib/i18n";
export function Footer({ locale }: { locale: Locale }) {
  const t = dictionary(locale);
  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="footer-main">
          <div>
            <a
              href={localized("/", locale)}
              aria-label={t["a11y.home"]}
              className="footer-brand"
            >
              <Image
                src="/assets/logo-horizontal.png"
                width={2172}
                height={724}
                alt={t["site.name"]}
                sizes="210px"
              />
            </a>
            <p>{t["footer.description"]}</p>
          </div>
          <p className="footer-tagline">{t["site.tagline"]}</p>
        </div>
        <div className="footer-bottom">
          <div className="footer-copyright">
            <small>© 2026 SignHearing</small>
            <p className="footer-attribution">{t["footer.attribution"]}</p>
          </div>
          <p>{t["footer.note"]}</p>
          <a href={localized("/#lien-he", locale)}>
            {t["action.contact"]}
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
          <a href="#main">
            {t["action.top"]}
            <ArrowUp size={15} aria-hidden="true" />
          </a>
        </div>
      </div>
    </footer>
  );
}
