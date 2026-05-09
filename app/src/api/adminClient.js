const viteEnv = import.meta.env || {};

export function createAdminClient({
  apiBaseUrl = viteEnv.VITE_API_BASE_URL || '',
  getToken,
  fetchImpl = globalThis.fetch,
} = {}) {
  const apiBase = (apiBaseUrl || '').replace(/\/+$/, '');

  async function request(path, { method = 'GET', body } = {}) {
    if (!apiBase) throw new Error('Admin requires VITE_API_BASE_URL');
    const token = getToken?.();
    if (!token) throw new Error('Admin authentication required');
    const res = await fetchImpl(`${apiBase}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.detail || `Admin request failed: ${res.status}`);
    return payload;
  }

  return {
    listBooks: () => request('/api/admin/books'),
    createBook: (payload) => request('/api/admin/books', { method: 'POST', body: payload }),
    updateBook: (bookId, payload) => request(`/api/admin/books/${bookId}`, { method: 'PATCH', body: payload }),
    deleteBook: (bookId) => request(`/api/admin/books/${bookId}`, { method: 'DELETE' }),
    addChapter: (bookId, payload) => request(`/api/admin/books/${bookId}/chapters`, { method: 'POST', body: payload }),
  };
}
