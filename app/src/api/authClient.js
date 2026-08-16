const TOKEN_KEY = 'jingshi.auth.v1.token';
const USER_KEY = 'jingshi.auth.v1.user';
const viteEnv = import.meta.env || {};

function defaultSessionStorage() {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

export function createAuthClient({
  apiBaseUrl = viteEnv.VITE_API_BASE_URL || '',
  fetchImpl = globalThis.fetch,
  storage = defaultSessionStorage(),
  location = globalThis.location,
  history = globalThis.history,
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

  function storeToken(token) {
    storage?.setItem(TOKEN_KEY, token);
  }

  function getToken() {
    return storage?.getItem(TOKEN_KEY) || null;
  }

  function getStoredUser() {
    if (!getToken()) return null;
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
    async getOAuthProviders() {
      const payload = await request('/api/auth/oauth/providers');
      return payload.providers || [];
    },
    getOAuthStartUrl(provider) {
      if (!apiBase) throw new Error('第三方登录需要配置 VITE_API_BASE_URL');
      if (!['qq', 'wechat'].includes(provider)) throw new Error('不支持的第三方登录方式');
      return `${apiBase}/api/auth/oauth/${provider}/start`;
    },
    startOAuth(provider) {
      if (!location?.assign) throw new Error('当前环境无法跳转到第三方登录');
      if (!apiBase) throw new Error('第三方登录需要配置 VITE_API_BASE_URL');
      if (!['qq', 'wechat'].includes(provider)) throw new Error('不支持的第三方登录方式');
      location.assign(`${apiBase}/api/auth/oauth/${provider}/start`);
    },
    async consumeOAuthCallback() {
      const params = new URLSearchParams((location?.hash || '').replace(/^#/, ''));
      const token = params.get('oauth_access_token');
      const oauthError = params.get('oauth_error');
      if (!token && !oauthError) return null;

      params.delete('oauth_access_token');
      params.delete('oauth_provider');
      params.delete('oauth_error');
      const remainingHash = params.toString();
      history?.replaceState?.(
        null,
        '',
        `${location.pathname || '/'}${location.search || ''}${remainingHash ? `#${remainingHash}` : ''}`,
      );

      if (oauthError) throw new Error(oauthError);
      storeToken(token);
      try {
        const user = await request('/api/auth/me', { auth: true });
        storage?.setItem(USER_KEY, JSON.stringify(user));
        return user;
      } catch (error) {
        storage?.removeItem(TOKEN_KEY);
        storage?.removeItem(USER_KEY);
        throw error;
      }
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
