import Image from "next/image";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Camera,
  ChartNoAxesCombined,
  Check,
  Compass,
  Layers,
  Play,
  Plus,
  Sparkles,
  MessagesSquare,
} from "lucide-react";
import { dictionary, localized, type Locale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/shared/reveal";
import { FeaturePreferences } from "./feature-preferences";
import { FeatureCard } from "./feature-card";
import { ShrinkingCardStack } from "./shrinking-card-stack";
import { GuideScreenshot } from "./guide-screenshot";

const guides = [
  {
    key: "courses",
    icon: Compass,
    route: "/app/courses",
    asset: "learning-roadmap",
  },
  {
    key: "library",
    icon: BookOpen,
    route: "/app/dictionary",
    asset: "vsl-library",
  },
  {
    key: "video",
    icon: Play,
    route: "/app/signs/am",
    asset: "sign-learning",
  },
  {
    key: "camera",
    icon: Camera,
    route: "/app/practice/am",
    asset: "camera-practice",
  },
  {
    key: "review",
    icon: Layers,
    route: "/app/review",
    asset: "review-quiz",
  },
  {
    key: "progress",
    icon: ChartNoAxesCombined,
    route: "/app/progress",
    asset: "learning-progress",
  },
] as const;

export function FeatureGuide({ locale }: { locale: Locale }) {
  const t = dictionary(locale);
  const screenshot = (asset: string) =>
    `/images/feature-guides/${asset}-${locale}.webp`;
  return (
    <FeaturePreferences
      lightLabel={t["features.theme.light"]}
      darkLabel={t["features.theme.dark"]}
    >
      <section className="sh-features-hero" aria-labelledby="features-title">
        <div className="sh-features-container sh-features-hero-grid">
          <div>
            <p className="sh-features-eyebrow">
              <span />
              {t["features.hero.eyebrow"]}
            </p>
            <h1 id="features-title">
              {t["features.hero.lead"]}
              <br />
              <span> {t["site.name"]}</span>
            </h1>
            <p className="sh-features-subtitle">
              {t["features.hero.subtitle"]}
            </p>
            <div className="sh-features-actions">
              <Button asChild>
                <a href="#feature-courses">
                  {t["features.action.discover"]}
                  <ArrowDown aria-hidden="true" />
                </a>
              </Button>
              <a className="sh-features-text-link" href="#getting-started">
                {t["features.action.quickstart"]}
                <ArrowUpRight size={17} aria-hidden="true" />
              </a>
            </div>
            <p className="sh-features-hero-note">
              <Check size={15} aria-hidden="true" />
              {t["features.hero.note"]}
            </p>
          </div>
          <div className="sh-features-hero-art">
            <div className="sh-features-orbit" aria-hidden="true">
              <i />
              <i />
              <span>✳</span>
            </div>
            <Image
              src="/assets/mascot.png"
              alt={t["a11y.mascot"]}
              width={1351}
              height={1164}
              sizes="(max-width: 700px) 70vw, 380px"
              priority
            />
            <span className="sh-features-art-note sh-features-art-note-one">
              <BookOpen size={18} aria-hidden="true" />
              {t["features.hero.observe"]}
            </span>
            <span className="sh-features-art-note sh-features-art-note-two">
              <Camera size={18} aria-hidden="true" />
              {t["features.hero.practice"]}
            </span>
            <p>{t["site.tagline"]}</p>
          </div>
        </div>
        <div className="sh-features-container sh-features-index">
          <p>
            <span>06</span>
            {t["features.hero.index"]}
          </p>
          <nav aria-label={t["features.index.label"]}>
            {guides.map(({ key, icon: Icon }, index) => (
              <a key={key} href={`#feature-${key}`}>
                <Icon size={16} aria-hidden="true" />
                <span>{t[`features.${key}.short`]}</span>
                <small aria-hidden="true">0{index + 1}</small>
              </a>
            ))}
          </nav>
        </div>
      </section>

      <section
        className="sh-features-showcase sh-features-container"
        aria-labelledby="showcase-title"
      >
        <Reveal className="sh-features-section-heading">
          <div>
            <p className="sh-features-eyebrow">
              {t["features.showcase.eyebrow"]}
            </p>
            <h2 id="showcase-title">{t["features.showcase.title"]}</h2>
          </div>
          <p>{t["features.showcase.body"]}</p>
        </Reveal>
        <ShrinkingCardStack
          title={t["features.stack.title"]}
          items={guides.map(({ key, icon: Icon, route, asset }, index) => ({
            id: `feature-${key}`,
            content: (
              <FeatureCard
                id={`feature-${key}`}
                tone={key}
                number={index + 1}
                count={guides.length}
                icon={<Icon size={23} strokeWidth={1.6} aria-hidden="true" />}
                title={t[`features.${key}.title`]}
                steps={([1, 2, 3, 4] as const).map(
                  (step) => t[`features.${key}.step${step}`],
                )}
                action={t[`features.${key}.action`]}
                href={localized(route, locale)}
                screenshot={
                  <GuideScreenshot
                    src={screenshot(asset)}
                    alt={t[`features.${key}.alt`]}
                    route={route}
                    zoomLabel={t["features.screenshot.zoom"]}
                    closeLabel={t["features.screenshot.close"]}
                    originalLabel={t["features.screenshot.original"]}
                  />
                }
              />
            ),
          }))}
        />
      </section>

      <section
        id="getting-started"
        className="sh-features-onboarding"
        aria-labelledby="getting-started-title"
      >
        <div className="sh-features-container">
          <Reveal className="sh-features-section-heading">
            <div>
              <p className="sh-features-eyebrow">
                {t["features.start.eyebrow"]}
              </p>
              <h2 id="getting-started-title">{t["features.start.title"]}</h2>
            </div>
            <p>{t["features.start.body"]}</p>
          </Reveal>
          <ol className="sh-features-start-grid">
            {(["courses", "library", "camera"] as const).map((key, index) => {
              const guide = guides.find((item) => item.key === key)!;
              return (
                <li key={key}>
                  <a href={localized(guide.route, locale)}>
                    <div className="sh-features-start-image">
                      <Image
                        src={screenshot(guide.asset)}
                        alt={t[`features.${key}.alt`]}
                        width={1440}
                        height={1000}
                        sizes="(max-width: 700px) 90vw, 30vw"
                        loading="lazy"
                      />
                      <span aria-hidden="true">0{index + 1}</span>
                    </div>
                    <div className="sh-features-start-copy">
                      <h3>
                        {t[`features.start.${key}.title`]}
                        <ArrowUpRight size={19} aria-hidden="true" />
                      </h3>
                      <p>{t[`features.start.${key}.body`]}</p>
                    </div>
                  </a>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section
        className="sh-features-roadmap sh-features-container"
        aria-labelledby="roadmap-title"
      >
        <div>
          <p className="sh-features-eyebrow">
            <Sparkles size={16} aria-hidden="true" />
            {t["features.roadmap.eyebrow"]}
          </p>
          <h2 id="roadmap-title">{t["features.roadmap.title"]}</h2>
          <p>{t["features.roadmap.body"]}</p>
        </div>
        <div className="sh-features-roadmap-items">
          {(["ai", "scenarios"] as const).map((key) => (
            <article key={key}>
              {key === "ai" ? (
                <Sparkles size={21} aria-hidden="true" />
              ) : (
                <MessagesSquare size={21} aria-hidden="true" />
              )}
              <div>
                <h3>{t[`features.roadmap.${key}.title`]}</h3>
                <p>{t[`features.roadmap.${key}.body`]}</p>
              </div>
              <span>{t["features.status.planned"]}</span>
            </article>
          ))}
        </div>
      </section>

      <section
        className="sh-features-faq sh-features-container"
        aria-labelledby="faq-title"
      >
        <div>
          <p className="sh-features-eyebrow">{t["features.faq.eyebrow"]}</p>
          <h2 id="faq-title">{t["features.faq.title"]}</h2>
        </div>
        <div>
          {(
            [
              "account",
              "camera",
              "ai",
              "progress",
              "video",
              "language",
            ] as const
          ).map((key) => (
            <details key={key}>
              <summary>
                {t[`features.faq.${key}.q`]}
                <Plus size={19} aria-hidden="true" />
              </summary>
              <p>{t[`features.faq.${key}.a`]}</p>
            </details>
          ))}
        </div>
      </section>

      <section
        className="sh-features-final"
        aria-labelledby="features-cta-title"
      >
        <div className="sh-features-container">
          <Reveal>
            <p className="sh-features-eyebrow">{t["features.cta.eyebrow"]}</p>
            <h2 id="features-cta-title">{t["features.cta.title"]}</h2>
            <p>{t["features.cta.body"]}</p>
            <Button asChild>
              <a href={localized("/app/courses", locale)}>
                {t["features.cta.action"]}
                <ArrowRight aria-hidden="true" />
              </a>
            </Button>
            <a
              className="sh-features-text-link"
              href={localized("/app/dictionary", locale)}
            >
              {t["features.library.action"]}
              <ArrowUpRight size={17} aria-hidden="true" />
            </a>
          </Reveal>
        </div>
      </section>
    </FeaturePreferences>
  );
}
