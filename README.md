# Neon Coast Cover Studio

A free offline web app that turns your photo and a caption into GTA-style
cover art — the multi-panel poster look with bold caption lettering and a Vice
City sunset / neon colour grade — and exports it as a PNG to share. No upload,
no account, no network: your photos never leave your machine.

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/arnesarizky/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/arnesarizky/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

## What it does

- **Any photo, any panel** — click a panel to select it, then upload a photo
  for just that panel, drag and drop onto the preview, or fill all panels with
  one photo (each panel crops a different part). Drag to pan, slider to zoom,
  reset crop per panel.
- **5 layouts** — Hero + Three, Nine-Panel Grid, Full-Bleed Hero, Tilted
  Snapshots, Triptych.
- **5 colour grades** — Sunset, Neon Pink/Teal, Golden Hour, Noir Teal,
  Vaporwave (gradient-map washes over every panel).
- **Lettering** — Anton title in white with a dark outline and offset shadow,
  Pacifico script subtitle, Bebas Neue badge ribbon and labels, a halftone
  title block, a five-star heat meter, film grain and vignette toggles.
- **Undo / redo** — full history, including Ctrl+Z / Ctrl+Shift+Z.
- **One-click PNG export** — 1080 × 1080, 1080 × 1350 and 1920 × 1080.

## Try it

```sh
node serve.ts        # serves app/ on http://localhost:8080
```

Open the page, pick a photo, type a caption, hit export. Everything is static
files under `app/` — it works offline in desktop Chrome.

## Fonts

Anton, Pacifico and Bebas Neue, all under the SIL Open Font License 1.1
(`app/fonts/OFL.txt`, sources in `app/fonts/FONTS.md`). No Rockstar Games
logo, wordmark, artwork or font is used anywhere.

## Entry

Built for the [make.fun gta6-cover-art-01 bounty](https://make.fun/bounty/gta6-cover-art-01).
`main.ts` (Node 22, standard library only) copies `app/` and `screenshots/`
to `/output` and writes `dossier.json` with the vendored make.fun library.
