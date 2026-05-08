import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Books — modules can export legacy { book, chapters, eraEvents } or
// article-based { book, articles, eraEvents }.
import * as zuozhuan from './data/books/zuozhuan.js';
import * as shiji from './data/books/shiji.js';

// Shared period definitions
import { periods } from './data/periods.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

// === Book registry — id → module ===
const BOOK_MODULES = {
  zuozhuan,
  shiji,
};

function getBookModule(id) {
  return BOOK_MODULES[id] || null;
}

// Static JSON data is loaded from in-memory modules — safe to cache briefly.
const JSON_CACHE = 'public, max-age=300';

// === Books listing ===
app.get('/api/books', (req, res) => {
  const list = Object.values(BOOK_MODULES).map(m => ({
    id: m.book.id,
    title: m.book.title,
    bookSeries: m.book.bookSeries,
    dynasty: m.book.dynasty,
    author: m.book.author,
    description: m.book.description,
    chapterCount: m.chapters?.length || 0,
    articleCount: m.articles?.length || 0,
  }));
  res.set('Cache-Control', JSON_CACHE);
  res.json(list);
});

app.get('/api/books/:id', (req, res) => {
  const m = getBookModule(req.params.id);
  if (!m) return res.status(404).json({ error: 'Book not found' });
  res.set('Cache-Control', JSON_CACHE);
  res.json({
    ...m.book,
    chapters: m.chapters?.map(summarizeChapter),
    articles: m.articles?.map(summarizeArticle),
    eraEvents: m.eraEvents,
  });
});

// === Chapter content ===
app.get('/api/books/:bookId/chapters/:chapterId', (req, res) => {
  const m = getBookModule(req.params.bookId);
  if (!m) return res.status(404).json({ error: 'Book not found' });
  const ch = m.chapters?.find(c => c.id === req.params.chapterId);
  if (!ch) return res.status(404).json({ error: 'Chapter not found' });
  res.set('Cache-Control', JSON_CACHE);
  res.json(ch);
});

// === Article content ===
app.get('/api/books/:bookId/articles/:articleId', (req, res) => {
  const m = getBookModule(req.params.bookId);
  if (!m) return res.status(404).json({ error: 'Book not found' });
  const article = m.articles?.find(a => a.id === req.params.articleId);
  if (!article) return res.status(404).json({ error: 'Article not found' });
  res.set('Cache-Control', JSON_CACHE);
  res.json(article);
});

// === Map period data ===
app.get('/api/maps/period/:periodId', (req, res) => {
  const p = periods[req.params.periodId];
  if (!p) return res.status(404).json({ error: 'Period not found', requested: req.params.periodId, available: Object.keys(periods) });
  res.set('Cache-Control', JSON_CACHE);
  res.json(p);
});

// === Geographic base layers (Natural Earth, China clipped) ===
const GEO_DIR = path.join(__dirname, 'geo');
app.get('/api/geo/:layer', (req, res) => {
  const allowed = ['ne_coastline_china', 'ne_rivers_china', 'ne_lakes_china', 'ne_land_china', 'china_provinces'];
  if (!allowed.includes(req.params.layer)) return res.status(404).json({ error: 'Layer not found' });
  const filePath = path.join(GEO_DIR, `${req.params.layer}.geojson`);
  res.set('Cache-Control', 'public, max-age=86400');
  res.set('Content-Type', 'application/geo+json');
  const stream = fs.createReadStream(filePath);
  stream.on('error', err => {
    console.error(`[geo] failed to stream ${req.params.layer}:`, err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to read geo layer' });
    else res.destroy(err);
  });
  stream.pipe(res);
});

// === Health ===
app.get('/api/health', (req, res) => {
  const books = Object.values(BOOK_MODULES).map(m => ({
    id: m.book.id,
    title: m.book.title,
    chapters: m.chapters?.length || 0,
    articles: m.articles?.length || 0,
  }));
  res.json({
    status: 'ok',
    books,
    totalChapters: books.reduce((sum, b) => sum + b.chapters, 0),
    totalArticles: books.reduce((sum, b) => sum + b.articles, 0),
    periods: Object.keys(periods),
  });
});

// Global error handler — logs unexpected failures with a stack.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
});

process.on('unhandledRejection', err => console.error('[unhandledRejection]', err));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  const totalCh = Object.values(BOOK_MODULES).reduce((sum, m) => sum + (m.chapters?.length || 0), 0);
  const totalArticles = Object.values(BOOK_MODULES).reduce((sum, m) => sum + (m.articles?.length || 0), 0);
  console.log(`经史舆图 API server listening on http://localhost:${PORT}`);
  console.log(`  Books: ${Object.keys(BOOK_MODULES).join(', ')} (${totalCh} chapters / ${totalArticles} articles total)`);
  console.log(`  Periods: ${Object.keys(periods).length}`);
});

function summarizeChapter(c) {
  return { id: c.id, title: c.title, subtitle: c.subtitle, year: c.year };
}

function summarizeArticle(article) {
  const years = (article.sections || []).map(s => s.year).filter(y => typeof y === 'number');
  return {
    id: article.id,
    title: article.title,
    subtitle: article.subtitle,
    year: years[0],
    yearStart: years.length ? Math.min(...years) : article.yearStart,
    yearEnd: years.length ? Math.max(...years) : article.yearEnd,
  };
}
