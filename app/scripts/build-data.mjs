// Static fallback artifact pipeline.
//
// The database (Python backend) is now the source of truth. This script
// produces app/public/data/* — used by the frontend as a fallback when the
// API is unavailable (e.g. Netlify static-only deploys).
//
// Strategy:
//   1. If a Python backend venv + database are reachable, delegate to
//      backend/api/export_static.py (DB → JSON).
//   2. Otherwise, fall back to the legacy in-tree modules at server/data/*
//      to bootstrap a fresh checkout. This path also seeds the database for
//      first-time setup; once the DB is populated it becomes authoritative.
//
// The exported `buildStaticBookData` helper remains for tests and the legacy
// path. New code should not depend on it.

import { mkdir, writeFile, copyFile, rm, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SERVER_DATA = path.join(ROOT, 'server', 'data');
const GEO_DIR = path.join(ROOT, 'backend', 'data', 'geo');
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'data');
const PY_BACKEND_DIR = path.join(ROOT, 'backend');
const PY_BIN = path.join(PY_BACKEND_DIR, '.venv', 'bin', 'python');
const DEFAULT_DB_URL = `sqlite:///${path.join(PY_BACKEND_DIR, '.data', 'content.db')}`;

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
    }
    if (mod.chapters?.length) {
      meta.chapters = mod.chapters.map(summarizeChapter);
      meta.chapterCount = mod.chapters.length;
      for (const chapter of mod.chapters) {
        chapterDocs.set(`${mod.book.id}/${chapter.id}`, chapter);
      }
    }

    bookMetas.set(mod.book.id, meta);
  }

  return { listing, bookMetas, chapterDocs, articleDocs };
}

async function exportFromDatabase() {
  if (!existsSync(PY_BIN)) return false;
  const dbUrl = process.env.PY_BACKEND_DB_URL || DEFAULT_DB_URL;
  const dbPath = dbUrl.startsWith('sqlite:///') ? dbUrl.slice('sqlite:///'.length) : null;
  if (dbPath && !existsSync(dbPath)) return false;

  const result = spawnSync(
    PY_BIN,
    ['-m', 'api.export_static', '--db-url', dbUrl, '--out-dir', OUT_DIR],
    { cwd: PY_BACKEND_DIR, stdio: 'inherit', env: { ...process.env, PYTHONPATH: PY_BACKEND_DIR } },
  );
  if (result.status !== 0) {
    console.warn('[build-data] DB export failed; falling back to legacy modules');
    return false;
  }
  return true;
}

async function exportFromLegacyModules() {
  if (existsSync(OUT_DIR)) await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(path.join(OUT_DIR, 'books'), { recursive: true });
  await mkdir(path.join(OUT_DIR, 'periods'), { recursive: true });
  await mkdir(path.join(OUT_DIR, 'geo'), { recursive: true });

  const books = [];
  for (const [id, rel] of BOOK_FILES) {
    const mod = await import(path.join(SERVER_DATA, rel));
    books.push({ id, mod });
  }

  const built = buildStaticBookData(books);

  await writeFile(path.join(OUT_DIR, 'books.json'), JSON.stringify(built.listing));

  for (const [bookId, meta] of built.bookMetas) {
    await writeFile(path.join(OUT_DIR, 'books', `${bookId}.json`), JSON.stringify(meta));
  }

  for (const [key, doc] of [...built.chapterDocs, ...built.articleDocs]) {
    const [bookId, docId] = key.split('/');
    const docDir = path.join(OUT_DIR, 'books', bookId);
    await mkdir(docDir, { recursive: true });
    await writeFile(path.join(docDir, `${docId}.json`), JSON.stringify(doc));
  }

  const { periods } = await import(path.join(SERVER_DATA, 'periods.js'));
  for (const [id, p] of Object.entries(periods)) {
    await writeFile(path.join(OUT_DIR, 'periods', `${id}.json`), JSON.stringify(p));
  }

  for (const layer of GEO_LAYERS) {
    await copyFile(
      path.join(GEO_DIR, `${layer}.geojson`),
      path.join(OUT_DIR, 'geo', `${layer}.geojson`),
    );
  }

  const totalCh = built.chapterDocs.size;
  const totalArticles = built.articleDocs.size;
  console.log(`[build-data] (legacy seed) wrote ${books.length} books / ${totalCh} chapters / ${totalArticles} articles / ${Object.keys(periods).length} periods / ${GEO_LAYERS.length} geo layers → ${path.relative(ROOT, OUT_DIR)}`);
}

async function main() {
  if (process.env.BUILD_DATA_FORCE_LEGACY === '1') {
    await exportFromLegacyModules();
    return;
  }
  if (await exportFromDatabase()) return;
  await exportFromLegacyModules();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => { console.error(err); process.exit(1); });
}
