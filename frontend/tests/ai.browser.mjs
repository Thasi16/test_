// Loopback authenticated fixture, synthetic camera and mocked inference.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.AI_TEST_URL || "http://127.0.0.1:8017";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const lang of ["vi", "en"]) {
    const context = await browser.newContext({ viewport: { width: lang === "vi" ? 390 : 1440, height: 1000 }, reducedMotion: "reduce" });
    await context.addInitScript(() => localStorage.setItem("signhearing_onboarding_v1", "skipped"));
    await context.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640; canvas.height = 480;
        canvas.getContext("2d").fillRect(0, 0, 640, 480);
        return canvas.captureStream(13);
      };
    });
    const page = await context.newPage();
    const posts = [], errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (request.method() === "POST") posts.push(new URL(request.url()).pathname); });
    await page.route("**/infer", route => route.fulfill({ status: 200, headers: {
      "Access-Control-Allow-Origin": base, "Access-Control-Allow-Headers": "authorization,content-type",
    }, contentType: "application/json", body: JSON.stringify({ success: true, predicted_gloss: "Test", confidence: 0.5, total_request_time_ms: 50, matches_expected: false }) }));
    await page.goto(`${base}/app/practice/an?lang=${lang}`);
    await page.locator(".is-auth-ready").waitFor();
    if (await page.locator("dialog.sh-tour[open]").count()) await page.keyboard.press("Escape");
    const controls = page.locator("[data-camera-controls]");
    assert.deepEqual(await controls.locator("button").evaluateAll(buttons => buttons.map(b => b.hasAttribute("data-camera-start") ? "start" : b.hasAttribute("data-camera-stop") ? "stop" : b.hasAttribute("data-ai-record") ? "record" : "mirror")), ["start", "stop", "record", "mirror"]);
    assert.equal(await page.locator("[data-ai-file], [data-ai-consent], [data-ai-send]").count(), 0);
    assert.equal(await page.locator("[data-ai-record]").isDisabled(), true);
    await page.locator("[data-camera-start]").click();
    await page.locator("[data-camera]:visible").waitFor();
    assert.deepEqual(posts, []);
    await page.locator("[data-ai-record]").click();
    await page.locator("[data-ai-result]:visible").waitFor({ timeout: 15000 });
    assert.deepEqual(posts, ["/api/ai/token", "/infer"]);
    assert.match(await page.locator("[data-ai-result]").innerText(), /50\.0%/);
    assert.equal(await page.locator("[data-history] li").count(), 0);
    posts.length = 0;
    await page.locator("[data-ai-record]").click();
    await page.locator("[data-camera-stop]").click();
    await page.waitForTimeout(3500);
    assert.deepEqual(posts, []);
    await page.goto(`${base}/app/practice/xin-chao?lang=${lang}`);
    await page.locator(".is-auth-ready").waitFor();
    assert.equal(await page.locator("[data-ai-record]").isDisabled(), true);
    assert.equal(await page.locator("[data-save]").isEnabled(), true);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log("PASS: placement, explicit recording, automatic send, cancellation and unsupported signs on mobile and desktop.");
} finally { await browser.close(); }
