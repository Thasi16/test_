// Run against a local backend; OAuth responses are intercepted, never sent to Google.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.TEST_URL || "http://127.0.0.1:8008";
const output = new URL("../../.runtime/oauth-ui/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
let checks = 0;
try {
  for (const lang of ["vi", "en"]) {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${base}/login?lang=${lang}&next=/app/progress`);
      const button = page.locator("[data-google-login]");
      assert.equal(await button.count(), 1);
      assert.equal(
        await button.innerText(),
        lang === "en" ? "Continue with Google" : "Tiếp tục với Google",
      );
      await button.focus();
      assert.equal(
        await button.evaluate((el) => el === document.activeElement),
        true,
      );
      const box = await button.boundingBox();
      assert.ok(box.width > 200 && box.height >= 48);
      assert.ok(await page.locator(".login-mascot-wrap img").isVisible());
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.screenshot({
        path: new URL(`login-${lang}-${width}.png`, output).pathname.replace(
          /^\/(\w:)/,
          "$1",
        ),
        fullPage: true,
      });
      await page.locator("[data-auth-toggle]").click();
      assert.ok(await page.locator("#register-confirm").isVisible());
      assert.ok(await button.isVisible());
      assert.equal(
        await page.locator("#login-password").getAttribute("autocomplete"),
        "new-password",
      );
      let calls = 0;
      let finish;
      const gate = new Promise((resolve) => {
        finish = resolve;
      });
      await page.route("**/api/auth/google", async (route) => {
        calls++;
        const body = route.request().postDataJSON();
        assert.equal(body.lang, lang);
        assert.equal(body.next, `/app/progress?lang=${lang}`);
        await gate;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "google_not_configured" } }),
        });
      });
      await button.press("Enter");
      await page.waitForFunction(
        () => document.querySelector("[data-google-login]").disabled,
      );
      assert.equal(await button.getAttribute("aria-busy"), "true");
      await button.dispatchEvent("click");
      assert.equal(calls, 1);
      assert.ok(await page.locator(".login-submit").isDisabled());
      finish();
      await page.locator("[data-login-error]").waitFor({ state: "visible" });
      assert.match(
        await page.locator("[data-login-error]").textContent(),
        /Supabase/,
      );
      assert.ok(await button.isEnabled());
      assert.equal(
        await page.locator(".login-card").evaluate((el) => el.scrollLeft),
        0,
        "Register card must not scroll horizontally",
      );
      assert.equal(
        await page.locator("#login-password").getAttribute("type"),
        "password",
      );
      assert.equal(
        await page.evaluate(() =>
          Object.keys(localStorage).some((key) =>
            /token|session|supabase/i.test(key),
          ),
        ),
        false,
      );
      await page.screenshot({
        path: new URL(`register-${lang}-${width}.png`, output).pathname.replace(
          /^\/(\w:)/,
          "$1",
        ),
        fullPage: true,
      });
      await page.goto(`${base}/login?lang=${lang}&oauth_error=oauth_cancelled`);
      await page.locator("[data-login-error]").waitFor({ state: "visible" });
      assert.equal(page.url().includes("oauth_error"), false);
      assert.match(
        await page.locator("[data-login-error]").textContent(),
        /hủy|cancelled/,
      );
      await page.unroute("**/api/auth/google");
      await page.route("**/api/auth/google", (route) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ url: `${base}/mock-google-provider` }),
        }),
      );
      await page.route("**/mock-google-provider", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: "<p>Mock OAuth provider</p>",
        }),
      );
      await button.click();
      await page.waitForURL("**/mock-google-provider");
      assert.deepEqual(errors, []);
      checks++;
      await context.close();
    }
  }
  console.log(`Passed ${checks} VI/EN desktop/mobile OAuth UI scenarios.`);
} finally {
  await browser.close();
}
