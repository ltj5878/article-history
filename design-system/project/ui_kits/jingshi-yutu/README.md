# 经史舆图 · UI Kit

The single-product UI kit for 经史舆图. A split-pane reading + map prototype that wires up everything in the design system: 古风 paper background, Songti body, Ma Shan Zheng display, faction-colored routes, vermillion seal stamps, animated path-draw on routes, an aged-paper SVG map of 中国古代疆域.

## Files

| File | What it is |
|---|---|
| `index.html` | Mount point — loads React, fonts, tokens, components |
| `app.css` | App-specific layout & component styles (uses tokens from root `colors_and_type.css`) |
| `App.jsx` | Top-level state machine (reducer) + 3-row layout: nav / split-pane / timeline |
| `TopNav.jsx` | Book picker, chapter picker, segmented reading-mode, layer toggles, theme cycle |
| `ReaderPane.jsx` | Left side — chapter title, paragraphs, entity tagging (places/persons/events), vertical-reading toggle |
| `MapPane.jsx` | Right side — SVG map with land outline, rivers, territories, POI markers, animated routes, info card |
| `Timeline.jsx` | Bottom era-axis with event nodes & scrubber |
| `data.js` | Three sample books — 《左传》(城濮·崤之战), 《史记》(巨鹿·垓下·秦统一), 《水经注》(三峡) |
| `map-data.js` | Hand-drawn China outline path + 黄河 / 长江 / 淮河 + region labels + projection helper |

## Interactions to try

1. Click any **place tag** in the reading column → map flies a vermillion ring around that POI and pops an info card.
2. Toggle **原文 / 译文 / 对照** in the top bar.
3. Toggle **竖排** for vertical reading.
4. Cycle the **theme** (古风 → 暗色 → 明亮) — every surface re-tokenizes.
5. Click any chapter dot on the **timeline** to jump to that battle.
6. Drag the 4-px **gutter** between panes to re-size; scroll-zoom and drag inside the map.
7. Use the **play/pause/replay** controls at top-right of the map to scrub route animations.
8. Click a different **paragraph** — routes re-draw, POI markers stagger in.

## What's deliberately stubbed

- The China outline is a stylized scroll-shape, not an accurate boundary. Lat/lng → x/y is a flat linear mapping over a fixed bounding box.
- "退避三舍" path is dashed rather than animated separately; a richer narrative-step animation could be layered on the same primitive.
- Search, statistics panel, ambient audio, and view-export from the spec's "加分项" list are out of scope for this kit but their visual treatment can be derived from the existing components (search field → reuse picker chrome; stats → reuse infocard).
