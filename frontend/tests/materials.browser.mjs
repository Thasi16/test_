// Run backend/tests/materials_preview.py first; never uses real accounts.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.MATERIALS_TEST_URL || "http://127.0.0.1:8011";
const landing = process.env.TEST_URL || "http://127.0.0.1:3011";
const out = new URL("../../.runtime/materials-ui/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
let scenarios = 0;
try {
  for (const lang of ["vi", "en"]) {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
      });
      await context.addInitScript(() =>
        localStorage.setItem("signhearing_onboarding_v1", "skipped"),
      );
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${base}/app/courses?lang=${lang}`);
      await page.locator(".is-auth-ready").waitFor();
      const tour = page.locator("dialog.sh-tour[open]");
      if (await tour.count()) await page.keyboard.press("Escape");
      assert.equal(await page.locator(".courses-lesson.is-open").count(), 18);
      assert.match(
        await page.locator(".app-footer").innerText(),
        /VSL400 \(Zenodo\).*CC BY 4.0/s,
      );
      if (width < 700)
        assert.ok(
          (await page.locator(".app-footer-copy").boundingBox()).width >
            width * 0.75,
        );
      await page.goto(`${base}/app/dictionary?lang=${lang}`);
      await page.locator("[data-toolbar]:visible").waitFor();
      assert.equal(await page.locator(".dictionary-item").count(), 408);
      await page.locator('[data-module-filter="local"]').click();
      assert.equal(await page.locator(".dictionary-item:visible").count(), 12);
      await page.locator('[data-module-filter="all"]').click();
      await page.locator("[data-search-input]").fill("con meo");
      assert.equal(
        await page
          .locator('.dictionary-item[data-slug="con-meo"]:visible')
          .count(),
        1,
      );
      await page.goto(`${base}/app/lessons/18?lang=${lang}`);
      await page.locator(".is-auth-ready").waitFor();
      assert.equal(await page.locator("article[data-slug]").count(), 10);
      assert.equal(
        await page
          .locator(".lesson-media, .lesson-observe, [data-quiz]")
          .count(),
        0,
      );
      const slug = await page
        .locator("article[data-slug]:visible")
        .getAttribute("data-slug");
      await page.locator("article:visible [data-mark-seen]").click();
      await page.waitForFunction(
        (slug) => window.SH.store.isSignSeen(slug),
        slug,
      );
      await page.reload();
      await page.waitForFunction(
        (slug) => window.SH?.store.isSignSeen(slug),
        slug,
      );
      await page.locator("[data-previous]").click();
      const favorite = page.locator("article:visible [data-favorite]");
      if ((await favorite.getAttribute("aria-pressed")) !== "true")
        await favorite.click();
      await page.waitForFunction(
        () =>
          document
            .querySelector("article:not([hidden]) [data-favorite]")
            .getAttribute("aria-pressed") === "true",
      );
      await page.screenshot({
        path: fileURLToPath(new URL(`lesson-${lang}-${width}.png`, out)),
        fullPage: true,
      });
      await page.goto(`${base}/app/lessons/1?lang=${lang}`);
      const video = page.locator("article:visible video");
      await video.waitFor();
      await page.waitForFunction(
        () =>
          document.querySelector("article:not([hidden]) video")?.readyState >=
          2,
      );
      await video.click();
      await page.waitForFunction(
        () => !document.querySelector("article:not([hidden]) video").paused,
      );
      await video.press("Space");
      await page.waitForFunction(
        () => document.querySelector("article:not([hidden]) video").paused,
      );
      await video.press("Enter");
      await page.waitForFunction(
        () => !document.querySelector("article:not([hidden]) video").paused,
      );
      await page.goto(`${base}/app/signs/xin-chao?lang=${lang}`);
      assert.equal(await page.locator(".dictionary-detail").count(), 1);
      await page.goto(`${landing}/?lang=${lang}`);
      const footer = page.locator(".footer-attribution");
      assert.match(await footer.innerText(), /VSL400 \(Zenodo\).*CC BY 4.0/s);
      if (width < 700)
        assert.ok((await footer.boundingBox()).width > width * 0.75);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await footer.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: fileURLToPath(new URL(`footer-${lang}-${width}.png`, out)),
      });
      assert.deepEqual(errors, []);
      scenarios++;
      await context.close();
    }
  }
  console.log(
    `Passed ${scenarios} materials/footer scenarios: VI/EN, mobile/desktop, video controls, filters and saved progress.`,
  );
} finally {
  await browser.close();
}
