// Data client Adapter. Static JSON remains the default so Netlify deployment
// keeps working; VITE_API_BASE_URL enables the Python content backend.

const viteEnv = import.meta.env || {};
const defaultStaticBase = `${viteEnv.BASE_URL || '/'}data`.replace(/\/+$/, '');

export function createApiClient({
  apiBaseUrl = '',
  staticBaseUrl = defaultStaticBase,
  fetchImpl = globalThis.fetch,
} = {}) {
  const apiBase = normalizeBase(apiBaseUrl);
  const staticBase = normalizeBase(staticBaseUrl);

  async function getJson({ apiPath, staticPath }, { signal } = {}) {
    if (apiBase) {
      try {
        return await fetchJson(`${apiBase}${apiPath}`, { signal });
      } catch (err) {
        if (err?.name === 'AbortError') throw err;
      }
    }
    return fetchJson(`${staticBase}${staticPath}`, { signal });
  }

  async function fetchJson(url, { signal } = {}) {
    const res = await fetchImpl(url, { signal });
    if (!res.ok) throw new Error(`Data ${url}: ${res.status}`);
    return res.json();
  }

  return {
    listBooks: (opts) => getJson({ apiPath: '/api/books', staticPath: '/books.json' }, opts),
    getBook: (bookId, opts) => getJson({ apiPath: `/api/books/${bookId}`, staticPath: `/books/${bookId}.json` }, opts),
    getChapter: (bookId, chapterId, opts) => getJson({
      apiPath: `/api/books/${bookId}/chapters/${chapterId}`,
      staticPath: `/books/${bookId}/${chapterId}.json`,
    }, opts),
    getArticle: (bookId, articleId, opts) => getJson({
      apiPath: `/api/books/${bookId}/articles/${articleId}`,
      staticPath: `/books/${bookId}/${articleId}.json`,
    }, opts),
    getPeriod: (periodId, opts) => getJson({
      apiPath: `/api/maps/period/${periodId}`,
      staticPath: `/periods/${periodId}.json`,
    }, opts),
    geoUrl: (layer) => apiBase ? `${apiBase}/api/geo/${layer}` : `${staticBase}/geo/${layer}.geojson`,
  };
}

function normalizeBase(base) {
  return (base || '').replace(/\/+$/, '');
}

export const api = createApiClient({
  apiBaseUrl: viteEnv.VITE_API_BASE_URL,
  staticBaseUrl: defaultStaticBase,
});
