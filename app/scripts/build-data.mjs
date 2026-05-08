// Pre-build data pipeline for the static-only deployment.
// Reads the existing server/data/* modules and emits flat JSON files into
// app/public/data, then copies the geo/*.geojson layers. The frontend fetches
// these files at runtime — no Express server required.

import { mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SERVER_DATA = path.join(ROOT, 'server', 'data');
const SERVER_GEO = path.join(ROOT, 'server', 'geo');
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'data');

const BOOK_FILES = [
  ['zuozhuan', 'books/zuozhuan.js'],
  ['shiji', 'books/shiji.js'],
];

const GEO_LAYERS = [
  'ne_coastline_china',
  'ne_rivers_china',
  'ne_lakes_china',
  'ne_land_china',
  'china_provinces',
];

function summarizeArticle(article) {
  const sectionYears = (article.sections || [])
    .map(s => s.year)
    .filter(y => typeof y === 'number');
  return {
    id: article.id,
    title: article.title,
    subtitle: article.subtitle,
    year: sectionYears[0],
    yearStart: sectionYears.length ? Math.min(...sectionYears) : article.yearStart,
    yearEnd: sectionYears.length ? Math.max(...sectionYears) : article.yearEnd,
  };
}

function summarizeChapter(chapter) {
  return {
    id: chapter.id,
    title: chapter.title,
    subtitle: chapter.subtitle,
    year: chapter.year,
  };
}

export function buildStaticBookData(books) {
  const listing = books.map(({ mod }) => ({
    id: mod.book.id,
    title: mod.book.title,
    bookSeries: mod.book.bookSeries,
    dynasty: mod.book.dynasty,
    author: mod.book.author,
    description: mod.book.description,
    chapterCount: mod.chapters?.length || 0,
    articleCount: mod.articles?.length || 0,
  }));

  const bookMetas = new Map();
  const chapterDocs = new Map();
  const articleDocs = new Map();

  for (const { mod } of books) {
    const meta = {
      ...mod.book,
      eraEvents: mod.eraEvents || [],
    };

    if (mod.articles?.length) {
      meta.articles = mod.articles.map(summarizeArticle);
      meta.articleCount = mod.articles.length;
      for (const article of mod.articles) {
        articleDocs.set(`${mod.book.id}/${article.id}`, article);
      }
    } else {
      meta.chapters = (mod.chapters || []).map(summarizeChapter);
      meta.chapterCount = mod.chapters?.length || 0;
      for (const chapter of (mod.chapters || [])) {
        chapterDocs.set(`${mod.book.id}/${chapter.id}`, chapter);
      }
    }

    bookMetas.set(mod.book.id, meta);
  }

  return { listing, bookMetas, chapterDocs, articleDocs };
}

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

  const built = buildStaticBookData(books);

  // /data/books.json — listing
  await writeFile(path.join(OUT_DIR, 'books.json'), JSON.stringify(built.listing));

  // /data/books/<id>.json — book metadata + chapter/article index
  for (const [bookId, meta] of built.bookMetas) {
    await writeFile(path.join(OUT_DIR, 'books', `${bookId}.json`), JSON.stringify(meta));
  }

  // /data/books/<id>/<chapterOrArticleId>.json — full reading content
  for (const [key, doc] of [...built.chapterDocs, ...built.articleDocs]) {
    const [bookId, docId] = key.split('/');
    const docDir = path.join(OUT_DIR, 'books', bookId);
    await mkdir(docDir, { recursive: true });
    await writeFile(path.join(docDir, `${docId}.json`), JSON.stringify(doc));
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

  const totalCh = built.chapterDocs.size;
  const totalArticles = built.articleDocs.size;
  console.log(`[build-data] wrote ${books.length} books / ${totalCh} chapters / ${totalArticles} articles / ${Object.keys(periods).length} periods / ${GEO_LAYERS.length} geo layers → ${path.relative(ROOT, OUT_DIR)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => { console.error(err); process.exit(1); });
}
