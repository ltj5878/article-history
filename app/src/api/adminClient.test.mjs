import test from 'node:test';
import assert from 'node:assert/strict';

import { createAdminClient } from './adminClient.js';

test('admin client sends bearer token when listing books', async () => {
  const calls = [];
  const client = createAdminClient({
    apiBaseUrl: 'https://api.example.com',
    getToken: () => 'token-admin',
    fetchImpl: async (url, options) => {
      calls.push([url, options]);
      return jsonResponse([{ id: 'guoyu', title: '国语' }]);
    },
  });

  assert.deepEqual(await client.listBooks(), [{ id: 'guoyu', title: '国语' }]);
  assert.equal(calls[0][0], 'https://api.example.com/api/admin/books');
  assert.equal(calls[0][1].headers.Authorization, 'Bearer token-admin');
});

test('admin client creates books and chapters with JSON payloads', async () => {
  const calls = [];
  const client = createAdminClient({
    apiBaseUrl: 'https://api.example.com',
    getToken: () => 'token-admin',
    fetchImpl: async (url, options) => {
      calls.push([url, options]);
      return jsonResponse({ ok: true });
    },
  });

  await client.createBook({ id: 'guoyu', title: '国语' });
  await client.addChapter('guoyu', { id: 'zhouyu', title: '周语', original: '敬王问于史伯。' });

  assert.equal(calls[0][1].method, 'POST');
  assert.equal(JSON.parse(calls[0][1].body).id, 'guoyu');
  assert.equal(calls[1][0], 'https://api.example.com/api/admin/books/guoyu/chapters');
  assert.equal(JSON.parse(calls[1][1].body).original, '敬王问于史伯。');
});

test('admin client imports content packages', async () => {
  const calls = [];
  const client = createAdminClient({
    apiBaseUrl: 'https://api.example.com',
    getToken: () => 'token-admin',
    fetchImpl: async (url, options) => {
      calls.push([url, options]);
      return jsonResponse({ booksImported: 1, readingUnitsImported: 2 });
    },
  });
  const payload = { books: [{ id: 'guoyu', title: '国语', chapters: [] }] };

  assert.deepEqual(await client.importPackage(payload), { booksImported: 1, readingUnitsImported: 2 });
  assert.equal(calls[0][0], 'https://api.example.com/api/admin/import');
  assert.equal(calls[0][1].method, 'POST');
  assert.deepEqual(JSON.parse(calls[0][1].body), payload);
});

test('admin client edits reading documents', async () => {
  const calls = [];
  const client = createAdminClient({
    apiBaseUrl: 'https://api.example.com',
    getToken: () => 'token-admin',
    fetchImpl: async (url, options) => {
      calls.push([url, options]);
      return jsonResponse(url.endsWith('/units') ? [{ id: 'intro', kind: 'chapter' }] : { id: 'intro', title: '导读' });
    },
  });

  assert.deepEqual(await client.listUnits('guoyu'), [{ id: 'intro', kind: 'chapter' }]);
  assert.deepEqual(await client.getDocument('guoyu', 'chapter', 'intro'), { id: 'intro', title: '导读' });
  await client.updateDocument('guoyu', 'chapter', 'intro', { id: 'intro', title: '修订' });

  assert.equal(calls[0][0], 'https://api.example.com/api/admin/books/guoyu/units');
  assert.equal(calls[1][0], 'https://api.example.com/api/admin/books/guoyu/units/chapter/intro');
  assert.equal(calls[2][1].method, 'PUT');
  assert.deepEqual(JSON.parse(calls[2][1].body), { document: { id: 'intro', title: '修订' } });
});

test('admin client surfaces backend errors', async () => {
  const client = createAdminClient({
    apiBaseUrl: 'https://api.example.com',
    getToken: () => 'token-admin',
    fetchImpl: async () => jsonResponse({ detail: 'Book already exists' }, false, 409),
  });

  await assert.rejects(
    () => client.createBook({ id: 'guoyu', title: '国语' }),
    /Book already exists/,
  );
});

function jsonResponse(value, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => value,
  };
}
