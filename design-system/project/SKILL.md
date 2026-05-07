---
name: jingshi-yutu-design
description: Use this skill to generate well-branded interfaces and assets for 经史舆图 (Classics · History · Cartography) — an interactive reading system that pairs classical Chinese texts with period-accurate maps. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping or production.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc.), copy assets out and create static HTML files for the user to view. The brand defaults are:
- **古风 theme** (rice-paper background `#F5F0E8`, ink body `#1F1A14`, vermillion accents `#C41E24`)
- **Noto Serif SC** for body 古文, **Ma Shan Zheng** for display titles
- Crisp corners, restrained shadows, no gradients, no emoji in chrome
- Vermillion seal stamps as signature decoration
- Faction palette for any historical-state coloring (晋蓝 楚红 秦褐 齐橙 …)

If working on production code, copy the assets in `assets/`, link `colors_and_type.css` and `fonts/fonts.css`, and use the CSS variables defined there. Read the **CONTENT FUNDAMENTALS**, **VISUAL FOUNDATIONS**, and **ICONOGRAPHY** sections of the README before writing any new copy or laying out new screens.

If the user invokes this skill without any other guidance, ask them what they want to build or design — a new chapter, a stats panel, a docs page, an export view? — ask a few clarifying questions about scope and audience, then act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
