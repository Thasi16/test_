// Uses the loopback authenticated fixture server and the REAL local SiFormer API.
// Start backend/tests/materials_preview.py on AI_TEST_URL's port, plus inference.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.AI_TEST_URL || "http://127.0.0.1:8017";
const video = fileURLToPath(new URL("../../static/media/local-videos/an.mp4", import.meta.url));
const output = new URL("../../.runtime/ai-ui/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
try {
  for (const lang of ["vi", "en"]) {
    const context = await browser.newContext({ viewport: { width: lang === "vi" ? 390 : 1440, height: 1000 },
      permissions: ["camera"], reducedMotion: "reduce" });
    await context.addInitScript(() => localStorage.setItem("signhearing_onboarding_v1", "skipped"));
    await context.addInitScript(() => {
      // Deterministic synthetic camera; no physical webcam or OS device required.
      navigator.mediaDevices.getUserMedia = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640; canvas.height = 480;
        const draw = canvas.getContext("2d");
        draw.fillStyle = "#6688aa"; draw.fillRect(0, 0, 640, 480);
        const stream = canvas.captureStream(13);
        const timer = setInterval(() => {
          draw.fillStyle = `hsl(${Date.now() % 360},50%,60%)`;
          draw.fillRect(100, 100, 100, 100);
        }, 50);
        stream.getTracks()[0].addEventListener("ended", () => clearInterval(timer));
        return stream;
      };
    });
    const page = await context.newPage();
    const errors = [];
    const posts = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => { if (request.method() === "POST") posts.push(new URL(request.url()).pathname); });
    await page.goto(`${base}/app/practice/an?lang=${lang}`);
    await page.locator(".is-auth-ready").waitFor();
    if (await page.locator("dialog.sh-tour[open]").count()) await page.keyboard.press("Escape");
    await page.locator("[data-ai-controls]:visible").waitFor();
    await page.locator("[data-ai-file]").setInputFiles(video);
    assert.equal(await page.locator("[data-ai-send]").isDisabled(), true);
    assert.deepEqual(posts, []); // Choosing a file never uploads automatically.
    await page.locator("[data-ai-consent]").check();
    await page.locator("[data-ai-send]").click();
    await page.locator("[data-ai-result]:visible").waitFor({ timeout: 60000 });
    assert.match(await page.locator("[data-ai-result]").innerText(), /\d+(\.\d+)?%/);
    assert.deepEqual(posts, ["/api/ai/token", "/infer"]);
    assert.equal(await page.locator("[data-history] li").count(), 0);
    await page.locator("[data-ai]").screenshot({ path: fileURLToPath(new URL(`result-${lang}.png`, output)) });

    // Disconnected inference must not clear the existing account session.
    await page.route("**/infer", (route) => route.abort("connectionrefused"));
    await page.locator("[data-ai-send]").click();
    await page.waitForFunction(() => /không khả dụng|unavailable/.test(document.querySelector("[data-ai-status]").textContent));
    assert.equal(await page.locator(".is-auth-ready").count(), 1);
    assert.equal(await page.locator("[data-save]").isEnabled(), true);
    await page.unroute("**/infer");
    await page.locator("[data-ai-clear]").click();
    assert.equal(await page.locator("[data-ai-preview]").isVisible(), false);
    assert.equal(await page.locator("[data-ai-send]").isDisabled(), true);

    // Fake camera tests recording without opening the user's physical webcam.
    await page.locator("[data-camera-start]").click();
    await page.locator("[data-camera]:visible").waitFor();
    await page.locator("[data-ai-record]").click();
    await page.locator("[data-ai-preview]:visible").waitFor({ timeout: 10000 });
    assert.equal(await page.locator("[data-ai-send]").isEnabled(), true);
    await page.locator("[data-ai-clear]").click();
    if (await page.locator("[data-camera-stop]").isVisible()) await page.locator("[data-camera-stop]").click();

    await page.goto(`${base}/app/practice/xin-chao?lang=${lang}`);
    await page.locator(".is-auth-ready").waitFor();
    assert.equal(await page.locator("[data-ai-controls]").isVisible(), false);
    assert.equal(await page.locator("[data-save]").isEnabled(), true);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log("PASS: real CPU predictions, VI/EN, mobile/desktop, consent, offline isolation, fake-camera recording and unsupported labels.");
} finally { await browser.close(); }
