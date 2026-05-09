// Lightweight localStorage wrapper for reading progress, bookmarks, and search history.
// All operations are guarded so private mode / quota errors don't break the UI.

const PROGRESS_KEY = 'jingshi.reading-progress.v1';
const BOOKMARKS_KEY = 'jingshi.bookmarks.v1';
const SEARCH_HISTORY_KEY = 'jingshi.search-history.v1';

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore (private mode / quota)
  }
}

// === Reading progress: { [bookId]: { chapterId, paragraphId, scrollTop, ts } } ===
export function loadProgress() {
  return readJSON(PROGRESS_KEY, {});
}

export function saveProgress(bookId, entry) {
  if (!bookId) return;
  const all = loadProgress();
  all[bookId] = { ...entry, ts: Date.now() };
  writeJSON(PROGRESS_KEY, all);
}

export function getProgress(bookId) {
  return loadProgress()[bookId] || null;
}

// === Bookmarks: [{ id, bookId, bookTitle, chapterId, chapterTitle, paragraphId, snippet, ts }] ===
export function loadBookmarks() {
  const list = readJSON(BOOKMARKS_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function saveBookmarks(list) {
  writeJSON(BOOKMARKS_KEY, list);
}

export function bookmarkId(bookId, chapterId, paragraphId) {
  return `${bookId}::${chapterId}::${paragraphId}`;
}

export function isBookmarked(bookId, chapterId, paragraphId) {
  const id = bookmarkId(bookId, chapterId, paragraphId);
  return loadBookmarks().some(b => b.id === id);
}

export function addBookmark(entry) {
  const id = bookmarkId(entry.bookId, entry.chapterId, entry.paragraphId);
  const list = loadBookmarks().filter(b => b.id !== id);
  list.unshift({ ...entry, id, ts: Date.now() });
  saveBookmarks(list);
  return list;
}

export function removeBookmark(bookId, chapterId, paragraphId) {
  const id = bookmarkId(bookId, chapterId, paragraphId);
  const list = loadBookmarks().filter(b => b.id !== id);
  saveBookmarks(list);
  return list;
}

// === Search history: [{ q, ts }] (capped at 10) ===
const SEARCH_HISTORY_MAX = 10;

export function loadSearchHistory() {
  const list = readJSON(SEARCH_HISTORY_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function pushSearchHistory(q) {
  const trimmed = (q || '').trim();
  if (!trimmed) return loadSearchHistory();
  const list = loadSearchHistory().filter(x => x.q !== trimmed);
  list.unshift({ q: trimmed, ts: Date.now() });
  const capped = list.slice(0, SEARCH_HISTORY_MAX);
  writeJSON(SEARCH_HISTORY_KEY, capped);
  return capped;
}

export function clearSearchHistory() {
  writeJSON(SEARCH_HISTORY_KEY, []);
}
