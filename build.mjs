// Regenerates theme.json from the upstream Fractal Glass scene (vendor/backdrops/scene-fractal-glass.js).
//   node build.mjs
// The backdrop is upstream's own animated SVG, unchanged, drawn as a CSS background (a data: URI). The scene is
// 45,639 characters, so it fits in T3 Code's 100,000 characters of theme CSS as it is.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { SCENE } from "./vendor/backdrops/scene-fractal-glass.js";

const HERE = new URL(".", import.meta.url).pathname;

// ---- tuning -----------------------------------------------------------------------------------------------------
// Upstream keeps the chat readable with the glass of the Claude app: tint `4 7 12` at opacity 0.63, no blur, flat
// over the text column and fading out beside it. LANE is that glass in T3 Code's chat area, with the same tint.
// Its opacity is 0.65, not upstream's 0.63: at 0.63 the placeholder colour #a0aec2 reads 4.34:1 over the brightest
// pixel behind the chat, and check.mjs requires 4.5:1. It is flat over the chat's text column plus `pad` on each
// side, then takes `fade` to clear.
export const LANE = { tint: "4 7 12", opacity: 0.65, pad: "1rem", fade: "13rem" };
export const PANEL = { tint: "4 7 12", alpha: 0.86 };   // sidebar and header: this tint at this opacity over the picture

// ---- css --------------------------------------------------------------------------------------------------------
const short = (v, digits = 1) => String(+v.toFixed(digits)).replace(/^(-?)0\./, "$1.");
// `<` is escaped so the scene's own </style> cannot end a <style> element the CSS is ever placed in.
export const enc = (s) => s.replace(/%/g, "%25").replace(/#/g, "%23").replace(/</g, "%3C").replace(/"/g, "'");
export const dataUri = (svg) => `url("data:image/svg+xml,${enc(svg)}")`;
export const BACKDROP_MARK = "/*panels*/";   // everything before this in `css` is the backdrop

export function backdropCss(svg) {
  // The picture is one layer of its own behind the app (will-change keeps it on the compositor), so a step of the
  // glow redraws that layer and nothing else.
  return `html{background:#04070c!important}body{background:none!important}` +
    `html::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;will-change:transform;background:${dataUri(svg)} 50% 50%/100% 100% no-repeat}`;
}

function panelCss() {
  const lane = (a) => `rgb(${LANE.tint} / ${a})`;
  // a smoothstep, as upstream's glass fades: 0 at the lane's edge to 1 at `fade` beyond it
  const steps = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1].map((u) => [u, 1 - u * u * (3 - 2 * u)]);
  const side = (sign) => steps.map(([u, k]) => `${lane(short(LANE.opacity * k, 3))} calc(var(--rc-mid) ${sign} (var(--rc-half)${u ? ` + ${LANE.fade} * ${u}` : ""}))`);
  const stops = [...side("-").reverse(), ...side("+")].join(",");
  return BACKDROP_MARK +
    // the app's own full-window boxes are let through, so the one picture shows behind all of them
    `[data-slot="sidebar-wrapper"],[data-slot="sidebar"],[data-slot="sidebar-inset"],div:has(>[data-chat-column]),[data-chat-column],.messages-timeline-scroll,[data-timeline-loading]{background:transparent!important}` +
    // The lane sits where T3 Code puts the chat's text column: the app centres it between two insets (the right one
    // makes room for the thread details card) and publishes them, and the column's width, as these variables.
    `[data-workspace-area="conversation"]{--rc-mid:calc(50% + (var(--chat-lane-inset-start,0px) - var(--chat-lane-inset-end,0px)) / 2);--rc-half:calc(var(--chat-content-max-width,46rem) / 2 + ${LANE.pad});background:linear-gradient(90deg,${stops})!important}` +
    `[data-slot="sidebar-inner"],[data-chat-header]{background-color:rgb(${PANEL.tint} / ${PANEL.alpha})!important}`;
}

// ---- theme ------------------------------------------------------------------------------------------------------
export function buildTheme() {
  const backdrop = backdropCss(SCENE), css = backdrop + panelCss();
  // upstream's Fractal Glass palette (plugins/backdrops/hooks/look-fractal-glass.ts): deep navy surfaces, the glow's blue as accent
  const ink = { s0: "#04070c", s1: "#0a0f17", s2: "#111824", s3: "#182131", text: "#e6edf7", text2: "#b6c2d4", text3: "#a0aec2" };
  const accent = "#5a9ef5";
  const theme = {
    version: 1, name: "Fractal Glass", appearance: "dark",
    canvas: ink.s0, accent,
    colors: {
      chrome: ink.s0, toolbar: ink.s0, surface: ink.s1, surfaceOverlay: ink.s2, surfaceRaised: ink.s3,
      text: ink.text, textMuted: ink.text2, mutedForeground: ink.text3, placeholder: ink.text3,
      // T3 Code paints its primary controls (send button, switches) with the messageAction roles
      focus: accent, messageAction: accent, messageActionForeground: ink.s0, messageActionHover: "#73adf7",
      sidebar: ink.s0, sidebarForeground: ink.text, sidebarMutedForeground: ink.text3,
      codeBackground: ink.s1, codeForeground: ink.text, error: "#f2777a", warning: "#e8c170",
      terminalBackground: ink.s0, terminalForeground: ink.text,
    },
    css,
  };
  return { theme, backdropLen: backdrop.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { theme, backdropLen } = buildTheme();
  fs.writeFileSync(HERE + "theme.json", JSON.stringify(theme, null, 2) + "\n");
  console.log(`theme.json written: css ${theme.css.length} of 100000 chars (backdrop ${backdropLen}); scene ${SCENE.length} chars, unchanged`);
}
