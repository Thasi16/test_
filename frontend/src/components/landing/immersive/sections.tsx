import Image from "next/image";
import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Camera,
  ChartNoAxesCombined,
  Heart,
  MessagesSquare,
  Route,
  Sparkles,
} from "lucide-react";
import { dictionary, localized, type Locale } from "@/lib/i18n";
import { SceneReveal, StoryParallax } from "./motion";
import { LearningJourney } from "./journey";
import {
  Aurora,
  LibraryPreview,
  CameraPreview,
  AiPreview,
  ProgressPreview,
  type PreviewLabels,
} from "./visuals";

function labelsFor(locale: Locale): PreviewLabels {
  const t = dictionary(locale);
  return {
    brand: t["site.name"],
    sample: t["immersive.preview.sample"],
    library: t["immersive.feature.library.title"],
    hello: t["immersive.preview.hello"],
    thanks: t["immersive.preview.thanks"],
    family: t["immersive.preview.family"],
    camera: t["immersive.feature.camera.title"],
    mirror: t["immersive.preview.mirror"],
    cameraNote: t["immersive.preview.camera.note"],
    ai: t["immersive.feature.ai.title"],
    planned: t["immersive.status.planned"],
    aiNote: t["immersive.preview.ai.note"],
  };
}
function Chapter({
  number,
  children,
}: {
  number: string;
  children: ReactNode;
}) {
  return (
    <p className="im-chapter">
      <span aria-hidden="true">{number}</span>
      {children}
    </p>
  );
}
function StartLink({
  locale,
  light = false,
}: {
  locale: Locale;
  light?: boolean;
}) {
  return (
    <a
      className={`im-button ${light ? "im-button-light" : "im-button-primary"}`}
      href={localized("/app/courses", locale)}
    >
      {dictionary(locale)["immersive.action.start"]}
      <ArrowUpRight size={18} aria-hidden="true" />
    </a>
  );
}

export function ImmersiveHero({ locale }: { locale: Locale }) {
  const t = dictionary(locale);
  return (
    <section className="im-hero" aria-labelledby="hero-title">
      <Aurora />
      <div className="im-container im-hero-grid">
        <div className="im-hero-copy">
          <p className="im-hero-eyebrow">
            <span aria-hidden="true" />
            {t["hero.eyebrow"]}
          </p>
          <h1 id="hero-title">
            <span>{t["immersive.hero.first"]}</span>
            <span className="im-gradient-text">
              {t["immersive.hero.second"]}
            </span>
          </h1>
          <p className="im-hero-description">
            {t["immersive.hero.description"]}
          </p>
          <div className="im-actions">
            <StartLink locale={locale} />
            <a className="im-button im-button-quiet" href="#cau-chuyen">
              {t["action.explore"]}
              <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="im-hero-art">
          <div className="im-hero-orbit" aria-hidden="true">
            <i />
            <i />
          </div>
          <span className="im-particle im-particle-one" aria-hidden="true">
            ✳
          </span>
          <span className="im-particle im-particle-two" aria-hidden="true">
            +
          </span>
          <span className="im-particle im-particle-three" aria-hidden="true" />
          <div className="im-mascot-shadow" aria-hidden="true" />
          <Image
            className="im-hero-mascot"
            src="/assets/mascot.png"
            alt={t["a11y.mascot"]}
            width={1351}
            height={1164}
            sizes="(max-width: 700px) 85vw, (max-width: 1000px) 65vw, 550px"
            priority
          />
          <div className="im-floating-greeting">
            <span aria-hidden="true">
              <Heart size={18} fill="currentColor" />
            </span>
            <div>
              <strong>{t["hero.floating.first"]}</strong>
            </div>
          </div>
          <div className="im-floating-library">
            <span className="im-mini-icon" aria-hidden="true">
              <BookOpen size={18} />
            </span>
            <span>
              <strong>{t["immersive.preview.hello"]}</strong>
              <small>{t["immersive.preview.sample.short"]}</small>
            </span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </div>
        </div>
      </div>
      <div className="im-container im-hero-bottom">
        <a href="#vsl">
          {t["immersive.action.scroll"]}
          <ArrowDown size={16} aria-hidden="true" />
        </a>
        <span aria-hidden="true">01 — 06</span>
      </div>
    </section>
  );
}

export function EmotionalStory({ locale }: { locale: Locale }) {
  const t = dictionary(locale);
  return (
    <section
      id="vsl"
      className="im-story im-section"
      aria-labelledby="vsl-title"
    >
      <div className="im-container">
        <SceneReveal className="im-editorial-heading">
          <Chapter number="02">{t["vsl.chapter"]}</Chapter>
          <h2 id="vsl-title">
            {t["immersive.story.first"]}
            <br />
            <span>{t["immersive.story.second"]}</span>
          </h2>
        </SceneReveal>
        <div className="im-story-intro">
          <SceneReveal className="im-story-context">
            <p>{t["vsl.body"]}</p>
            <aside>{t["vsl.note"]}</aside>
          </SceneReveal>
          <SceneReveal className="im-quote-jordan" delay={0.08}>
            <figure>
              <span className="im-quote-mark" aria-hidden="true">
                “
              </span>
              <blockquote lang="en">{t["quote.jordan.text"]}</blockquote>
              {locale === "vi" && (
                <p className="im-quote-translation">
                  {t["quote.translation.label"]}:{" "}
                  {t["quote.jordan.translation"]}
                </p>
              )}
              <figcaption>
                <strong>{t["quote.jordan.author"]}</strong>
                <span>{t["quote.jordan.role"]}</span>
                <a href="https://www.congress.gov/109/crec/2006/03/28/CREC-2006-03-28.pdf#page=13">
                  {t["quote.jordan.source"]}
                  <ArrowUpRight size={15} aria-hidden="true" />
                </a>
              </figcaption>
            </figure>
          </SceneReveal>
        </div>
        <div id="cau-chuyen" className="im-mission">
          <SceneReveal className="im-mission-art">
            <div className="im-connection-orbit" aria-hidden="true">
              <span />
              <span />
              <span />
              <Heart strokeWidth={1.2} />
            </div>
          </SceneReveal>
          <SceneReveal className="im-mission-copy">
            <p className="im-overline">{t["story.chapter"]}</p>
            <h3>
              {t["hero.title.first"]}
              <br />
              <span>{t["hero.title.second"]}</span>
            </h3>
            <p className="im-mission-lead">{t["story.one"]}</p>
            <p>{t["story.two"]}</p>
            <details className="im-story-details">
              <summary>
                {t["immersive.story.more"]}
                <ArrowDown size={16} aria-hidden="true" />
              </summary>
              <div>
                <p>{t["story.three"]}</p>
                <h4>{t["beginning.title"]}</h4>
                {(["one", "two", "three"] as const).map((key) => (
                  <p key={key}>
                    <strong>{t[`beginning.${key}.title`]}</strong>{" "}
                    {t[`beginning.${key}.body`]}
                  </p>
                ))}
              </div>
            </details>
          </SceneReveal>
        </div>
      </div>
    </section>
  );
}

export function InteractiveJourney({ locale }: { locale: Locale }) {
  const t = dictionary(locale);
  const steps = (["discover", "practice", "feedback"] as const).map(
    (key, index) => ({
      title: t[`immersive.journey.${key}.title`],
      body: t[`immersive.journey.${key}.body`],
      status:
        t[
          index === 2
            ? "immersive.status.planned"
            : "immersive.status.prototype"
        ],
      action:
        t[index === 2 ? "immersive.action.roadmap" : "immersive.action.try"],
      href:
        index === 2
          ? "#kham-pha"
          : localized(index === 0 ? "/app/courses" : "/app/practice", locale),
    }),
  );
  return (
    <section
      id="hanh-trinh"
      className="im-journey im-section"
      aria-labelledby="journey-title"
    >
      <div className="im-container">
        <SceneReveal className="im-section-heading">
          <div>
            <Chapter number="03">{t["immersive.journey.chapter"]}</Chapter>
            <h2 id="journey-title">{t["immersive.journey.title"]}</h2>
          </div>
        </SceneReveal>
        <LearningJourney
          steps={steps}
          labels={labelsFor(locale)}
          navigation={t["immersive.journey.navigation"]}
        />
      </div>
    </section>
  );
}

export function FeatureBento({ locale }: { locale: Locale }) {
  const t = dictionary(locale);
  const labels = labelsFor(locale);
  const features = [
    {
      key: "library",
      Icon: BookOpen,
      href: "/app/dictionary",
      status: "immersive.status.prototype",
      visual: <LibraryPreview labels={labels} compact />,
    },
    {
      key: "camera",
      Icon: Camera,
      href: "/app/practice",
      status: "immersive.status.prototype",
      visual: <CameraPreview labels={labels} compact />,
    },
    {
      key: "ai",
      Icon: Sparkles,
      href: null,
      status: "immersive.status.planned",
      visual: <AiPreview labels={labels} />,
    },
    {
      key: "progress",
      Icon: ChartNoAxesCombined,
      href: "/app/progress",
      status: "immersive.status.local",
      visual: <ProgressPreview label={t["immersive.preview.progress"]} />,
    },
    {
      key: "scenarios",
      Icon: MessagesSquare,
      href: null,
      status: "immersive.status.planned",
      visual: (
        <div className="im-conversation-preview">
          <span>
            <Heart size={18} aria-hidden="true" />
            {t["immersive.preview.conversation.one"]}
          </span>
          <span>
            {t["immersive.preview.conversation.two"]}
            <MessagesSquare size={18} aria-hidden="true" />
          </span>
        </div>
      ),
    },
    {
      key: "personal",
      Icon: Route,
      href: null,
      status: "immersive.status.planned",
      visual: (
        <div className="im-roadmap-preview" aria-hidden="true">
          <i />
          <span>
            <BookOpen />
          </span>
          <span>
            <Camera />
          </span>
          <span>
            <Heart />
          </span>
          <span>
            <Sparkles />
          </span>
        </div>
      ),
    },
  ] as const;
  return (
    <section
      id="kham-pha"
      className="im-features im-section"
      aria-labelledby="features-title"
    >
      <div className="im-container">
        <SceneReveal className="im-section-heading">
          <div>
            <Chapter number="04">{t["immersive.features.chapter"]}</Chapter>
            <h2 id="features-title">{t["immersive.features.title"]}</h2>
          </div>
        </SceneReveal>
        <div className="im-bento-grid">
          {features.map(({ key, Icon, href, status, visual }, index) => (
            <SceneReveal
              key={key}
              className={`im-bento-item im-bento-${key}`}
              delay={(index % 3) * 0.05}
            >
              <article>
                <div className="im-feature-top">
                  <span className="im-feature-icon">
                    <Icon size={21} aria-hidden="true" />
                  </span>
                  <span
                    className={`im-status ${href ? "" : "im-status-planned"}`}
                  >
                    {t[status]}
                  </span>
                </div>
                <div className="im-feature-copy">
                  <h3>{t[`immersive.feature.${key}.title`]}</h3>
                  <p>{t[`immersive.feature.${key}.body`]}</p>
                </div>
                <div className="im-feature-visual">{visual}</div>
                {href ? (
                  <a className="im-feature-link" href={localized(href, locale)}>
                    {t["immersive.action.open"]}
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </a>
                ) : null}
              </article>
            </SceneReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function EmotionalStage({ locale }: { locale: Locale }) {
  const t = dictionary(locale);
  return (
    <section
      id="dong-hanh"
      className="im-emotion im-section"
      aria-labelledby="emotion-title"
    >
      <Aurora />
      <div className="im-container">
        <SceneReveal>
          <Chapter number="05">{t["together.chapter"]}</Chapter>
          <h2 id="emotion-title">
            {t["immersive.emotion.first"]}
            <br />
            <span>{t["immersive.emotion.second"]}</span>
          </h2>
        </SceneReveal>
        <div className="im-emotion-composition">
          <StoryParallax>
            <div className="im-emotion-ring" aria-hidden="true" />
            <Image
              src="/assets/mascot.png"
              width={1351}
              height={1164}
              alt=""
              sizes="(max-width: 700px) 65vw, 430px"
            />
            <span className="im-emotion-word">
              {t["immersive.emotion.word"]}
            </span>
          </StoryParallax>
          <SceneReveal className="im-emotion-copy">
            <p className="im-emotion-statement">
              {t["immersive.emotion.body"]}
            </p>
            <figure>
              <blockquote lang="en">“{t["quote.keller.text"]}”</blockquote>
              {locale === "vi" && (
                <p className="im-quote-translation">
                  {t["quote.translation.label"]}:{" "}
                  {t["quote.keller.translation"]}
                </p>
              )}
              <figcaption>
                <strong>{t["quote.keller.author"]}</strong>
                <a href="https://www.helenkeller.org/get-involved/">
                  {t["quote.keller.source"]}
                  <ArrowUpRight size={15} aria-hidden="true" />
                </a>
              </figcaption>
            </figure>
          </SceneReveal>
        </div>
        <p className="im-quote-context">{t["quote.context"]}</p>
      </div>
    </section>
  );
}

export function FinalInvitation({ locale }: { locale: Locale }) {
  const t = dictionary(locale);
  return (
    <section
      className="im-invitation im-section"
      aria-labelledby="invitation-title"
    >
      <div className="im-container">
        <div className="im-invitation-card">
          <Aurora />
          <SceneReveal className="im-invitation-copy">
            <Chapter number="06">{t["immersive.final.chapter"]}</Chapter>
            <h2 id="invitation-title">{t["immersive.final.title"]}</h2>
            <p>{t["immersive.final.body"]}</p>
            <div className="im-actions">
              <StartLink locale={locale} />
              <a href="#lien-he" className="im-button im-button-quiet">
                {t["immersive.action.together"]}
                <Heart size={17} aria-hidden="true" />
              </a>
            </div>
          </SceneReveal>
          <div className="im-invitation-art">
            <div aria-hidden="true" />
            <Image
              src="/assets/mascot.png"
              width={1351}
              height={1164}
              alt=""
              sizes="(max-width: 700px) 65vw, 380px"
            />
          </div>
        </div>
        <div className="im-contact-row">
          <div>
            <h3>{t["together.title"]}</h3>
            <p>{t["together.body"]}</p>
          </div>
          <details id="lien-he" className="im-contact-details">
            <summary>
              {t["action.contact"]}
              <ArrowUpRight size={18} aria-hidden="true" />
            </summary>
            <div>
              <h4>{t["contact.missing.title"]}</h4>
              <p>{t["contact.missing.body"]}</p>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
