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
