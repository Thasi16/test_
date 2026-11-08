import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const axeSource = process.env.AXE_MODULE
  ? require(process.env.AXE_MODULE).source
  : null;
const frontend = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(
  await readFile(path.join(frontend, "src/data/feature-captures.json"), "utf8"),
);
const base = process.env.TEST_URL || "http://127.0.0.1:3000";
const out = path.resolve(frontend, "../.runtime/features-qa");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks++;
};
const settle = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
const scroll = async (page, y) => {
  await page.evaluate(
    (y) => window.scrollTo({ top: y, behavior: "instant" }),
    y,
  );
  await settle(page);
};
const screenshot = async (page, filename) => {
  await page.screenshot({ path: path.join(out, filename) });
};
const audit = async (page, label) => {
  if (!axeSource) return;
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(() =>
    window.axe.run(document.querySelector(".sh-features"), {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    }),
  );
  await writeFile(
    path.join(out, `accessibility-${label}.json`),
    JSON.stringify(result, null, 2),
  );
  check(
    result.violations.length === 0,
    `Accessibility ${label}: ${result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(",")}`).join("; ")}`,
  );
};
try {
  for (const locale of ["vi", "en"]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.stackLayoutShift = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (
            !entry.hadRecentInput &&
            entry.sources?.some((source) =>
              source.node?.closest?.(".sh-feature-stack"),
            )
          )
            window.stackLayoutShift += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(`${base}/features?lang=${locale}`, {
      waitUntil: "networkidle",
    });
    check(response.status() === 200, "Features HTTP 200");
    check(
      !/Lucian|Seokwoooo|MIT license/i.test(await response.text()),
      "No third-party attribution in rendered HTML",
    );
    check(
      (await page.locator("html").getAttribute("lang")) === locale,
      "Document language",
    );
    check((await page.locator("h1").count()) === 1, "One h1");
    const title = await page.locator("h1").innerText();
    check(
      title.includes(locale === "vi" ? "Khám phá" : "Explore"),
      "Localized hero",
    );
    check(
      (await page.locator(".desktop-navigation a").count()) === 5,
      "All original navigation plus Features",
    );
    check(
      (await page
        .locator('.desktop-navigation a[aria-current="page"]')
        .getAttribute("href")) === `/features?lang=${locale}`,
      "Active Features navigation",
    );
    check(
      (await page.locator(".sh-stack-card").count()) === 6,
      "Six verified guides",
    );
    check(
      (await page.locator(".sh-feature-steps li").count()) === 24,
      "Four instructions per guide",
    );
    check(
      (await page
        .locator(
          ".sh-feature-description, .sh-feature-status, .sh-feature-note, .sh-guide-pins, .sh-guide-legend, .sh-guide-figure figcaption",
        )
        .count()) === 0,
      "Compact cards omit redundant subtitles, badges, notes, screenshot pins and captions",
    );
    check(
      !/Lucian|MIT license/i.test(await page.locator("main").innerText()),
      "No third-party branding",
    );
    for (const capture of Object.values(manifest.captures[locale])) {
      const buffer = await readFile(path.join(frontend, "public", capture.src));
      check(
        createHash("sha256").update(buffer).digest("hex") === capture.sha256,
        "Screenshot provenance hash",
      );
      check(
        (
          await context.request.get(base + capture.route + `?lang=${locale}`)
        ).status() === 200,
        "Actual feature link works",
      );
      check(
        (await context.request.get(base + capture.src)).status() === 200,
        "Captured asset serves",
      );
    }
    for (const image of await page.locator(".sh-guide-browser img").all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((img) => img.decode());
      check(
        await image.evaluate((img) => img.naturalWidth > 0 && Boolean(img.alt)),
        "Screenshot loaded and described",
      );
    }
    await scroll(page, 0);
    await screenshot(page, `hero-${locale}-1440-light.png`);
    await audit(page, `${locale}-light`);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(250);
    check(await page.evaluate(() => scrollY > 0), "Wheel/trackpad scrolling");
    await page.locator("main").focus();
    const beforePageDown = await page.evaluate(() => scrollY);
    await page.keyboard.press("PageDown");
    await page.waitForTimeout(250);
    check(
      await page.evaluate((y) => scrollY > y, beforePageDown),
      "Keyboard document scrolling",
    );
    await scroll(page, 0);

    // Document scrolling pins the deck; subsequent cards cover earlier cards.
    await page.locator(".sh-feature-stack[data-stacking=true]").waitFor();
    check(
      await page
        .locator(".sh-feature-stack")
        .evaluate((root) =>
          [root, ...root.querySelectorAll("*")]
            .filter((el) => !el.closest("dialog"))
            .every(
              (el) =>
                !["auto", "scroll"].includes(getComputedStyle(el).overflowY),
            ),
        ),
      "Deck has no nested vertical scroll container",
    );
    const origins = await page
      .locator(".sh-stack-card")
      .evaluateAll((cards) =>
        cards.map((c) => c.getBoundingClientRect().top + scrollY),
      );
    const cardHeight = await page
      .locator(".sh-stack-surface")
      .first()
      .evaluate((el) => el.offsetHeight);
    check(
      cardHeight >= 320 && cardHeight <= 500,
      "Desktop cards stay compact instead of occupying most of the viewport",
    );
    check(
      await page
        .locator(".sh-feature-stack")
        .evaluate((el) => el.getBoundingClientRect().width <= 1120),
      "Desktop deck width is capped at 1120px",
    );
    await scroll(page, origins[0] - 80);
    const photo = page.locator(".sh-guide-browser img").first();
    await photo.click();
    check(
      (await page.locator("dialog[open]").count()) === 0,
      "Clicking the screenshot itself never opens a scroll-blocking modal",
    );
    const imageBounds = await photo.boundingBox();
    await page.mouse.move(
      imageBounds.x + imageBounds.width / 2,
      imageBounds.y + imageBounds.height / 2,
    );
    const imageScrollStart = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 180);
    await page.waitForTimeout(200);
    check(
      await page.evaluate((y) => scrollY > y, imageScrollStart),
      "Wheel over the real screenshot scrolls the page",
    );
    check(
      await page.evaluate(
        () =>
          document.scrollingElement.scrollHeight > innerHeight &&
          !["hidden", "clip"].includes(
            getComputedStyle(document.documentElement).overflowY,
          ) &&
          !["hidden", "clip"].includes(
            getComputedStyle(document.body).overflowY,
          ),
      ),
      "Document is tall enough to scroll and has no active scroll lock",
    );
    await scroll(page, origins[1] - 92 - cardHeight / 2);
    const halfLayer = await page
      .locator(".sh-stack-surface")
      .first()
      .evaluate((el) => ({
        scale: new DOMMatrix(getComputedStyle(el).transform).a,
        shade: Number(
          getComputedStyle(el.querySelector(".sh-stack-shade")).opacity,
        ),
      }));
    check(
      Math.abs(halfLayer.scale - 0.97) < 0.002 &&
        Math.abs(halfLayer.shade - 0.09) < 0.003,
      "Normalized overlap progress: half depth",
    );
    await scroll(page, origins[1] - 92);
    const firstLayer = await page
      .locator(".sh-stack-surface")
      .first()
      .evaluate((el) => ({
        scale: new DOMMatrix(getComputedStyle(el).transform).a,
        shade: Number(
          getComputedStyle(el.querySelector(".sh-stack-shade")).opacity,
        ),
      }));
    check(
      Math.abs(firstLayer.scale - 0.94) < 0.002,
      "Earlier card shrinks as the next card pins",
    );
    check(
      Math.abs(firstLayer.shade - 0.18) < 0.003,
      "Earlier card darkens as it is covered",
    );
    await screenshot(page, `stack-${locale}-1440.png`);
    const finalY = origins[5] - 140;
    await scroll(page, finalY);
    const steps = await page
      .locator(".sh-stack-card")
      .evaluateAll((cards) => cards.map((c) => c.getBoundingClientRect().top));
    steps.forEach((top, index) =>
      check(
        Math.abs(top - (80 + index * 12)) < 2,
        "Deck stays sticky at the viewport top",
      ),
    );
    const scales = await page
      .locator(".sh-stack-surface")
      .evaluateAll((es) =>
        es.map((el) => new DOMMatrix(getComputedStyle(el).transform).a),
      );
    check(
      scales.every(
        (scale, index) => Math.abs(scale - (1 - (5 - index) * 0.06)) < 0.003,
      ),
      "Final deck recedes in accumulated layers",
    );
    const shades = await page
      .locator(".sh-stack-shade")
      .evaluateAll((es) =>
        es.map((el) => Number(getComputedStyle(el).opacity)),
      );
    check(
      shades.every(
        (shade, index) => Math.abs(shade - (5 - index) * 0.18) < 0.003,
      ),
      "Final deck overlay depths",
    );
    check(
      await page
        .locator(".sh-stack-shade")
        .evaluateAll((es) =>
          es.every((el) => getComputedStyle(el).pointerEvents === "none"),
        ),
      "Deck overlays preserve pointer access",
    );
    await screenshot(page, `final-stack-${locale}-1440.png`);
    const hold = await page
      .locator(".sh-stack-flow > div:last-child > div:last-child")
      .evaluate((el) => el.offsetHeight);
    await scroll(page, finalY + hold / 2);
    check(
      await page
        .locator(".sh-stack-card")
        .evaluateAll((cards) =>
          cards.every(
            (card, i) =>
              Math.abs(card.getBoundingClientRect().top - (80 + i * 12)) < 2,
          ),
        ),
      "Complete final stack holds before exiting",
    );
    await scroll(page, finalY + hold + 100);
    const exiting = await page
      .locator(".sh-stack-card")
      .evaluateAll((cards) =>
        cards.map((card) => card.getBoundingClientRect().top),
      );
    check(
      exiting[0] < 80 &&
        exiting.every((top, i) => Math.abs(top - exiting[0] - i * 12) < 2),
      "All layers exit together with their step offsets intact",
    );
    await scroll(page, finalY + hold + cardHeight);
    check(
      await page
        .locator("#getting-started")
        .evaluate((el) => el.getBoundingClientRect().top < innerHeight / 2),
      "Continuing scroll reveals the next section",
    );
    await screenshot(page, `stack-exit-${locale}-1440.png`);
    await scroll(page, origins[1] - 92 - cardHeight / 2);
    const reversed = await page
      .locator(".sh-stack-surface")
      .first()
      .evaluate((el) => ({
        scale: new DOMMatrix(getComputedStyle(el).transform).a,
        shade: Number(
          getComputedStyle(el.querySelector(".sh-stack-shade")).opacity,
        ),
      }));
    check(
      Math.abs(reversed.scale - halfLayer.scale) < 0.002 &&
        Math.abs(reversed.shade - halfLayer.shade) < 0.003,
      "Scrolling upward reverses the same progress naturally",
    );
    await scroll(page, 0);
    check(
      await page
        .locator(".sh-stack-surface")
        .evaluateAll((surfaces) =>
          surfaces.every(
            (el) => new DOMMatrix(getComputedStyle(el).transform).a === 1,
          ),
        ),
      "Returning above the section restores the initial state",
    );
    await scroll(page, finalY);
    const lastCard = await page.locator(".sh-stack-card").last().boundingBox();
    await page.mouse.move(lastCard.x + lastCard.width / 2, lastCard.y + 150);
    const beforeDeckWheel = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(300);
    check(
      await page.evaluate((y) => scrollY > y, beforeDeckWheel),
      "Wheel over the deck continues scrolling the document",
    );
    check(
      await page.evaluate(() => window.stackLayoutShift < 0.01),
      "No unexpected card layout shift during load and scrolling",
    );

    await page.emulateMedia({ reducedMotion: "reduce" });
    await settle(page);
    check(
      (await page
        .locator(".sh-feature-stack")
        .getAttribute("data-stacking")) === "true",
      "Reduced motion preserves native sticky overlap",
    );
    check(
      await page
        .locator(".sh-stack-surface")
        .evaluateAll((cards) =>
          cards.every(
            (c) =>
              getComputedStyle(c).transform === "none" &&
              getComputedStyle(c).filter === "none",
          ),
        ),
      "Reduced motion restores all readable surfaces",
    );
    check(
      await page
        .locator(".sh-stack-shade")
        .evaluateAll((es) =>
          es.every((e) => Number(getComputedStyle(e).opacity) === 0),
        ),
      "Reduced motion removes overlay darkening",
    );
    check(
      await page
        .locator(".sh-stack-flow")
        .evaluate((sc) => getComputedStyle(sc).overflowY === "visible"),
      "Reduced-motion cards remain in document flow",
    );
    await scroll(page, 0);
    const reducedOrigin = await page
      .locator(".sh-stack-card")
      .nth(1)
      .evaluate((el) => el.getBoundingClientRect().top + scrollY);
    await scroll(page, reducedOrigin - 92);
    check(
      await page
        .locator(".sh-stack-card")
        .evaluateAll(
          (cards) =>
            Math.abs(cards[0].getBoundingClientRect().top - 80) < 2 &&
            Math.abs(cards[1].getBoundingClientRect().top - 92) < 2,
        ),
      "Reduced-motion cards still overlap through native document scrolling",
    );
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await settle(page);

    const zoom = page.locator(".sh-guide-zoom").first();
    await zoom.focus();
    await settle(page);
    check(
      (await page
        .locator(".sh-feature-stack")
        .getAttribute("data-stacking")) === "false",
      "Keyboard focus expands covered cards",
    );
    check(
      await zoom.evaluate((el) => getComputedStyle(el).outlineStyle !== "none"),
      "Focus-visible outline",
    );
    await page.keyboard.press("Enter");
    check(
      (await page.locator("dialog[open]").count()) === 1,
      "Keyboard opens screenshot",
    );
    await page.keyboard.press("Escape");
    check(
      (await page.locator("dialog[open]").count()) === 0,
      "Escape closes screenshot",
    );
    check(
      await zoom.evaluate((el) => document.activeElement === el),
      "Dialog restores trigger focus",
    );
    await page.mouse.wheel(0, 20);
    await page.waitForTimeout(150);
    check(
      (await page
        .locator(".sh-feature-stack")
        .getAttribute("data-stacking")) === "true",
      "Mouse-wheel browsing restores stacking after keyboard interaction",
    );
    await page.locator("#features-title").evaluate((el) => {
      el.tabIndex = -1;
      el.focus();
    });

    const faq = page.locator(".sh-features-faq summary").first();
    await faq.focus();
    await page.keyboard.press("Enter");
    check(
      (await page.locator(".sh-features-faq details[open]").count()) === 1,
      "FAQ keyboard interaction",
    );

    await page.locator(".sh-features-appearance button").click();
    check(
      (await page.locator(".sh-features").getAttribute("data-theme")) ===
        "dark",
      "Dark appearance control",
    );
    await scroll(page, 0);
    await screenshot(page, `hero-${locale}-1440-dark.png`);
    await audit(page, `${locale}-dark`);
    await page.reload({ waitUntil: "networkidle" });
    check(
      (await page.locator(".sh-features").getAttribute("data-theme")) ===
        "dark",
      "Appearance persists",
    );
    for (const width of [320, 360, 390, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await settle(page);
      const overflow = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
        elements: [...document.querySelectorAll("body *")]
          .filter((e) => {
            const r = e.getBoundingClientRect();
            return (
              r.width &&
              (r.right > innerWidth + 1 || r.left < -1) &&
              getComputedStyle(e).position !== "fixed" &&
              !e.closest("dialog")
            );
          })
          .map((e) => `${e.tagName}.${e.className}`)
          .slice(0, 8),
      }));
      check(
        overflow.scroll <= overflow.width,
        `No overflow ${locale}/${width}: ${JSON.stringify(overflow)}`,
      );
      check(
        await page
          .locator(".sh-feature-steps li")
          .evaluateAll((steps) =>
            steps.every((el) => el.scrollHeight <= el.clientHeight + 1),
          ),
        `No clipped instructions ${width}`,
      );
      check(
        await page
          .locator(".sh-stack-card")
          .evaluateAll((cards) =>
            cards.every((card) => getComputedStyle(card).position === "sticky"),
          ),
        `Narrow and wide viewports both retain native stacking ${width}`,
      );
      if ([390, 768].includes(width)) {
        await scroll(page, 0);
        await screenshot(page, `hero-${locale}-${width}-dark.png`);
        if (width === 390) {
          await page.locator("#feature-courses").screenshot({
            path: path.join(out, `card-${locale}-390-dark.png`),
          });
        }
      }
    }
    await page.setViewportSize({ width: 1024, height: 1024 });
    await scroll(page, 0);
    await settle(page);
    check(
      (await page
        .locator(".sh-feature-stack")
        .getAttribute("data-stacking")) === "true",
      "Tablet keeps the sticky stack when content fits",
    );
    check(
      await page
        .locator(".sh-feature-content")
        .first()
        .evaluate(
          (el) =>
            getComputedStyle(el).gridTemplateColumns.split(" ").length === 2,
        ),
      "Tablet uses two readable columns",
    );
    const tabletLast = await page
      .locator(".sh-stack-card")
      .last()
      .evaluate((el) => el.getBoundingClientRect().top + scrollY);
    await scroll(page, tabletLast - 140);
    check(
      await page
        .locator(".sh-stack-surface")
        .last()
        .evaluate(
          (el) => el.getBoundingClientRect().bottom <= innerHeight - 20,
        ),
      "Tablet final card fits without clipping",
    );
    await screenshot(page, `final-stack-${locale}-1024-dark.png`);
    for (const [width, height] of [
      [1366, 768],
      [1280, 800],
      [768, 1366],
    ]) {
      await page.setViewportSize({ width, height });
      await scroll(page, 0);
      await settle(page);
      check(
        (await page
          .locator(".sh-feature-stack")
          .getAttribute("data-stacking")) === "true",
        `Stack remains active on a fitting laptop/tablet ${width}×${height}`,
      );
      const lastOrigin = await page
        .locator(".sh-stack-card")
        .last()
        .evaluate((el) => el.getBoundingClientRect().top + scrollY);
      await scroll(page, lastOrigin - 140);
      check(
        await page
          .locator(".sh-stack-surface")
          .last()
          .evaluate(
            (el) => el.getBoundingClientRect().bottom <= innerHeight - 20,
          ),
        `Full final card stays inside the viewport ${width}×${height}`,
      );
      if (width === 1366)
        await screenshot(page, `final-stack-${locale}-1366x768-dark.png`);
    }
    // Browser chrome/OS scaling often leaves a laptop only 600–650 CSS px
    // high. Exercise real wheel input, visible overlap and hit-testing here.
    for (const [width, height] of [
      [1366, 650],
      [1280, 640],
      [1440, 600],
      [1024, 600],
      [768, 900],
      [390, 844],
      [320, 700],
    ]) {
      await page.setViewportSize({ width, height });
      await scroll(page, 0);
      await settle(page);
      check(
        (await page
          .locator(".sh-feature-stack")
          .getAttribute("data-stacking")) === "true",
        `Short/tall-card viewport keeps stacking ${width}×${height}`,
      );
      const geometry = await page
        .locator(".sh-stack-card")
        .evaluateAll((cards) => ({
          top: parseFloat(getComputedStyle(cards[0]).top),
          origins: cards.map(
            (card) => card.getBoundingClientRect().top + scrollY,
          ),
        }));
      await scroll(page, geometry.origins[1] - geometry.top - 12 - 120);
      await page.mouse.move(width / 2, height / 2);
      const before = await page.evaluate(() => scrollY);
      await page.mouse.wheel(0, 240);
      await page.waitForTimeout(200);
      check(
        await page.evaluate((y) => scrollY > y, before),
        `Real wheel scrolls the page ${width}×${height}`,
      );
      check(
        await page.locator(".sh-stack-card").evaluateAll((cards) => {
          const first = cards[0]
            .querySelector(".sh-stack-surface")
            .getBoundingClientRect();
          const next = cards[1].getBoundingClientRect();
          const pointY = Math.max(8, next.top + 140);
          const front = document.elementFromPoint(
            next.left + next.width / 4,
            pointY,
          );
          return (
            next.top < first.bottom &&
            front?.closest(".sh-stack-card") === cards[1]
          );
        }),
        `Next card visibly covers the previous card ${width}×${height}`,
      );
      check(
        await page
          .locator(".sh-stack-surface")
          .first()
          .evaluate(
            (el) =>
              new DOMMatrix(getComputedStyle(el).transform).a < 1 &&
              Number(
                getComputedStyle(el.querySelector(".sh-stack-shade")).opacity,
              ) > 0,
          ),
        `Covered card shrinks and darkens ${width}×${height}`,
      );
      await scroll(page, geometry.origins[5] - geometry.top - 60);
      check(
        await page.locator(".sh-stack-card").evaluateAll((cards) => {
          const base = parseFloat(getComputedStyle(cards[0]).top);
          return cards.every(
            (card, index) =>
              Math.abs(card.getBoundingClientRect().top - base - index * 12) <
              2,
          );
        }),
        `Adaptive final stack retains the 12px steps ${width}×${height}`,
      );
      check(
        await page
          .locator(".sh-stack-surface")
          .last()
          .evaluate(
            (el) => el.getBoundingClientRect().bottom <= innerHeight - 20,
          ),
        `Tall final card's bottom stays reachable ${width}×${height}`,
      );
      check(
        await page.locator(".sh-feature-copy").evaluateAll((copies) =>
          copies.every((copy) => {
            const surface = copy.closest(".sh-stack-surface");
            return copy.offsetHeight <= surface.offsetHeight;
          }),
        ),
        `Instructions remain inside the full card ${width}×${height}`,
      );
      if (width === 1366)
        await screenshot(page, `adaptive-stack-${locale}-1366x650-dark.png`);
      await scroll(page, 0);
      check(
        await page
          .locator(".sh-stack-surface")
          .first()
          .evaluate(
            (el) => new DOMMatrix(getComputedStyle(el).transform).a === 1,
          ),
        `Short-viewport scroll reverses naturally ${width}×${height}`,
      );
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await scroll(page, 0);
    const other = locale === "vi" ? "en" : "vi";
    await page
      .locator(`.header-tools .language-switch a[hreflang="${other}"]`)
      .click();
    await page.waitForLoadState("networkidle");
    check(
      new URL(page.url()).pathname === "/features",
      "Language switch retains Features route",
    );
    check(
      (await page.locator("html").getAttribute("lang")) === other,
      "Language switch updates page",
    );
    check(errors.length === 0, `No browser exceptions: ${errors}`);
    await page.goto(`${base}/?lang=${locale}`, { waitUntil: "networkidle" });
    await page
      .locator(`.desktop-navigation a[href="/features?lang=${locale}"]`)
      .click();
    await page.waitForLoadState("networkidle");
    check(
      new URL(page.url()).pathname === "/features",
      "Homepage desktop Features link",
    );
    results.push({ locale, status: "passed" });
    await context.close();
  }
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await mobile.newPage();
  await page.goto(base + "/?lang=en", { waitUntil: "networkidle" });
  await page.locator(".mobile-trigger").click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Features", exact: true })
    .click();
  await page.waitForLoadState("networkidle");
  check(
    new URL(page.url()).pathname === "/features",
    "Homepage mobile Features link",
  );
  await scroll(page, 0);
  const mobileCardOrigin = await page
    .locator(".sh-stack-card")
    .first()
    .evaluate((el) => el.getBoundingClientRect().top + scrollY);
  await scroll(page, mobileCardOrigin - 20);
  const beforeTouchScroll = await page.evaluate(() => scrollY);
  const touch = await mobile.newCDPSession(page);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 180, y: 700 }],
  });
  for (let step = 1; step <= 10; step++) {
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 180, y: 700 - step * 40 }],
    });
    await page.waitForTimeout(30);
  }
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(200);
  check(
    await page.evaluate((before) => scrollY > before, beforeTouchScroll),
    "Touch over a feature card scrolls the document",
  );
  check(
    (await page.locator(".sh-feature-stack").getAttribute("data-stacking")) ===
      "true",
    "Phone touch browsing keeps native card overlap",
  );
  await scroll(page, 0);
  await page.locator(".mobile-trigger").click();
  await page.keyboard.press("Escape");
  check(
    await page
      .locator(".mobile-trigger")
      .evaluate((el) => el === document.activeElement),
    "Mobile menu restores focus",
  );
  await mobile.close();

  const nojs = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const nojsPage = await nojs.newPage();
  await nojsPage.goto(base + "/features?lang=en");
  check(
    (await nojsPage.locator(".sh-feature-steps li").count()) === 24,
    "Complete instructions without JS",
  );
  check(
    await nojsPage
      .locator(".sh-stack-card")
      .evaluateAll((cards) =>
        cards.every((c) => getComputedStyle(c).position === "static"),
      ),
    "No-JS readable fallback",
  );
  check(
    (await nojsPage
      .locator('.mobile-noscript a[href="/features?lang=en"]:not([hreflang])')
      .count()) === 1,
    "No-JS mobile navigation",
  );
  check(
    (await nojsPage.locator(".sh-guide-original-link").count()) === 6,
    "Full-size screenshots available without JS",
  );
  await nojs.close();
  const system = await browser.newContext({
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  const systemPage = await system.newPage();
  await systemPage.goto(`${base}/features?lang=en`, {
    waitUntil: "networkidle",
  });
  check(
    (await systemPage.locator(".sh-features").getAttribute("data-theme")) ===
      "dark",
    "Initial appearance follows the system",
  );
  await systemPage.emulateMedia({ colorScheme: "light" });
  await settle(systemPage);
  check(
    (await systemPage.locator(".sh-features").getAttribute("data-theme")) ===
      "light",
    "System appearance changes are respected",
  );
  await system.close();
  console.log(
    JSON.stringify(
      {
        checks,
        results,
        accessibility: axeSource ? "4 audits passed" : "not run",
        status: "passed",
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(out, "results.json"),
    JSON.stringify({ checks, results, status: "passed" }, null, 2),
  );
} finally {
  await browser.close();
}
