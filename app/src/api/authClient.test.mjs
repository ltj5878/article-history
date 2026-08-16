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

test('stored user is ignored when the token is missing', () => {
  const storage = memoryStorage();
  storage.setItem('jingshi.auth.v1.user', '{"email":"ghost@example.com"}');
  const client = createAuthClient({ storage });

  assert.equal(client.getStoredUser(), null);
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

test('OAuth provider status and start URL use the configured API origin', async () => {
  const assigned = [];
  const client = createAuthClient({
    apiBaseUrl: 'https://api.example.com/',
    storage: memoryStorage(),
    location: { assign: url => assigned.push(url), hash: '', pathname: '/', search: '' },
    fetchImpl: async () => jsonResponse({
      providers: [
        { id: 'qq', label: 'QQ', enabled: true },
        { id: 'wechat', label: '微信', enabled: false },
      ],
    }),
  });

  const providers = await client.getOAuthProviders();
  client.startOAuth('qq');

  assert.equal(providers[0].enabled, true);
  assert.equal(client.getOAuthStartUrl('wechat'), 'https://api.example.com/api/auth/oauth/wechat/start');
  assert.deepEqual(assigned, ['https://api.example.com/api/auth/oauth/qq/start']);
});

test('OAuth callback stores local token, loads user, and removes token from URL', async () => {
  const storage = memoryStorage();
  const replacements = [];
  const calls = [];
  const client = createAuthClient({
    apiBaseUrl: 'https://api.example.com',
    storage,
    location: {
      hash: '#oauth_access_token=local-jwt&oauth_provider=qq',
      pathname: '/reader',
      search: '?book=shiji',
    },
    history: { replaceState: (...args) => replacements.push(args) },
    fetchImpl: async (url, options) => {
      calls.push([url, options]);
      return jsonResponse({ id: 'u1', email: null, displayName: '司马读者', provider: 'qq', role: 'user', isActive: true });
    },
  });

  const user = await client.consumeOAuthCallback();

  assert.equal(user.displayName, '司马读者');
  assert.equal(storage.getItem('jingshi.auth.v1.token'), 'local-jwt');
  assert.equal(calls[0][1].headers.Authorization, 'Bearer local-jwt');
  assert.equal(replacements[0][2], '/reader?book=shiji');
});

test('OAuth callback error is removed from URL and surfaced', async () => {
  const replacements = [];
  const client = createAuthClient({
    apiBaseUrl: 'https://api.example.com',
    storage: memoryStorage(),
    location: { hash: '#oauth_error=%E7%94%A8%E6%88%B7%E5%8F%96%E6%B6%88', pathname: '/', search: '' },
    history: { replaceState: (...args) => replacements.push(args) },
  });

  await assert.rejects(() => client.consumeOAuthCallback(), /用户取消/);
  assert.equal(replacements[0][2], '/');
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
