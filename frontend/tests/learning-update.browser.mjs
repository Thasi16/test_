import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.TEST_URL || "http://127.0.0.1:3000";
const out = path.resolve(
  fileURLToPath(new URL("../../.runtime/learning-update-qa", import.meta.url)),
);
await mkdir(out, { recursive: true });
let checks = 0;
const results = [];
function check(value, label) {
  assert.ok(value, label);
  checks++;
}
async function signIn(page, username) {
  await page.locator("#login-username").fill(username);
  await page
    .locator("#login-password")
    .fill("qa-demo-only-not-a-real-password");
  await page.locator("#login-form button[type=submit]").click();
  await page.waitForURL((url) => url.pathname.startsWith("/app"));
  await page.locator(".is-auth-ready .app-frame").waitFor({ state: "visible" });
}
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const locale of ["vi", "en"]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const username = `QA demo ${locale}`;
    await page.goto(`${base}/app/dictionary?lang=${locale}#lookup`, {
      waitUntil: "networkidle",
    });
    await page.waitForURL((url) => url.pathname === "/login");
    check(
      new URL(page.url()).searchParams.get("next") ===
        `/app/dictionary?lang=${locale}#lookup`,
      "Unauthenticated deep link returns through login",
    );
    check(
      (await page.locator("html").getAttribute("lang")) === locale,
      "Localized login page",
    );
    check(
      (await page.locator("#login-form").count()) === 1,
      "Merged login form loads through Next.js",
    );
    await page.screenshot({
      path: path.join(out, `login-${locale}-1440.png`),
      fullPage: true,
    });
    await page.locator("#login-form button[type=submit]").click();
    check(
      await page.locator("[data-login-error]").isVisible(),
      "Empty login validates without navigation",
    );
    check(
      await page
        .locator("#login-username")
        .evaluate((el) => document.activeElement === el),
      "Validation focuses the missing field",
    );
    await signIn(page, username);
    check(
      new URL(page.url()).pathname === "/app/dictionary" &&
        new URL(page.url()).hash === "#lookup",
      "Login restores the requested learning route and fragment",
    );
    check(
      await page.evaluate(
        (name) =>
          window.SH.auth.isAuthenticated() &&
          window.SH.auth.username() === name,
        username,
      ),
      "Merged demo-auth state is available",
    );
    check(
      await page.evaluate(
        () =>
          !JSON.stringify({ ...localStorage }).includes(
            "qa-demo-only-not-a-real-password",
          ) && !document.cookie.includes("qa-demo-only-not-a-real-password"),
      ),
      "Demo password is never stored",
    );
    const toggle = page.locator("[data-sidebar-toggle]");
    await toggle.click();
    check(
      (await toggle.getAttribute("aria-expanded")) === "false",
      "Sidebar can collapse",
    );
    check(
      await page
        .locator(".app-column")
        .evaluate((el) => el.getBoundingClientRect().left < 2),
      "Collapsed sidebar releases its layout space",
    );
    await page.reload({ waitUntil: "networkidle" });
    check(
      (await page
        .locator("[data-sidebar-toggle]")
        .getAttribute("aria-expanded")) === "false",
      "Sidebar preference survives reload",
    );
    await page.locator("[data-sidebar-toggle]").click();
    check(
      await page
        .locator(".app-column")
        .evaluate((el) => el.getBoundingClientRect().left >= 180),
      "Sidebar expands again",
    );

    for (const route of [
      "/app",
      "/app/courses",
      "/app/lessons/1",
      "/app/dictionary",
      "/app/signs/am",
      "/app/practice",
      "/app/practice/am",
      "/app/review",
      "/app/review/quiz/1",
      "/app/progress",
      "/app/settings",
      "/app/account",
    ]) {
      const response = await page.goto(`${base}${route}?lang=${locale}`, {
        waitUntil: "networkidle",
      });
      check(
        response.status() === 200 && new URL(page.url()).pathname === route,
        `Learning route works: ${route}`,
      );
      check(
        await page.locator(".app-content").isVisible(),
        `Learning content is visible: ${route}`,
      );
      check(
        (await page.locator("html").getAttribute("lang")) === locale,
        `Learning locale: ${route}`,
      );
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Desktop content fits: ${route}`,
      );
    }
    check(
      (await page.locator("[data-account-name]").innerText()) === username,
      "Account displays the chosen demo name",
    );
    await page.locator("[data-plan-choice]").first().click();
    check(
      (await page.locator("[data-plan-message]").innerText()).includes("Free"),
      "Plan preview reports that payment is not connected",
    );
    await page.screenshot({
      path: path.join(out, `account-${locale}-1440.png`),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Account fits a phone viewport",
    );
    await page.locator("[data-sidebar-toggle]").click();
    check(
      await page
        .locator(".app-sidebar")
        .evaluate((el) => getComputedStyle(el).display === "none"),
      "Phone sidebar hides without reserving space",
    );
    await page.locator("[data-sidebar-toggle]").click();
    await page.screenshot({
      path: path.join(out, `account-${locale}-390.png`),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    // This browser context is disposable test state, never the user's profile.
    const progress = await page.evaluate(() => {
      if (!window.SH.store.isFavorite("am"))
        window.SH.store.toggleFavorite("am");
      return localStorage.getItem("signhearing:v1");
    });
    await page.locator("[data-account-logout]").click();
    await page.waitForURL((url) => url.pathname === "/login");
    check(
      await page.evaluate(
        () =>
          !localStorage.getItem("signhearing:demo-auth") &&
          !localStorage.getItem("signhearing:demo-user"),
      ),
      "Logout removes only demo authentication",
    );
    check(
      await page.evaluate(
        (saved) => localStorage.getItem("signhearing:v1") === saved,
        progress,
      ),
      "Logout retains browser-local learning progress",
    );
    await page.goto(`${base}/app/account?lang=${locale}`, {
      waitUntil: "networkidle",
    });
    await page.waitForURL((url) => url.pathname === "/login");
    await signIn(page, username);
    check(
      await page.evaluate(() => window.SH.store.isFavorite("am")),
      "Progress survives logging in again",
    );
    await page.locator("[data-shell-logout]").click();
    await page.waitForURL((url) => url.pathname === "/login");
    check(true, "Topbar logout works");
    await page.goto(
      `${base}/login?lang=${locale}&next=${encodeURIComponent("https://untrusted.invalid/escape")}`,
      { waitUntil: "networkidle" },
    );
    await signIn(page, username);
    check(
      new URL(page.url()).origin === new URL(base).origin &&
        new URL(page.url()).pathname === "/app",
      "Login rejects external return destinations",
    );
    check(errors.length === 0, `No browser/CSP errors: ${errors.join("; ")}`);
    results.push({ locale, status: "passed" });
    await context.close();
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(
    `${base}/login?lang=vi&next=${encodeURIComponent("/app/courses?lang=vi#lesson")}`,
    { waitUntil: "networkidle" },
  );
  await page.locator('.language-switch a[hreflang="en"]').click();
  await page.waitForLoadState("networkidle");
  check(
    (await page.locator("html").getAttribute("lang")) === "en",
    "Language can change on login",
  );
  await signIn(page, "QA language switch");
  check(
    new URL(page.url()).searchParams.get("lang") === "en",
    "Login keeps the selected language on the return route",
  );
  await context.close();
  const animated = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "no-preference",
  });
  const animatedPage = await animated.newPage();
  await animatedPage.goto(`${base}/?lang=vi`, { waitUntil: "networkidle" });
  await animatedPage.locator(".header-cta").click();
  await animatedPage.waitForURL((url) => url.pathname === "/login");
  check(true, "Preserved homepage CTA opens the new demo login");
  await animatedPage.locator("#login-username").fill("QA animated login");
  await animatedPage.locator("#login-password").fill("demo-only");
  await animatedPage.locator("#login-form button[type=submit]").click();
  check(
    (await animatedPage
      .locator("[data-login-transition]")
      .getAttribute("aria-hidden")) === "false",
    "Normal-motion login shows the merged transition",
  );
  await animatedPage.waitForURL((url) => url.pathname === "/app");
  check(
    await animatedPage.locator(".app-content").isVisible(),
    "Normal-motion login finishes in the learning area",
  );
  await animated.close();
  await writeFile(
    path.join(out, "results.json"),
    JSON.stringify({ checks, results, status: "passed" }, null, 2) + "\n",
  );
  console.log(JSON.stringify({ checks, results, status: "passed" }, null, 2));
} finally {
  await browser.close();
}
