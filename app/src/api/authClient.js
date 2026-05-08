const TOKEN_KEY = 'jingshi.auth.v1.token';
const USER_KEY = 'jingshi.auth.v1.user';
const viteEnv = import.meta.env || {};

export function createAuthClient({
  apiBaseUrl = viteEnv.VITE_API_BASE_URL || '',
  fetchImpl = globalThis.fetch,
  storage = globalThis.sessionStorage,
} = {}) {
  const apiBase = (apiBaseUrl || '').replace(/\/+$/, '');

  async function request(path, { method = 'GET', body, auth = false } = {}) {
    if (!apiBase) throw new Error('Authentication requires VITE_API_BASE_URL');
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetchImpl(`${apiBase}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.detail || `Auth request failed: ${res.status}`);
    return payload;
  }

  function storeSession(payload) {
    storage?.setItem(TOKEN_KEY, payload.accessToken);
    storage?.setItem(USER_KEY, JSON.stringify(payload.user));
  }

  function getToken() {
    return storage?.getItem(TOKEN_KEY) || null;
  }

  function getStoredUser() {
    const raw = storage?.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  return {
    async register(email, password) {
      return request('/api/auth/register', { method: 'POST', body: { email, password } });
    },
    async login(email, password) {
      const payload = await request('/api/auth/login', { method: 'POST', body: { email, password } });
      storeSession(payload);
      return payload;
    },
    async me() {
      const user = await request('/api/auth/me', { auth: true });
      storage?.setItem(USER_KEY, JSON.stringify(user));
      return user;
    },
    logout() {
      storage?.removeItem(TOKEN_KEY);
      storage?.removeItem(USER_KEY);
    },
    getToken,
    getStoredUser,
  };
}

export const authClient = createAuthClient();
