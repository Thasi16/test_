// Loopback fixture authentication only. Inference is real and is never mocked.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const frames = JSON.parse(
  readFileSync(
    process.env.AI_FRAMES_FIXTURE || ".runtime/parity/inputs/an-frames.json",
    "utf8",
  ),
).frames;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const reports = [];
try {
  for (const lang of ["vi", "en"]) {
    const context = await browser.newContext({
      viewport: { width: lang === "vi" ? 390 : 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    await context.addInitScript((frames) => {
      localStorage.setItem("signhearing_onboarding_v1", "skipped");
      navigator.mediaDevices.getUserMedia = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 480;
        canvas.height = 480;
        const ctx = canvas.getContext("2d");
        const images = await Promise.all(
          frames.map((src) =>
            createImageBitmap(
              new Blob(
                [
                  Uint8Array.from(atob(src.split(",")[1]), (c) =>
                    c.charCodeAt(0),
                  ),
                ],
                { type: "image/jpeg" },
              ),
            ),
          ),
        );
        let index = 0;
        ctx.drawImage(images[0], 0, 0);
        setInterval(() => {
          ctx.drawImage(images[index++ % images.length], 0, 0);
        }, 1000 / 13);
        return canvas.captureStream(13);
      };
    }, frames);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    // Fixture authentication remains loopback-only. Change only the returned network
    // endpoint so the real new Node proxy and real Linux model handle the request.
    await page.route("**/api/ai/token", async (route) => {
      const response = await route.fetch();
      const config = await response.json();
      assert.equal(response.status(), 200);
      config.endpoint = "/api/ai/infer";
      await route.fulfill({ response, json: config });
    });
    await page.goto("http://127.0.0.1:3000/app/practice/an?lang=" + lang);
    await page.locator(".is-auth-ready").waitFor();
    if (await page.locator("dialog.sh-tour[open]").count())
      await page.keyboard.press("Escape");
    await page.locator("[data-camera-start]").click();
    const pending = page.waitForResponse((r) =>
      r.url().endsWith("/api/ai/infer"),
    );
    await page.locator("[data-ai-record]").click();
    const response = await pending;
    const json = await response.json();
    const body = JSON.parse(response.request().postData());
    assert.equal(body.frames.length, 30);
    assert.equal(response.status(), 200);
    assert.equal(json.success, true);
    assert.equal(json.device, "CPU");
    assert.equal(json.model_name, "SiFormer");
    await page.locator("[data-ai-result]:visible").waitFor();
    assert.deepEqual(errors, []);
    reports.push({
      lang,
      viewport: lang === "vi" ? "mobile" : "desktop",
      status: response.status(),
      frame_count: body.frames.length,
      body_bytes: Buffer.byteLength(response.request().postData()),
      response: json,
      note: "Synthetic camera, loopback auth fixture, real Node transport, original Linux CPU model. Not a live Supabase session.",
    });
    await context.close();
  }
  writeFileSync(
    ".runtime/parity/browser-real-transport.json",
    JSON.stringify(reports, null, 2),
  );
  console.log(
    "PASS: actual 30-frame camera-to-Node-to-Linux-model-to-result flow in VI/EN at mobile/desktop sizes. Loopback fixture auth only.",
  );
} finally {
  await browser.close();
}
