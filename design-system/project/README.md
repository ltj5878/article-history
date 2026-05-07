# 经史舆图 · Design System

> **经史舆图** (jīng shǐ yú tú) — *Classics, History & Cartography* — is an interactive reading system that pairs classical Chinese texts (《左传》, 《史记》, 《水经注》…) with live, period-accurate maps. As you read 城濮之战, the right-hand pane draws the routes of the Jin and Chu armies. As you read 破釜沉舟, you watch Xiang Yu's columns cross the Zhang river toward Julu.

The product's two faces:
1. **A scholar's reading surface** — rice-paper background, Songti body, vertical-or-horizontal layout, ink-line entity tagging.
2. **A historical atlas** — hand-drawn SVG outline of 中国古代疆域, period-shifting borders, animated army routes, vermillion seal-stamp annotations.

This design system codifies the visual language so any new chapter, book, or auxiliary view (search, statistics, exports) feels like part of the same scroll.

---

## Sources

This system was built **from a written specification only** — no codebase, no Figma, no existing screens. Everything here is a deliberate first pass derived from the spec's tone (古风 default, 宣纸 / 朱砂 / 藏蓝 / 赭石 palette, vertical-reading support, SVG-only map). Substitutions and assumptions are flagged in-line throughout. **Where you see ⚠️ — please review.**

If you have an existing codebase, Figma, or reference imagery for 经史舆图, attach it via the Import menu and we'll re-baseline against the real artifacts.

---

## Index

| File / folder | What lives there |
|---|---|
| `README.md` | This document — brand pillars, content & visual fundamentals, iconography |
| `colors_and_type.css` | All design tokens — colors, type scale, spacing, radii, shadows, motion, theme overrides |
| `fonts/` | Webfont loader + per-family notes, including the ⚠️ seal-script substitution |
| `assets/` | Logos, seal stamps, decorative motifs (cloud band, zigzag rule), placeholder generic imagery |
| `assets/icons/` | SVG icon set (toolbar + map markers); see ICONOGRAPHY below |
| `preview/` | Per-token preview cards rendered into the Design System tab |
| `ui_kits/jingshi-yutu/` | The single product UI kit — split-pane reader + map prototype |
| `SKILL.md` | Agent skill manifest (cross-compatible with Claude Code Agent Skills) |

---

## CONTENT FUNDAMENTALS

The product speaks **two registers at once**, and that duality is the brand:

1. **Classical** — for the source text and any heading/label that "belongs to" the historical world (book titles, chapter names, era markers, seal stamps).
2. **Modern editorial** — for UI chrome, translations, tooltips, info cards. Plain, calm, scholarly. Never marketing-flavored.

### Voice & tone

- **Restrained, scholar-not-salesman.** Treat the reader like an adult with a serious interest in 古典文学. No exclamation marks in the UI. No "Welcome back!" greetings. No emoji in product copy.
- **Mandarin-first, but bilingually labeled where useful.** Place names render as **古地名（今地名）** — e.g. 城濮（山东鄄城西南）. Era markers use **公元前 / 公元** — e.g. 公元前 632 年.
- **Quote the source verbatim.** When the UI references the text it is showing, it quotes; it does not paraphrase. *"读到「退避三舍」时——"*
- **Translation copy is plain modern Chinese,** not literary. Goal: a smart 18-year-old reads it once and gets it. No "於是乎" register-shifts inside translations.
- **Casing & punctuation:**
  - Chinese punctuation in Chinese contexts (「」, ，, 。, ；, ：).
  - Western punctuation only in code/coordinate strings.
  - Numerals: Hans for canonical year refs (僖公二十八年), Arabic for UI numbers and modern dates (公元前 632 年).

### "I" vs "you"

The product is a **reading surface**, not a chatbot. It almost never addresses the user.
- ✅ "城濮之战 · 僖公二十八年" — a label.
- ✅ "切换为竖排" — an imperative on a button.
- ❌ "你想阅读哪一篇？" — too conversational.
- ❌ "我们为你定位到了城濮" — drop "我们/你"; just say "已定位至城濮".

### Sample copy

| Surface | Example |
|---|---|
| Top nav book picker | `《左传》· 春秋` |
| Chapter heading (display 行楷) | `城濮之战` |
| Chapter subhead | `僖公二十八年 · 公元前 632 年` |
| Entity tooltip (place) | `城濮 · 今山东鄄城西南` |
| Entity tooltip (person) | `先轸 · 晋国中军元帅` |
| Info card heading | `城濮` then `古地名 → 今地名` then a 1-line role |
| Toggle button | `原文` / `译文` / `对照` |
| Layer toggle | `地名` / `路线` / `势力` |
| Empty state | `选择一篇章以开始阅读` (not "Choose a chapter to start reading!") |
| Error | `地图数据暂未载入，请稍候` (not "Oops!") |

### Vibe in one line

> 一卷宣纸，半幅舆图。点墨为城，引线为兵。 — one scroll of rice paper, half a map; ink dots become cities, drawn lines become armies.

---

## VISUAL FOUNDATIONS

### Palette

The palette is **traditional Chinese**, not "tech with red accents." Five anchor colors, all sourced from 中国传统色 (Chinese Traditional Colors):

| Token | Hex | Role |
|---|---|---|
| `--c-paper` 宣纸 | `#F5F0E8` | Primary background — warm, off-white, never pure white |
| `--c-ink` 墨色 | `#1F1A14` | Body text — warm black, never `#000` |
| `--c-vermillion` 朱砂 | `#C41E24` | Seals, key accents, current-paragraph rule |
| `--c-indigo` 藏蓝 | `#2B4490` | Place tags, links, the Jin faction |
| `--c-ochre` 赭石 | `#8B572A` | Earth, mountains, the Qin faction, person-tags warmer pair |

Plus a **faction palette** (`--f-jin`, `--f-chu`, `--f-qin`…) for territory shading and route arrows on the map. Plus a **POI palette** (`--poi-capital`, `--poi-battle`, `--poi-pass`, `--poi-city`) keyed to map markers.

Three themes ship: **古风 (default)** · **暗色** · **明亮**. The 古风 theme is the brand; 暗色 and 明亮 are utilities for accessibility and printing respectively.

### Type

- **Body** — Noto Serif SC, 18px / 1.9 line-height for 古文. Generous, never crowded.
- **Display** — Ma Shan Zheng (行楷) for chapter and book titles only. Never use it for body or buttons; it is a *signature*, used like a calligraphic stamp.
- **UI chrome** — Noto Sans SC, 14–16px. Buttons and tabs sit in sans so they don't compete with the literary body.
- **Seal** — ZCOOL XiaoWei. Only inside red 印章 backgrounds, vertical, letter-spaced.
- **Vertical reading** — `writing-mode: vertical-rl; text-orientation: upright; line-height: 2.2`. Punctuation rotates correctly via the standard `text-orientation` flow.

### Spacing & rhythm

4-px grid. The reading column uses very generous vertical rhythm (`--sp-7` between paragraphs in 古文 mode). UI chrome uses tighter steps (`--sp-3`/`--sp-4`). Map labels and POI tooltips sit on a 2-px grid because they hover above the map and need to feel precise.

### Backgrounds, textures, motifs

- **Default surface is `--c-paper`** with a subtle inset shadow (`--sh-inset-paper`) suggesting an aged sheet, not a screen.
- **Map land is `--c-paper-3`**, a deeper aged tone, so the map reads as a *separate scroll* unrolled to the right.
- **Cloud band (云纹)** as section dividers and as the top-and-bottom edge of full-bleed banners. Asset: `assets/cloud-band.svg`.
- **Wave-mountain motif (海水江崖纹)** as a footer / endpaper detail. Asset: `assets/wave-mountain.svg`.
- **Zigzag/key-pattern rule (回纹)** as hairline section separators. Asset: `assets/yun-rule.svg`.
- **Seals (印章)** are square, vermillion, with a 1-px lighter inner stroke and a soft `--sh-seal` imprint shadow. Used as the project wordmark and as decorative end-of-chapter stamps.
- **No gradients** anywhere except a single low-opacity linear wash (`--c-paper` → `--c-paper-2`) on the very top of the reading column to mimic light falling on a scroll.
- **No photographic imagery in the chrome.** When portrait imagery is needed (e.g. of a historical figure), it is rendered in **monochrome ink** (sepia/black) with a 1-px ink frame, never full-color.

### Animation

- **Entrance** — fade + 4-px upward translate (`opacity 0→1`, `translateY 4px→0`) over `--dur-2` (240 ms) with `--ease-ink`. POI markers stagger in at 30 ms each.
- **Map pan/zoom** — `--dur-3` (480 ms) with `--ease-scroll`. Never instant.
- **Route drawing** — `stroke-dasharray` path-draw over `--dur-4` (800 ms), arrowhead lands last.
- **Hover** — entity-tag background washes in over `--dur-1` (120 ms). No bounces, no scales > 1.02.
- **No bounce/elastic easing.** Brushes settle; they do not spring.
- **Reduced-motion** — drawing animations collapse to a fade; map transitions stay but skip the route trail.

### States

- **Hover (entity tag)** — background fills with the tag's `--e-*-bg` low-alpha tint; underline thickens by 0.5 px.
- **Hover (button)** — background darkens by ~6% (`color-mix(in oklab, var(--surface), var(--fg) 6%)`). No drop shadow; we are not in Material.
- **Press** — translate down 1 px; do not scale.
- **Active paragraph** — left edge gains a 2-px `--c-vermillion` rule and `--highlight` background wash.
- **Selected POI** — vermillion ring (2-px stroke) + a small label crown above.

### Borders & shadows

- **Borders** — single hairline `1px solid var(--border)`. Heavy frames (`--bw-frame`/`--bw-thick`) reserved for scroll-edge framing on the reader pane.
- **Shadows** — three steps (`--sh-1/2/3`); all warm-black, low alpha. No glows.
- **Inner shadows** — `--sh-inset-paper` adds the soft aging vignette to large surfaces.

### Radii

Crisp. `--r-2` (4 px) on buttons and inputs, `--r-3` (8 px) on cards and info pop-ups, `--r-seal` (6 px) for seal-stamp shapes. Pills (`--r-pill`) only for tag chips. **Never** more than 12-px radius — Chinese aesthetic favors crisp corners.

### Layout rules

- **Split pane** is the canonical layout: 40/60 reader/map by default; user-draggable via a 4-px gutter; 240-px and 320-px snaps either side.
- **Top bar** is fixed, 56 px tall, paper-colored with a hairline rule below.
- **Time-axis** is fixed bottom, 72 px tall, with a hairline rule above.
- **Mobile**: stack vertical (text top, map bottom), each pane scrolls independently; the time axis becomes a horizontal swipe at the very bottom.

### Transparency & blur

Used **rarely.** The only blur in the system is the info-card backdrop (`backdrop-filter: blur(8px)` over `rgba(245, 240, 232, 0.8)`) when a POI card opens *over* the map. Entity backgrounds use alpha only — no blur. The chrome itself is opaque paper.

### Imagery vibe

When period imagery is needed (portraits, woodcuts, scroll details), bias **warm sepia / single-ink, never saturated full color.** Add a 1-px ink border. Never crop tightly to faces; classical compositions breathe.

### Cards

- Surface: `--surface` (slight lift over paper).
- Border: 1 px `--border` (no shadow at rest).
- Shadow on lift: `--sh-2` only.
- Radius: `--r-3` (8 px).
- A card representing a *seal-stamped artifact* (e.g. a saved-bookmark card) gets a small vermillion seal in the top-right corner.

---

## ICONOGRAPHY

The brand has **two icon registers**, and they do not mix:

### 1. UI icons (toolbar, top nav, side controls)

A small custom set of 1.5-px stroke, 24-px viewbox SVGs, ink-on-paper, designed in-house. They live in `assets/icons/`. They are **stroke-based, not filled**, with rounded line caps. The set covers the spec's UI surface only — we do not pull in a 1000-icon CDN library because it would dilute the literary feel.

| File | Use |
|---|---|
| `book.svg` | Book picker |
| `chapter.svg` | Chapter list |
| `vertical.svg` / `horizontal.svg` | Reading-direction toggle |
| `original.svg` / `translation.svg` | Text-mode toggle |
| `layer-place.svg`, `layer-route.svg`, `layer-territory.svg` | Map layer toggles |
| `theme-classic.svg`, `theme-dark.svg`, `theme-bright.svg` | Theme switcher |
| `search.svg` | Place/person search |
| `play.svg`, `pause.svg`, `replay.svg` | Route animation |
| `zoom-in.svg`, `zoom-out.svg`, `recenter.svg` | Map controls |
| `download.svg`, `audio.svg`, `bookmark.svg` | Add-ons (export, ambient sound, save progress) |

⚠️ **Icon set is fresh-drawn for this system.** If you have an existing icon library you'd like to use (Lucide, Tabler, or a custom set in your codebase), say the word and we'll swap it in.

### 2. Map markers (POI symbols)

Rendered directly in the map SVG; not in the icon font. Each POI type has its own glyph + color:
- **国都 (capital)** — vermillion filled square, outlined in ink (a stylized 城 outline)
- **战场 (battlefield)** — orange filled diamond with crossed strokes (swords motif)
- **关隘/山川 (pass/mountain)** — green outline triangle (mountain glyph)
- **城邑 (city)** — indigo filled circle with a 1-px ink ring

These live in the map component; they are not standalone files. Code is in `ui_kits/jingshi-yutu/MapPane.jsx`.

### Emoji

**Not used in product UI.** A few emoji appear in this README and in user-facing copy explicitly tagged as "informal" (e.g. theme labels in the spec: 🏮 古风 / 🌙 暗色 / ☀️ 明亮). In the live UI, those theme labels render as Chinese text + a small SVG glyph, not as emoji.

### Unicode glyphs

Chinese punctuation is canonical (「」 ，。；：). Bullets in lists use `·` (middle dot, U+00B7) when spacing words like *《左传》· 春秋*. Em-dashes (—) for editorial breaks. No `►`, `★`, `※` decorative glyphs in the chrome — those belong to a different visual register.

---

## How to use this system

1. Link `colors_and_type.css` and `fonts/fonts.css` from any HTML doc.
2. Add `data-theme="dark"` or `"bright"` on `<html>` to switch theme; default is 古风.
3. Use the CSS vars liberally; avoid hard-coding hex.
4. For new components, start from the UI kit (`ui_kits/jingshi-yutu/`); copy a JSX file and adapt.
5. When in doubt: **less ink, more paper**. Negative space is a brand feature.

---

## Manifest

Root files:
- `README.md` — this document
- `colors_and_type.css` — all design tokens (colors, type, spacing, radii, shadows, motion + 3 themes)
- `SKILL.md` — agent skill manifest
- `fonts/` — `fonts.css` Google-Fonts loader + `README.md` with the seal-script substitution flag
- `assets/` — `logo.svg`, `seal-square.svg`, `seal-du.svg`, `cloud-band.svg`, `yun-rule.svg`, `wave-mountain.svg`, plus `icons/` (24 stroke SVGs)
- `preview/` — 17 design-system cards rendered into the Design System tab
- `ui_kits/jingshi-yutu/` — the product UI kit (App, TopNav, ReaderPane, MapPane, Timeline + data + map-data)
- `screenshots/` — verification captures
