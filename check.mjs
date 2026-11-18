// node check.mjs: validates theme.json and proves the backdrop is upstream's picture and still moves.
//   1. theme.json is what build.mjs produces, fits T3 Code's limits, and uses nothing a theme may not.
//   2. The picture embedded in theme.json is upstream's scene, unchanged, with its reduced-motion rule.
//   3. Text stays readable over the brightest pixel behind the chat, at 12 moments of the glow's loop and two window sizes.
//   4. Drawn the way T3 Code draws it (a CSS background image), the glow moves, and stops under reduced motion.
//   5. When T3 Code is found, the parts of the app the theme hooks into are still there.
// Exits 1 if a hard limit fails.
// Needs a Chromium binary: set CHROMIUM to its path if it is not /usr/bin/chromium.
// To check an installed T3 Code, set T3_APP_ASAR to its app.asar (on Linux a running AppImage is found on its own).
import fs from "node:fs";
import zlib from "node:zlib";
import { chromium } from "playwright-core";
import { SCENE } from "./vendor/backdrops/scene-fractal-glass.js";
import { BACKDROP_MARK, LANE, buildTheme } from "./build.mjs";

const HERE = new URL(".", import.meta.url).pathname;
const MAX_CSS = 100000, LOOP = 12;   // the glow: a 12 s loop
const SIZES = [[1512, 949], [2560, 1440]];
let failed = false;
const hard = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) failed = true; };

// ---- 1. theme.json ------------------------------------------------------------------------------------------------------
let theme;
try { theme = JSON.parse(fs.readFileSync(HERE + "theme.json", "utf8")); console.log("PASS  theme.json parses"); }
catch (e) { console.log("FAIL  theme.json does not parse:", e.message); process.exit(1); }
const built = buildTheme();
hard(JSON.stringify(theme) === JSON.stringify(built.theme), "theme.json is what build.mjs produces");
const hex = /^#[0-9a-f]{6}$/i;
hard(theme.name === "Fractal Glass" && theme.appearance === "dark" && theme.version === 1 && hex.test(theme.canvas) && hex.test(theme.accent) &&
  Object.values(theme.colors).every((v) => hex.test(v)) && typeof theme.css === "string",
  "theme object shape (name, appearance dark, version 1, hex canvas/accent/colors, css string)");
const css = theme.css, cut = css.indexOf(BACKDROP_MARK);
console.log(`INFO  css ${css.length} of ${MAX_CSS} chars: backdrop ${cut}, panels ${css.length - cut}; upstream's scene ${SCENE.length} chars`);
hard(css.length <= MAX_CSS, `css <= ${MAX_CSS} chars`);
hard(cut > 0, "backdrop found ahead of the panels");
const bad = [];
if (/@import/i.test(css)) bad.push("@import");
if (/image-set\(/i.test(css)) bad.push("image-set(");
for (const m of css.matchAll(/url\(\s*(?!["']?(?:data:|#|%23))([^)]{0,40})/gi)) bad.push(`url(${m[1]}`);
hard(!bad.length, `no forbidden pattern (@import, image-set(, url( other than data: or #)${bad.length ? ": " + bad.join(", ") : ""}`);
hard(!css.includes("</"), "no `</` in the css, so it cannot close a <style> element it is placed in");

// ---- 2. the embedded scene is upstream's ---------------------------------------------------------------------------------
// reverses enc() in build.mjs. enc() turns " into ', so the scene must hold no ' of its own for this to be exact.
const embedded = /url\("data:image\/svg\+xml,([^"]*)"\)/.exec(css.slice(0, cut));
const decoded = embedded && embedded[1].replace(/'/g, '"').replace(/%3C/g, "<").replace(/%23/g, "#").replace(/%25/g, "%");
hard(!SCENE.includes("'"), "upstream's scene holds no ' of its own, so reversing the css escaping is exact");
hard(decoded === SCENE, "the scene embedded in the css is upstream's, character for character");
hard(SCENE.includes("@media (prefers-reduced-motion:reduce){.hs,.hv{animation:none}}"), "the scene stops its glow under prefers-reduced-motion");

// ---- 3. contrast behind the chat ---------------------------------------------------------------------------------------
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// ---- rendering ---------------------------------------------------------------------------------------------------------
function decodePng(buf) {   // 8-bit RGB or RGBA, not interlaced: what Chromium's screenshots are
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20), ch = buf[25] === 6 ? 4 : 3, idat = [];
  for (let p = 8; p < buf.length;) { const len = buf.readUInt32BE(p); if (buf.toString("latin1", p + 4, p + 8) === "IDAT") idat.push(buf.subarray(p + 8, p + 8 + len)); p += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), row = w * ch, out = Buffer.alloc(w * h * 3), cur = Buffer.alloc(row), prev = Buffer.alloc(row);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (row + 1)], src = raw.subarray(y * (row + 1) + 1, (y + 1) * (row + 1));
    for (let x = 0; x < row; x++) {
      const a = x >= ch ? cur[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let pr = 0;
      if (f === 1) pr = a; else if (f === 2) pr = b; else if (f === 3) pr = (a + b) >> 1;
      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = (src[x] + pr) & 255;
    }
    for (let x = 0; x < w; x++) for (let q = 0; q < 3; q++) out[(y * w + x) * 3 + q] = cur[x * ch + q];
    cur.copy(prev);
  }
  return { w, h, px: out };
}

const launch = (...flags) => chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--force-device-scale-factor=1", "--hide-scrollbars", ...flags] });
const browser = await launch();
try {
  // ---- 3. contrast ---------------------------------------------------------------------------------------------------------
  // The scene is opened as a document and held at `t` seconds of its 12 s loop: every animation in the document is
  // paused and moved to that time. `t` is a little past a step of the glow, so a screenshot never lands on one.
  const tint = LANE.tint.split(" ").map(Number), SHOTS = 12;
  const blend = (px) => px.map((v, i) => Math.round(v * (1 - LANE.opacity) + tint[i] * LANE.opacity));
  let worstBlend = null;
  for (const [w, h] of SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.goto("data:image/svg+xml;base64," + Buffer.from(SCENE).toString("base64"));
    const mid = 256 + (w - 256) / 2, x0 = Math.round(mid - 384), x1 = Math.round(mid + 384);
    let top = { l: -1, rgb: null, t: 0 };
    for (let i = 0; i < SHOTS; i++) {
      const t = (i * LOOP) / SHOTS + 0.06;
      await page.evaluate((ms) => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = ms; } }, t * 1000);
      const shot = decodePng(await page.screenshot({ type: "png" }));
      for (let y = 0; y < h; y++) for (let x = x0; x < x1; x++) {
        const o = (y * w + x) * 3, rgb = [shot.px[o], shot.px[o + 1], shot.px[o + 2]], l = lum(rgb);
        if (l > top.l) top = { l, rgb, t };
      }
    }
    await page.close();
    const dimmed = blend(top.rgb);
    console.log(`INFO  ${w}x${h}: brightest pixel in the lane rgb(${top.rgb}) at ${top.t.toFixed(2)} s; behind the chat it reads rgb(${dimmed})`);
    if (!worstBlend || lum(dimmed) > lum(worstBlend)) worstBlend = dimmed;
  }
  for (const [role, min] of [["text", 7], ["textMuted", 4.5], ["placeholder", 4.5]]) {
    const r = ratio(rgbOf(theme.colors[role]), worstBlend);
    hard(r >= min, `contrast ${role} ${theme.colors[role]} over the brightest pixel behind the chat = ${r.toFixed(2)}:1 (>= ${min})`);
  }

  // ---- 4. as T3 Code draws it: a CSS background image, running on its own ---------------------------------------------------
  // 24 screenshots spread over one loop plus one second. With motion every few differ from the one before; with
  // reduced motion forced on in the browser, none does.
  const [w, h] = [1280, 720], N = 24, gap = ((LOOP + 1) * 1000) / N;
  const run = async (b) => {
    const page = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.setContent("<!doctype html><meta charset=utf-8><body></body>");
    await page.addStyleTag({ content: css.slice(0, cut) });
    await page.waitForTimeout(500);
    const shots = [];
    for (let i = 0; i < N; i++) { shots.push(await page.screenshot({ type: "png" })); await page.waitForTimeout(gap); }
    await page.close();
    return shots;
  };
  const moving = await run(browser);
  const changed = moving.filter((s, i) => i > 0 && !s.equals(moving[i - 1])).length;
  hard(changed >= 6, `as a CSS background the glow moves: ${changed} of ${N - 1} screenshots over ${LOOP + 1} s differ from the one before (>= 6)`);
  const still = await launch("--force-prefers-reduced-motion");
  try {
    const frozen = await run(still);
    hard(frozen.every((s) => s.equals(frozen[0])), `with reduced motion forced on, all ${N} screenshots over ${LOOP + 1} s are equal`);
  } finally { await still.close(); }
} finally { await browser.close(); }

// ---- 5. T3 Code itself: are the parts the theme hooks into still in the installed app? ------------------------------------
const HOOKS = [
  ["chat area", "data-workspace-area"], ["chat column", "data-chat-column"], ["chat scroller", "messages-timeline-scroll"], ["chat loading state", "data-timeline-loading"],
  ["sidebar", "sidebar-inner"], ["sidebar frame", "sidebar-wrapper"], ["main area", "sidebar-inset"], ["header", "data-chat-header"],
  ["reading lane: left inset", "--chat-lane-inset-start"], ["reading lane: right inset", "--chat-lane-inset-end"], ["reading lane: column width", "--chat-content-max-width"],
];
const asar = process.env.T3_APP_ASAR ?? fs.readdirSync("/tmp").filter((d) => d.startsWith(".mount_T3-Cod")).map((d) => `/tmp/${d}/resources/app.asar`).find((f) => fs.existsSync(f));
if (!asar) console.log("SKIP  T3 Code not found, so its hooks were not checked: set T3_APP_ASAR to its app.asar");
else {
  const app = fs.readFileSync(asar), missing = HOOKS.filter(([, needle]) => !app.includes(needle)).map(([what, needle]) => `${what} (${needle})`);
  hard(!missing.length, `T3 Code at ${asar} still has ${HOOKS.length - missing.length} of the ${HOOKS.length} parts the theme hooks into${missing.length ? "; missing: " + missing.join(", ") : ""}`);
}

console.log(failed ? "RESULT: FAIL" : "RESULT: OK");
process.exit(failed ? 1 : 0);
