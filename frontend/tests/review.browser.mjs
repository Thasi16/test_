// Start backend/tests/materials_preview.py; this test never contacts real Supabase.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.REVIEW_TEST_URL || "http://127.0.0.1:8011";
const out = new URL("../../.runtime/review-ui/", import.meta.url);
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
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${base}/app/review?lang=${lang}`);
      await page.locator(".is-auth-ready").waitFor();
      assert.equal(await page.locator("[data-flash-tools]").count(), 0);
      assert.equal(
        await page.locator(".review-launch-meta strong").first().innerText(),
        "12",
      );
      await page.screenshot({
        path: fileURLToPath(new URL(`landing-${lang}-${width}.png`, out)),
        fullPage: true,
      });
      await page.locator(".review-launch-button").click();
      await page.locator("[data-quiz-app]:visible").waitFor();
      assert.equal(await page.locator("[data-options] button").count(), 4);
      assert.deepEqual(
        await page.locator(".review-option-number").allTextContents(),
        ["A", "B", "C", "D"],
      );
      assert.ok(await page.locator("[data-next-question]").isDisabled());
      const before = await page.evaluate(() => ({
        history: SH.store.quizResults("video").length,
        lessons: SH.data.lessons.map((l) => SH.store.lessonState(l.id)),
      }));
      const posts = [];
      let rejectSave = true;
      await page.route("**/api/learning/events", async (route) => {
        const body = route.request().postDataJSON();
        if (body.type === "quiz") {
          posts.push(body);
          if (rejectSave) {
            rejectSave = false;
            await route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({ error: { code: "learning_unavailable" } }),
            });
            return;
          }
        }
        await route.continue();
      });
      let questions = 0;
      let mistakes = 0;
      while (questions < 12) {
        const correct = await page
          .locator(".review-quiz")
          .getAttribute("data-current-slug");
        const chooseWrong = width === 390;
        const choice = chooseWrong
          ? page
              .locator(`[data-options] button:not([data-slug="${correct}"])`)
              .first()
          : page.locator(`[data-options] button[data-slug="${correct}"]`);
        await choice.click();
        if (chooseWrong) mistakes++;
        assert.equal(
          await page.locator("[data-options] button:enabled").count(),
          0,
        );
        assert.equal(
          await page.locator("[data-options] button.is-correct").count(),
          1,
        );
        if (questions === 0) {
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            true,
          );
          await page.screenshot({
            path: fileURLToPath(new URL(`question-${lang}-${width}.png`, out)),
            fullPage: true,
          });
        }
        questions++;
        if (questions < 12) {
          await page.locator("[data-next-question]").click();
          await page.waitForFunction(
            (expected) =>
              document.querySelector(".review-quiz").dataset.currentSlug !==
              expected,
            correct,
          );
        }
      }
      await page.locator("[data-next-question]").click();
      await page.waitForFunction(
        () => !document.querySelector("[data-next-question]").disabled,
      );
      assert.equal(await page.locator("[data-result]:visible").count(), 0);
      assert.equal(posts.length, 1);
      await page.locator("[data-next-question]").click();
      await page.locator("[data-result]:visible").waitFor();
      assert.equal(posts.length, 2);
      assert.equal(posts[0].event_id, posts[1].event_id);
      assert.equal(posts[1].score, 12 - mistakes);
      assert.equal(posts[1].total, 12);
      assert.equal(posts[1].id, "video");
      assert.equal(
        await page.locator("[data-mistake-list] li").count(),
        mistakes,
      );
      assert.equal(
        await page.locator("[data-result-message]").innerText(),
        await page.evaluate(() => SH.t("review.result.complete")),
      );
      assert.equal(
        await page.evaluate(() => SH.store.quizResults("video").length),
        before.history + 1,
      );
      assert.deepEqual(
        await page.evaluate(() =>
          SH.data.lessons.map((l) => SH.store.lessonState(l.id)),
        ),
        before.lessons,
      );
      await page.screenshot({
        path: fileURLToPath(new URL(`result-${lang}-${width}.png`, out)),
        fullPage: true,
      });
      await page.reload();
      await page.locator("[data-quiz-app]:visible").waitFor();
      assert.equal(
        await page.evaluate(() => SH.store.quizResults("video").length),
        before.history + 1,
      );
      await page.goto(`${base}/app/review?lang=${lang}`);
      await page.locator("[data-best]:visible").waitFor();
      assert.deepEqual(errors, []);
      scenarios++;
      await context.close();
    }
  }
  console.log(
    `Passed ${scenarios} review scenarios: VI/EN, mobile/desktop, correct/wrong answers, save failure/retry, history and progress.`,
  );
} finally {
  await browser.close();
}
