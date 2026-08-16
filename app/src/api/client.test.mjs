import test from 'node:test';
import assert from 'node:assert/strict';

import { createApiClient } from './client.js';

test('static mode reads generated data files', async () => {
  const calls = [];
  const api = createApiClient({
    staticBaseUrl: '/data',
    fetchImpl: async (url) => {
      calls.push(url);
      return jsonResponse([{ id: 'shiji' }]);
    },
  });

  assert.deepEqual(await api.listBooks(), [{ id: 'shiji' }]);
  assert.deepEqual(calls, ['/data/books.json']);
});

test('api mode reads backend endpoints', async () => {
  const calls = [];
  const api = createApiClient({
    apiBaseUrl: 'http://127.0.0.1:8000',
    staticBaseUrl: '/data',
    fetchImpl: async (url) => {
      calls.push(url);
      return jsonResponse([{ id: 'zuozhuan' }]);
    },
  });

  assert.deepEqual(await api.listBooks(), [{ id: 'zuozhuan' }]);
  assert.deepEqual(calls, ['http://127.0.0.1:8000/api/books']);
});

test('api mode falls back to static data when backend is unavailable', async () => {
  const calls = [];
  const statuses = [];
  const api = createApiClient({
    apiBaseUrl: 'http://127.0.0.1:8000',
    staticBaseUrl: '/data',
    onStatus: status => statuses.push(status),
    fetchImpl: async (url) => {
      calls.push(url);
      if (url.startsWith('http://127.0.0.1:8000')) {
        throw new Error('backend unavailable');
      }
      return jsonResponse([{ id: 'fallback' }]);
    },
  });

  assert.deepEqual(await api.listBooks(), [{ id: 'fallback' }]);
  assert.deepEqual(calls, ['http://127.0.0.1:8000/api/books', '/data/books.json']);
  assert.equal(statuses.at(-1).fallback, true);
  assert.equal(api.geoUrl('china_provinces'), '/data/geo/china_provinces.geojson');
});

test('api mode does not hide client errors behind static fallback', async () => {
  const calls = [];
  const api = createApiClient({
    apiBaseUrl: 'http://127.0.0.1:8000',
    staticBaseUrl: '/data',
    fetchImpl: async (url) => {
      calls.push(url);
      return jsonResponse({ detail: 'forbidden' }, false, 403);
    },
  });

  await assert.rejects(() => api.listBooks(), /403/);
  assert.deepEqual(calls, ['http://127.0.0.1:8000/api/books']);
});

test('reading unit catalog includes every book', async () => {
  const api = createApiClient({
    staticBaseUrl: '/data',
    fetchImpl: async (url) => {
      if (url === '/data/books.json') return jsonResponse([{ id: 'shiji' }, { id: 'zuozhuan' }]);
      if (url === '/data/books/shiji.json') {
        return jsonResponse({ id: 'shiji', title: '史记', articles: [{ id: 'xiangyu', title: '项羽本纪' }] });
      }
      if (url === '/data/books/zuozhuan.json') {
        return jsonResponse({ id: 'zuozhuan', title: '左传', chapters: [{ id: 'bi', title: '邲之战' }] });
      }
      throw new Error(`unexpected url: ${url}`);
    },
  });

  assert.deepEqual(await api.listReadingUnits(), [
    { bookId: 'shiji', bookTitle: '史记', chapterId: 'xiangyu', chapterTitle: '项羽本纪', kind: 'article' },
    { bookId: 'zuozhuan', bookTitle: '左传', chapterId: 'bi', chapterTitle: '邲之战', kind: 'chapter' },
  ]);
});

test('reading unit catalog includes both articles and chapters from a mixed book', async () => {
  const api = createApiClient({
    staticBaseUrl: '/data',
    fetchImpl: async (url) => {
      if (url === '/data/books.json') return jsonResponse([{ id: 'shiji' }]);
      if (url === '/data/books/shiji.json') {
        return jsonResponse({
          id: 'shiji',
          title: '史记',
          articles: [{ id: 'xiangyu', title: '项羽本纪' }],
          chapters: [{ id: 'intro', title: '导读' }],
        });
      }
      throw new Error(`unexpected url: ${url}`);
    },
  });

  assert.deepEqual(await api.listReadingUnits(), [
    { bookId: 'shiji', bookTitle: '史记', chapterId: 'xiangyu', chapterTitle: '项羽本纪', kind: 'article' },
    { bookId: 'shiji', bookTitle: '史记', chapterId: 'intro', chapterTitle: '导读', kind: 'chapter' },
  ]);
});

test('geoUrl follows the active data source', () => {
  const staticApi = createApiClient({ staticBaseUrl: '/data' });
  const backendApi = createApiClient({ apiBaseUrl: 'https://api.example.com', staticBaseUrl: '/data' });

  assert.equal(staticApi.geoUrl('china_provinces'), '/data/geo/china_provinces.geojson');
  assert.equal(backendApi.geoUrl('china_provinces'), 'https://api.example.com/api/geo/china_provinces');
});

function jsonResponse(value, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => value,
  };
}
