# Fonts

Per the spec, primary face is **Noto Serif SC** (思源宋体) for 古文 reading. We use four web fonts loaded from Google Fonts:

| Token | Family | Source | Use |
|---|---|---|---|
| `--font-serif` | Noto Serif SC | Google Fonts | Body 古文 reading |
| `--font-sans` | Noto Sans SC | Google Fonts | UI chrome (top nav, buttons) |
| `--font-display` | Ma Shan Zheng | Google Fonts | Section / chapter titles (行楷) |
| `--font-seal` | ZCOOL XiaoWei | Google Fonts | Seal-style labels, decorative captions |
| `--font-mono` | JetBrains Mono | Google Fonts | Coords, code |

### ⚠️ Substitution flag
The spec mentions 思源宋体 (Source Han Serif). **Noto Serif SC is the open-source twin of Source Han Serif** — same glyph set, same designer (Adobe + Google co-release) — so this is a 1:1 substitution. No flag needed for body text.

For 篆书 (seal script) — a true 篆书 webfont is not freely available on Google Fonts. **ZCOOL XiaoWei** is the closest free substitute (an angular Wei-style hybrid). If you need authentic 篆书 (e.g. for the brand wordmark or seal stamps), please supply a `.ttf` / `.woff2` and we'll wire it in. Common candidates: 方正小篆体, 汉仪粗篆繁.

### Going offline
Replace `@import` blocks in `fonts.css` with `@font-face` rules pointing at locally-bundled `.woff2` files.
