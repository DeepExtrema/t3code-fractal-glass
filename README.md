# Fractal Glass

A dark theme for [T3 Code](https://t3.codes) that draws the Fractal Glass backdrop from
[neverblinks/backdrops](https://github.com/neverblinks/backdrops) behind the app: a soft blue glow drifting behind
a pane of vertical fluted glass, on near black. The glow completes one drift every 12 seconds.

![The glow drifting behind a T3 Code thread](media/glow.gif)

The picture is drawn in code by neverblinks after a free Unsplash photo by universtock. This repository publishes
it with permission from neverblinks. Read [Credits and licence](#credits-and-licence) before you copy the picture
anywhere else.

## Screenshots

![A new thread: the glass behind the sidebar and the composer](media/home.png)

![A reply with a code block, the glow behind the glass](media/thread.png)

The screenshots show T3 Code with an invented demo project.

## Install

1. Download [`theme.json`](theme.json).
2. In T3 Code, open **Settings**, then **Appearance**.
3. Under **Themes**, click **Add theme**.
4. Click **Choose files**, select `theme.json`, then click **Add theme**.

Or copy the file into T3 Code's theme folder as `fractal-glass.json` and pick **Fractal Glass** on the same page:

```sh
cp theme.json ~/.t3/userdata/themes/fractal-glass.json
```

To go back, pick another theme on the same page.

Tested on T3 Code 0.1.11-nightly.20261118, in the web client in Chromium.

## What the theme changes

- **Backdrop.** Upstream's picture fills the window, behind the sidebar, the header and the chat.
- **Colours.** Upstream's Fractal Glass palette: deep navy surfaces, near-white blue-grey text, and the glow's blue (`#5a9ef5`) as the accent.
- **Reading lane.** The picture is dimmed with `rgb(4 7 12)` at 65 % behind the chat's text column, and clears over 13 rem on each side. Upstream's glass uses 63 %. At 63 % the placeholder colour reads 4.34:1 over the brightest pixel behind the chat, short of the 4.5:1 that `check.mjs` requires, so the lane is 2 points darker.
- **Sidebar and header.** The same navy at 86 %, so the picture shows through faintly.

The chat's layout, message rows, composer and code blocks are T3 Code's own.

## What moves

The glow drifts across the glass in a 12 second loop, in steps of 0.125 seconds. Nothing else moves.

If your system asks for reduced motion, the glow stops. In a browser you can test this with
`--force-prefers-reduced-motion`.

## Change it

The theme is generated. Edit the constants at the top of `build.mjs`, then build again.

| Constant | What it does | Default |
|---|---|---|
| `LANE.opacity` | How dark the lane behind the chat text is | `0.65` |
| `LANE.pad` | How far the full dimming reaches past the text column on each side | `1rem` |
| `LANE.fade` | How far the lane takes to clear on each side | `13rem` |
| `PANEL.alpha` | Opacity of the navy behind the sidebar and the header | `0.86` |

`LANE.tint` and `PANEL.tint` are upstream's glass tint, `4 7 12`.

## Build from source

You need Node.js. The build is tested with Node.js 26.

```sh
npm ci
node build.mjs
```

`build.mjs` reads upstream's scene from `vendor/backdrops/scene-fractal-glass.js` and writes `theme.json`.
The scene is 45,639 characters, so it goes into the CSS unchanged.

To check the result, run:

```sh
node check.mjs
```

`check.mjs` needs a Chromium binary. If yours is not at `/usr/bin/chromium`, set `CHROMIUM` to its path. It checks that:

- `theme.json` is what `build.mjs` produces and fits T3 Code's limits.
- The scene inside the CSS is upstream's scene, character for character, and keeps its reduced-motion rule.
- Text keeps its contrast over the brightest pixel behind the chat, at 12 moments of the loop and two window sizes: 7:1 for main text, 4.5:1 for muted text and the placeholder.
- Drawn as a CSS background, the way T3 Code draws it, the glow moves, and it stands still in a Chromium started with `--force-prefers-reduced-motion`.
- T3 Code still has the parts of the app the theme hooks into. On Linux it finds a running T3 Code AppImage by itself. Otherwise set `T3_APP_ASAR` to the path of T3 Code's `app.asar`.

## Update from upstream

Copy the new `plugins/fractal-glass/hooks/scene-fractal-glass.js`, `LICENSE` and `ARTWORK.md` into `vendor/backdrops/`,
write the commit hash to `vendor/backdrops/COMMIT`, then run `node build.mjs` and `node check.mjs`.
If upstream changed the palette in `plugins/backdrops/hooks/look-fractal-glass.ts`, copy the new colours into
`buildTheme()` in `build.mjs`.

## Limits

- **Size.** The theme uses 49,879 of T3 Code's 100,000 characters of CSS.
- **Internal names.** The reading lane follows the chat column through three CSS variables T3 Code sets, and the
  backdrop shows through boxes T3 Code's theme guide does not list as stable. A T3 Code update can rename one.
  The lane then centres on the chat area, or a box turns solid again. `node check.mjs` reports which names are missing.
- **Dark only.** The theme defines a dark appearance.
- **Mobile.** T3 Code's theme guide says its mobile apps do not use themes.

## Credits and licence

The picture and its motion come from [neverblinks/backdrops](https://github.com/neverblinks/backdrops), at the commit
in `vendor/backdrops/COMMIT`. Upstream's terms are in `vendor/backdrops/LICENSE` and `vendor/backdrops/ARTWORK.md`:

- The picture is drawn in code by neverblinks after a free Unsplash photo by universtock.
- Anyone may use the theme for free, for any purpose. Nobody may redistribute the picture outside upstream's
  repository, sell it, or remove the credits, without permission.

`theme.json` contains the picture, so those terms cover it. This repository publishes it with permission from
neverblinks. Ask neverblinks before you copy the picture anywhere else.

`build.mjs` and `check.mjs` are under the [MIT License](LICENSE). [NOTICE.md](NOTICE.md) has the details.

This theme is not affiliated with T3 Code, neverblinks or Anthropic.
