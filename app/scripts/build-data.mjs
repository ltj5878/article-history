// Pre-build data pipeline for the static-only deployment.
// Reads the existing server/data/* modules and emits flat JSON files into
// app/public/data, then copies the geo/*.geojson layers. The frontend fetches
// these files at runtime — no Express server required.

import { mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SERVER_DATA = path.join(ROOT, 'server', 'data');
const SERVER_GEO = path.join(ROOT, 'server', 'geo');
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'data');

const BOOK_FILES = [
  ['zuozhuan', 'books/zuozhuan.js'],
  ['xiangyu', 'books/xiangyu-benji.js'],
  ['gaozu', 'books/gaozu-benji.js'],
  ['qinshihuang', 'books/qin-shihuang-benji.js'],
  ['liezhuan', 'books/shiji-liezhuan.js'],
];

const GEO_LAYERS = [
  'ne_coastline_china',
  'ne_rivers_china',
  'ne_lakes_china',
  'ne_land_china',
  'china_provinces',
];

async function main() {
  if (existsSync(OUT_DIR)) await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(path.join(OUT_DIR, 'books'), { recursive: true });
  await mkdir(path.join(OUT_DIR, 'periods'), { recursive: true });
  await mkdir(path.join(OUT_DIR, 'geo'), { recursive: true });

  // Load all book modules
  const books = [];
  for (const [id, rel] of BOOK_FILES) {
    const mod = await import(path.join(SERVER_DATA, rel));
    books.push({ id, mod });
  }

  // /data/books.json — listing
  const listing = books.map(({ mod }) => ({
    id: mod.book.id,
    title: mod.book.title,
    bookSeries: mod.book.bookSeries,
    dynasty: mod.book.dynasty,
    author: mod.book.author,
    description: mod.book.description,
    chapterCount: mod.chapters.length,
  }));
  await writeFile(path.join(OUT_DIR, 'books.json'), JSON.stringify(listing));

  // /data/books/<id>.json — book metadata + chapter index
  for (const { mod } of books) {
    const meta = {
      ...mod.book,
      chapters: mod.chapters.map(c => ({ id: c.id, title: c.title, subtitle: c.subtitle, year: c.year })),
      eraEvents: mod.eraEvents,
    };
    await writeFile(path.join(OUT_DIR, 'books', `${mod.book.id}.json`), JSON.stringify(meta));

    // /data/books/<id>/<chapterId>.json — full chapter content
    const chapDir = path.join(OUT_DIR, 'books', mod.book.id);
    await mkdir(chapDir, { recursive: true });
    for (const ch of mod.chapters) {
      await writeFile(path.join(chapDir, `${ch.id}.json`), JSON.stringify(ch));
    }
  }

  // /data/periods/<periodId>.json
  const { periods } = await import(path.join(SERVER_DATA, 'periods.js'));
  for (const [id, p] of Object.entries(periods)) {
    await writeFile(path.join(OUT_DIR, 'periods', `${id}.json`), JSON.stringify(p));
  }

  // Copy GeoJSON layers
  for (const layer of GEO_LAYERS) {
    await copyFile(
      path.join(SERVER_GEO, `${layer}.geojson`),
      path.join(OUT_DIR, 'geo', `${layer}.geojson`),
    );
  }

  const totalCh = books.reduce((s, b) => s + b.mod.chapters.length, 0);
  console.log(`[build-data] wrote ${books.length} books / ${totalCh} chapters / ${Object.keys(periods).length} periods / ${GEO_LAYERS.length} geo layers → ${path.relative(ROOT, OUT_DIR)}`);
}

main().catch(err => { console.error(err); process.exit(1); });
