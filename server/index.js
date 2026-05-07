import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Books — each module exports { book, chapters, eraEvents }
import * as zuozhuan from './data/books/zuozhuan.js';
import * as xiangyu from './data/books/xiangyu-benji.js';
import * as gaozu from './data/books/gaozu-benji.js';
import * as qinshihuang from './data/books/qin-shihuang-benji.js';
import * as liezhuan from './data/books/shiji-liezhuan.js';

// Shared period definitions
import { periods } from './data/periods.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

// === Book registry — id → module ===
const BOOK_MODULES = {
  zuozhuan,
  xiangyu,
  gaozu,
  qinshihuang,
  liezhuan,
};

function getBookModule(id) {
  return BOOK_MODULES[id] || null;
}

// === Books listing ===
app.get('/api/books', (req, res) => {
  const list = Object.values(BOOK_MODULES).map(m => ({
    id: m.book.id,
    title: m.book.title,
    bookSeries: m.book.bookSeries,
    dynasty: m.book.dynasty,
    author: m.book.author,
    description: m.book.description,
    chapterCount: m.chapters.length,
  }));
  res.json(list);
});

app.get('/api/books/:id', (req, res) => {
  const m = getBookModule(req.params.id);
  if (!m) return res.status(404).json({ error: 'Book not found' });
  res.json({
    ...m.book,
    chapters: m.chapters.map(c => ({ id: c.id, title: c.title, subtitle: c.subtitle, year: c.year })),
    eraEvents: m.eraEvents,
  });
});

// === Chapter content ===
app.get('/api/books/:bookId/chapters/:chapterId', (req, res) => {
  const m = getBookModule(req.params.bookId);
  if (!m) return res.status(404).json({ error: 'Book not found' });
  const ch = m.chapters.find(c => c.id === req.params.chapterId);
  if (!ch) return res.status(404).json({ error: 'Chapter not found' });
  res.json(ch);
});

// === Map period data ===
app.get('/api/maps/period/:periodId', (req, res) => {
  const p = periods[req.params.periodId];
  if (!p) return res.status(404).json({ error: 'Period not found', requested: req.params.periodId, available: Object.keys(periods) });
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
  fs.createReadStream(filePath).pipe(res);
});

// === Health ===
app.get('/api/health', (req, res) => {
  const books = Object.values(BOOK_MODULES).map(m => ({ id: m.book.id, title: m.book.title, chapters: m.chapters.length }));
  res.json({
    status: 'ok',
    books,
    totalChapters: books.reduce((sum, b) => sum + b.chapters, 0),
    periods: Object.keys(periods),
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  const totalCh = Object.values(BOOK_MODULES).reduce((sum, m) => sum + m.chapters.length, 0);
  console.log(`经史舆图 API server listening on http://localhost:${PORT}`);
  console.log(`  Books: ${Object.keys(BOOK_MODULES).join(', ')} (${totalCh} chapters total)`);
  console.log(`  Periods: ${Object.keys(periods).length}`);
});
