// Backend API client.
// Hits the local Express server which returns book/chapter/map data.

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

async function get(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json();
}

export const api = {
  listBooks: () => get('/books'),
  getBook: (bookId) => get(`/books/${bookId}`),
  getChapter: (bookId, chapterId) => get(`/books/${bookId}/chapters/${chapterId}`),
  getPeriod: (periodId) => get(`/maps/period/${periodId}`),
  geoUrl: (layer) => `${API_BASE}/geo/${layer}`,
};
