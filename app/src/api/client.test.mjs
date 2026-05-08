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
  const api = createApiClient({
    apiBaseUrl: 'http://127.0.0.1:8000',
    staticBaseUrl: '/data',
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
