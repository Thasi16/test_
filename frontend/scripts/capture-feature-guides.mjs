import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const sharp = require("sharp");
const frontend = fileURLToPath(new URL("../", import.meta.url));
const base = process.env.TEST_URL || "http://127.0.0.1:3000";
const output = path.join(frontend, "public/images/feature-guides");
const viewport = { width: 1440, height: 1000 };
const guides = [
  {
    key: "courses",
    route: "/app/courses",
    asset: "learning-roadmap",
    selectors: ['[data-filter="open"]', 'main a[href^="/app/lessons/1"]'],
  },
  {
    key: "library",
    route: "/app/dictionary",
    asset: "vsl-library",
    selectors: ["[data-search-input]", '[data-module-filter="local"]'],
  },
  {
    key: "video",
    route: "/app/signs/am",
    asset: "sign-learning",
    selectors: ["main video", 'main a[href^="/app/practice/am"]'],
  },
  {
    key: "camera",
    route: "/app/practice/am",
    asset: "camera-practice",
    selectors: ['[data-rate="0.5"]', "[data-camera-start]"],
  },
  {
    key: "review",
    route: "/app/review/quiz/video",
    asset: "review-quiz",
    selectors: ["[data-question-media]", "[data-options]"],
  },
  {
    key: "progress",
    route: "/app/progress",
    asset: "learning-progress",
    selectors: [".progress-stat-grid", "[data-calendar]"],
  },
];

const browser = await chromium.launch({
  ...(process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH }
    : { channel: "chrome" }),
  headless: true,
});
const only = process.argv.find((arg) => arg.startsWith("--only="))?.slice(7);
if (only && !guides.some((guide) => guide.key === only))
  throw new Error("Unknown capture key");
const manifest = only
  ? JSON.parse(
      await readFile(
        path.join(frontend, "src/data/feature-captures.json"),
        "utf8",
      ),
    )
  : {
      capturedAt: new Date().toISOString(),
      browser: browser.version(),
      viewport,
      method:
        "Playwright screenshot, optimized with Sharp WebP quality 88; no DOM changes or seeded user data",
      captures: {},
    };
try {
  await mkdir(output, { recursive: true });
  for (const locale of ["vi", "en"]) {
    manifest.captures[locale] ||= {};
    for (const guide of guides.filter((item) => !only || item.key === only)) {
      // Each capture has a fresh, nonpersistent context. Never touch the user's profile.
      const context = await browser.newContext({
        viewport,
        deviceScaleFactor: 1,
        colorScheme: "light",
        reducedMotion: "reduce",
        timezoneId: "Asia/Ho_Chi_Minh",
      });
      const page = await context.newPage();
      const response = await page.goto(`${base}${guide.route}?lang=${locale}`, {
        waitUntil: "networkidle",
      });
      if (response.status() !== 200)
        throw new Error(`${guide.route}: HTTP ${response.status()}`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => Boolean(window.SH?.store));
      await page.evaluate(() => window.SH.ready);
      const tour = page.locator("dialog.sh-tour[open]");
      if (await tour.count()) await page.keyboard.press("Escape");
      if (guide.key === "courses")
        await page.locator('[data-filter="open"]').click();
      if (["video", "camera", "review"].includes(guide.key)) {
        await page.waitForFunction(
          () => document.querySelector("main video").readyState >= 2,
        );
      }
      if (guide.key === "progress") {
        const values = await page.locator("[data-stat]").allTextContents();
        if (JSON.stringify(values) !== JSON.stringify(["0/2", "0", "0", "0"]))
          throw new Error(`Unexpected nonempty progress: ${values}`);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.mouse.move(2, 2);
      const annotations = [];
      for (const selector of guide.selectors) {
        const box = await page.locator(selector).first().boundingBox();
        if (!box || box.y < 0 || box.y + box.height > viewport.height)
          throw new Error(
            `Annotation outside capture: ${guide.key} ${selector}`,
          );
        // Place the numbered marker on a corner of the real control, preserving its label.
        annotations.push({
          x: Number(
            (((box.x + box.width - 8) / viewport.width) * 100).toFixed(2),
          ),
          y: Number((((box.y + 8) / viewport.height) * 100).toFixed(2)),
          selector,
        });
      }
      const filename = `${guide.asset}-${locale}.webp`;
      const png = await page.screenshot({
        fullPage: false,
        animations: "disabled",
      });
      const webp = await sharp(png).webp({ quality: 88, effort: 6 }).toBuffer();
      await writeFile(path.join(output, filename), webp);
      manifest.captures[locale][guide.key] = {
        route: guide.route,
        src: `/images/feature-guides/${filename}`,
        annotations,
        bytes: webp.length,
        sha256: createHash("sha256").update(webp).digest("hex"),
        state:
          guide.key === "camera"
            ? "camera off; no media permission requested"
            : guide.key === "progress"
              ? "fresh browser, empty progress"
              : guide.key === "review"
                ? "First video question; video and four answer choices; no quiz submitted"
                : guide.key === "courses"
                  ? "Open filter selected by clicking the existing control"
                  : "first visit; no user data",
      };
      if (only) {
        manifest.captures[locale][guide.key].capturedAt =
          new Date().toISOString();
        manifest.captures[locale][guide.key].browser = browser.version();
      }
      console.log(
        `${guide.key} (${locale}): ${filename} · ${Math.round(webp.length / 1024)} KB`,
      );
      await context.close();
    }
  }
  await mkdir(path.join(frontend, "src/data"), { recursive: true });
  await writeFile(
    path.join(frontend, "src/data/feature-captures.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
} finally {
  await browser.close();
}
