import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthClient } from './authClient.js';

test('login stores token and user in session storage', async () => {
  const storage = memoryStorage();
  const client = createAuthClient({
    apiBaseUrl: 'http://127.0.0.1:8000',
    storage,
    fetchImpl: async () => jsonResponse({
      accessToken: 'token-123',
      tokenType: 'bearer',
      expiresIn: 1800,
      user: { id: 'u1', email: 'reader@example.com', role: 'user', isActive: true },
    }),
  });

  const result = await client.login('reader@example.com', 'correct horse battery staple');

  assert.equal(result.accessToken, 'token-123');
  assert.equal(storage.getItem('jingshi.auth.v1.token'), 'token-123');
  assert.equal(JSON.parse(storage.getItem('jingshi.auth.v1.user')).email, 'reader@example.com');
});

test('me sends bearer token', async () => {
  const storage = memoryStorage();
  storage.setItem('jingshi.auth.v1.token', 'token-abc');
  const calls = [];
  const client = createAuthClient({
    apiBaseUrl: 'https://api.example.com',
    storage,
    fetchImpl: async (url, options) => {
      calls.push([url, options]);
      return jsonResponse({ id: 'u1', email: 'reader@example.com', role: 'user', isActive: true });
    },
  });

  await client.me();

  assert.equal(calls[0][0], 'https://api.example.com/api/auth/me');
  assert.equal(calls[0][1].headers.Authorization, 'Bearer token-abc');
});

test('logout clears session storage', () => {
  const storage = memoryStorage();
  storage.setItem('jingshi.auth.v1.token', 'token-abc');
  storage.setItem('jingshi.auth.v1.user', '{"email":"reader@example.com"}');
  const client = createAuthClient({ storage });

  client.logout();

  assert.equal(storage.getItem('jingshi.auth.v1.token'), null);
  assert.equal(storage.getItem('jingshi.auth.v1.user'), null);
});

test('register surfaces backend errors', async () => {
  const client = createAuthClient({
    apiBaseUrl: 'https://api.example.com',
    storage: memoryStorage(),
    fetchImpl: async () => jsonResponse({ detail: 'Email already registered' }, false, 409),
  });

  await assert.rejects(
    () => client.register('reader@example.com', 'correct horse battery staple'),
    /Email already registered/,
  );
});

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

function jsonResponse(value, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => value,
  };
}
