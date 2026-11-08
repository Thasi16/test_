/* Self-contained QA: disposable Chrome profile + the real Python app renderer.
   Run from the repository root: node app_shell/tests/onboarding.browser.mjs */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
// Reuse Next's installed WebSocket client; Node 24's bundled undici can fail during CDP upgrades.
const require = createRequire(import.meta.url);
const WebSocket = require(path.join(root, 'frontend/node_modules/next/dist/compiled/ws'));
const out = path.join(root, '.runtime', 'onboarding-qa');
await mkdir(out, { recursive: true });
const profile = await mkdtemp(path.join(out, 'chrome-'));
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const portServer = createServer();
await new Promise(resolve => portServer.listen(0, '127.0.0.1', resolve));
const port = portServer.address().port;
await new Promise(resolve => portServer.close(resolve));
const base = 'http://127.0.0.1:' + port;
const python = spawn(process.env.PYTHON_EXECUTABLE || 'python', ['-B', 'serve.py', '--port', String(port)],
  { cwd: root, windowsHide: true, stdio: 'ignore' });
const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--disable-extensions', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
  '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
await writeFile(path.join(profile, 'qa-processes.json'), JSON.stringify({ python: python.pid, chrome: chrome.pid }));
let ws;
let checks = 0;
let serial = 0;
let scenarioId;
const pending = new Map();
const errors = [];
const requests = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const keyName = 'signhearing_onboarding_v1';
function requestLocal(url, options = {}) {
  return new Promise((resolve, reject) => {
    const request = httpRequest(url, { method: options.method || 'GET', agent: false }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ ok: response.statusCode === 200, json: () => JSON.parse(body) }));
    });
    request.on('error', reject);
    request.setTimeout(3000, () => request.destroy(new Error('Local HTTP timeout')));
    request.end();
  });
}
function check(value, label) { assert.ok(value, label); checks++; }
async function until(fn, label) {
  let lastError;
  for (let i = 0; i < 160; i++) {
    try { const value = await fn(); if (value) return value; } catch (error) { lastError = error; }
    await delay(50);
  }
  throw new Error(label + (lastError ? ': ' + lastError.message : ''));
}
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Timeout: ' + method)); }, 10000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function expect(expression, label) { check(await evaluate(expression), label); }
async function click(selector) { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); }
async function press(key, shift = false) {
  const virtual = { Tab: 9, Enter: 13, Escape: 27, ArrowLeft: 37, ArrowRight: 39 }[key];
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: virtual, modifiers: shift ? 8 : 0,
    ...(key === 'Enter' ? { text: '\r' } : {}) });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: virtual, modifiers: shift ? 8 : 0 });
}
async function scenario(config = {}) {
  if (scenarioId) await cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: scenarioId });
  const result = await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__tourTestToken = Math.random(); window.__tourBackgroundClicks = 0;
    window.__tourObservers = new Set(); window.__tourControllers = [];
    for (const name of ['ResizeObserver', 'MutationObserver']) {
      const Native = window[name];
      window[name] = class extends Native {
        observe(...args) { window.__tourObservers.add(this); return super.observe(...args); }
        disconnect() { window.__tourObservers.delete(this); return super.disconnect(); }
      };
    }
    const Controller = window.AbortController;
    window.AbortController = class extends Controller { constructor() { super(); window.__tourControllers.push(this); } };
    const config = ${JSON.stringify(config)};
    if (config.reset) { localStorage.removeItem('${keyName}'); sessionStorage.removeItem('${keyName}'); }
    if (config.completed) localStorage.setItem('${keyName}', 'completed');
    if (config.collapsed) localStorage.setItem('signhearing:sidebar:collapsed', 'true');
    else localStorage.removeItem('signhearing:sidebar:collapsed');
    if (config.storageBlocked) {
      for (const name of ['localStorage','sessionStorage']) Object.defineProperty(window, name, {
        get() { throw new DOMException('Storage disabled for QA', 'SecurityError'); }, configurable: true
      });
    }
    document.addEventListener('click', event => { if (event.target.closest('.app-nav a')) window.__tourBackgroundClicks++; }, true);
    document.addEventListener('DOMContentLoaded', () => {
      for (const id of config.missing || []) document.querySelector('[data-tour="' + id + '"]')?.remove();
      for (const id of config.hidden || []) { const el = document.querySelector('[data-tour="' + id + '"]'); if(el) el.hidden = true; }
    });
  ` });
  scenarioId = result.identifier;
}
async function navigate(pathname) {
  const previous = await evaluate('window.__tourTestToken || null');
  const destination = base + pathname;
  await cdp('Page.navigate', { url: destination });
  await until(() => evaluate(`window.__tourTestToken !== ${JSON.stringify(previous)} && location.href === ${JSON.stringify(destination)} && document.readyState === 'complete' && !!window.SH && !document.querySelector('[data-tour-start]').hidden`), 'App ready');
  await evaluate('document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))');
}
async function step(id, count) {
  await until(() => evaluate(`document.querySelector('.sh-tour[open]')?.dataset.step === ${JSON.stringify(id)}`), 'Step ' + id);
  if (count) await expect(`document.querySelector('.sh-tour-count').textContent === ${JSON.stringify(count)}`, 'Step counter ' + count);
}
async function layout(label) {
  await delay(70);
  const result = await evaluate(`(() => {
    const panel = document.querySelector('.sh-tour-panel').getBoundingClientRect();
    const ring = document.querySelector('.sh-tour-spotlight').getBoundingClientRect();
    const id = document.querySelector('.sh-tour').dataset.step;
    const target = document.querySelector('[data-tour="' + id + '"]').getBoundingClientRect();
    const overlaps = panel.left < ring.right && panel.right > ring.left && panel.top < ring.bottom && panel.bottom > ring.top;
    return { fits: panel.left >= 10 && panel.top >= 10 && panel.right <= innerWidth - 10 && panel.bottom <= innerHeight - 10,
      ring: Math.abs(ring.left - target.left) <= 6 && Math.abs(ring.top - target.top) <= 6 && Math.abs(ring.right - target.right) <= 6 && Math.abs(ring.bottom - target.bottom) <= 6,
      overlaps, overflow: document.documentElement.scrollWidth > innerWidth };
  })()`);
  check(result.fits, label + ': tooltip fits');
  check(result.ring, label + ': correct target highlighted');
  check(!result.overlaps, label + ': tooltip leaves target visible');
  check(!result.overflow, label + ': no page overflow');
}
async function cleanupCheck() {
  await expect(`!document.querySelector('.sh-tour') && !document.documentElement.classList.contains('has-sh-tour') && !document.body.classList.contains('sh-tour-sidebar-open') && __tourObservers.size === 0 && __tourControllers.every(controller => controller.signal.aborted)`, 'Dialog, observers, listeners and layout overrides cleaned up');
}
async function screenshot(name) {
  const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(path.join(out, name + '.png'), Buffer.from(shot.data, 'base64'));
}

try {
  python.on('error', error => errors.push(error.message));
  chrome.on('error', error => errors.push(error.message));
  await until(async () => (await requestLocal(base + '/app')).ok, 'Python preview server');
  const debugPort = await until(async () => (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0], 'Chrome debugging port');
  const debug = 'http://127.0.0.1:' + debugPort;
  const target = (await requestLocal(debug + '/json/new?about:blank', { method: 'PUT' })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (pending.has(message.id)) {
      const item = pending.get(message.id); pending.delete(message.id); clearTimeout(item.timer);
      if (message.error) item.reject(new Error(JSON.stringify(message.error))); else item.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(message.params.exceptionDetails));
    if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) errors.push(message.params.args.map(arg => arg.value || arg.description).join(' '));
    if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request);
  });
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable');
  await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp('Network.setCookie', { name: 'signhearing_demo_auth', value: '1', url: base });
  console.log('Chrome ready; checking desktop tour.');

  await scenario({ reset: true }); await navigate('/app?lang=vi');
  await step('dashboard', '1 / 8'); await layout('Desktop VI'); await screenshot('desktop-vi');
  await expect(`document.querySelector('[data-tour-action="back"]').disabled`, 'Back disabled on first step');
  await expect(`getComputedStyle(document.querySelector('.sh-tour-spotlight')).transitionDuration === '0s'`, 'Reduced motion');
  for (let i = 0; i < 6; i++) {
    await press('Tab', i % 2 === 0);
    await expect(`document.activeElement.closest('.sh-tour') !== null`, 'Keyboard focus trapped');
  }
  // A real pointer click through the spotlight must advance without following the navigation link.
  const point = await evaluate(`(() => {const r=document.querySelector('[data-tour="dashboard"]').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  await step('courses', '2 / 8');
  await expect(`__tourBackgroundClicks === 0 && location.pathname === '/app'`, 'Highlighted link cannot activate');
  await click('[data-tour-action="back"]'); await step('dashboard');
  await press('ArrowRight'); await step('courses'); await press('ArrowLeft'); await step('dashboard');
  await evaluate(`document.querySelector('.sh-tour').focus()`); await press('Enter'); await step('courses');
  for (const id of ['dictionary', 'practice', 'review', 'progress', 'settings', 'account']) {
    await click('[data-tour-action="next"]'); await step(id); await layout('Desktop ' + id);
  }
  await expect(`document.querySelector('[data-tour-action="next"]').textContent === 'Hoàn tất'`, 'Final action is Finish');
  await click('[data-tour-action="next"]'); await cleanupCheck();
  await expect(`localStorage.getItem('${keyName}') === 'completed'`, 'Completion persisted');
  await scenario(); await navigate('/app?lang=vi');
  await expect(`!document.querySelector('.sh-tour')`, 'Completed tour stays closed after reload');
  await click('[data-tour-start]'); await step('dashboard', '1 / 8');
  await click('[data-tour-action="skip"]'); await cleanupCheck();
  await expect(`localStorage.getItem('${keyName}') === 'skipped' && document.activeElement.matches('[data-tour-start]')`, 'Skip persisted and focus restored');
  await navigate('/app/dictionary?lang=en');
  await expect(`!document.querySelector('.sh-tour')`, 'Skipped tour stays closed on another module and language');
  await click('[data-tour-start]'); await step('dashboard');
  await expect(`document.querySelector('#sh-tour-title').textContent === 'Dashboard'`, 'English tour content');
  await press('Escape'); await cleanupCheck();
  await click('[data-tour="courses"]');
  await until(() => evaluate(`location.pathname === '/app/courses' && document.readyState === 'complete' && !!window.SH`), 'Navigation works after tour');
  checks++;

  // A collapsed sidebar is only revealed temporarily, including on a mobile viewport.
  await scenario({ reset: true, collapsed: true });
  console.log('Desktop controls and persistence passed; checking mobile and landscape.');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: false });
  await navigate('/app/progress?lang=en'); await step('dashboard'); await layout('Mobile collapsed sidebar');
  await expect(`document.body.classList.contains('is-sidebar-collapsed') && getComputedStyle(document.querySelector('.app-sidebar')).display !== 'none'`, 'Collapsed sidebar revealed without changing preference');
  for (const id of ['courses', 'dictionary', 'practice', 'review', 'progress', 'settings', 'account']) {
    await click('[data-tour-action="next"]'); await step(id); await layout('Mobile ' + id);
  }
  await screenshot('mobile-en');
  await expect(`document.querySelector('.app-nav').scrollLeft > 0`, 'Off-screen mobile targets scrolled into view');
  await press('Escape'); await cleanupCheck();
  await expect(`getComputedStyle(document.querySelector('.app-sidebar')).display === 'none' && localStorage.getItem('signhearing:sidebar:collapsed') === 'true'`, 'Sidebar preference restored');
  await click('[data-tour-start]'); await step('dashboard');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 667, height: 375, deviceScaleFactor: 1, mobile: false });
  await layout('Resize to landscape');
  for (const id of ['courses', 'dictionary', 'practice', 'review', 'progress', 'settings', 'account']) {
    await click('[data-tour-action="next"]'); await step(id); await layout('Landscape ' + id);
  }
  await screenshot('landscape'); await press('Escape'); await cleanupCheck();

  await scenario({ reset: true, missing: ['courses'], hidden: ['dictionary'] });
  console.log('Mobile layout passed; checking missing targets and storage fallback.');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await navigate('/app?lang=vi'); await step('dashboard', '1 / 6');
  await click('[data-tour-action="next"]'); await step('practice', '2 / 6');
  await evaluate(`document.querySelector('[data-tour="practice"]').remove()`);
  await step('review', '2 / 5'); await press('Escape'); await cleanupCheck();
  await scenario({ reset: true, missing: ['dashboard','courses','dictionary','practice','review','progress','settings','account'] });
  await navigate('/app?lang=vi');
  await expect(`!document.querySelector('.sh-tour') && !document.body.classList.contains('sh-tour-sidebar-open')`, 'No targets is a safe no-op');
  await scenario({ reset: true, storageBlocked: true }); await navigate('/app?lang=vi');
  await step('dashboard'); await press('Escape'); await cleanupCheck();
  await click('[data-tour-start]'); await step('dashboard'); await press('Escape'); await cleanupCheck();
  await scenario({ reset: true }); await navigate('/app?lang=vi'); await step('dashboard');
  // A pointer click in the dimmed area advances as well.
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: 1200, y: 850, button: 'left', clickCount: 1 });
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 1200, y: 850, button: 'left', clickCount: 1 });
  await step('courses'); await expect(`__tourBackgroundClicks === 0`, 'Dimmed area blocks underlying actions');
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await expect(`getComputedStyle(document.querySelector('.sh-tour-spotlight')).transitionDuration.split(',').every(value => parseFloat(value) === 0.18)`, 'Normal motion enabled');
  await press('Escape'); await cleanupCheck();
  check(errors.length === 0, 'No browser errors: ' + errors.join('\n'));
  check(requests.filter(request => /^https?:/.test(request.url)).every(request => request.url.startsWith(base + '/') && ['GET','HEAD'].includes(request.method)), 'Only local read-only requests');
  const report = { checks, errors, result: 'PASS', screenshots: ['desktop-vi.png','mobile-en.png','landscape.png'] };
  await writeFile(path.join(out, 'results.json'), JSON.stringify(report, null, 2));
  console.log(`PASS: ${checks} onboarding browser checks. Screenshots and report: ${out}`);
} catch (error) {
  console.error(error);
  throw error;
} finally {
  if (ws?.readyState === WebSocket.OPEN) {
    const closed = new Promise(resolve => ws.addEventListener('close', resolve, { once: true }));
    ws.close();
    await Promise.race([closed, delay(1000)]);
  }
  for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('QA finished')); }
  python.kill(); chrome.kill();
}
