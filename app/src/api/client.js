// Data client Adapter. Static JSON remains the default so Netlify deployment
// keeps working; VITE_API_BASE_URL enables the Python content backend.

const viteEnv = import.meta.env || {};
const defaultStaticBase = `${viteEnv.BASE_URL || '/'}data`.replace(/\/+$/, '');

export function createApiClient({
  apiBaseUrl = '',
  staticBaseUrl = defaultStaticBase,
  fetchImpl = globalThis.fetch,
  onStatus = () => {},
} = {}) {
  const apiBase = normalizeBase(apiBaseUrl);
  const staticBase = normalizeBase(staticBaseUrl);
  let forceStatic = false;
  let activeMode = apiBase ? 'api' : 'static';

  function reportStatus(status) {
    activeMode = status.mode;
    onStatus({
      mode: status.mode,
      fallback: Boolean(status.fallback),
      reason: status.reason || '',
      apiConfigured: Boolean(apiBase),
    });
  }

  async function getJson({ apiPath, staticPath }, { signal } = {}) {
    if (apiBase && !forceStatic) {
      try {
        const data = await fetchJson(`${apiBase}${apiPath}`, { signal });
        reportStatus({ mode: 'api' });
        return data;
      } catch (err) {
        if (err?.name === 'AbortError') throw err;
        if (!shouldFallback(err)) throw err;
        reportStatus({ mode: 'static', fallback: true, reason: err.message });
      }
    }
    const data = await fetchJson(`${staticBase}${staticPath}`, { signal });
    if (!apiBase) reportStatus({ mode: 'static' });
    if (forceStatic) reportStatus({ mode: 'static', fallback: true, reason: 'manual' });
    return data;
  }

  async function fetchJson(url, { signal } = {}) {
    const res = await fetchImpl(url, { signal });
    if (!res.ok) throw new HttpError(`Data ${url}: ${res.status}`, res.status);
    return res.json();
  }

  const listBooks = (opts) => getJson({ apiPath: '/api/books', staticPath: '/books.json' }, opts);
  const getBook = (bookId, opts) => getJson({ apiPath: `/api/books/${bookId}`, staticPath: `/books/${bookId}.json` }, opts);
  const getChapter = (bookId, chapterId, opts) => getJson({
      apiPath: `/api/books/${bookId}/chapters/${chapterId}`,
      staticPath: `/books/${bookId}/${chapterId}.json`,
    }, opts);
  const getArticle = (bookId, articleId, opts) => getJson({
      apiPath: `/api/books/${bookId}/articles/${articleId}`,
      staticPath: `/books/${bookId}/${articleId}.json`,
    }, opts);

  async function listReadingUnits(opts) {
    const books = await listBooks(opts);
    const metadata = await Promise.all(books.map(book => getBook(book.id, opts)));
    return metadata.flatMap(book => [
      ...(book.articles || []).map(item => ({
        bookId: book.id,
        bookTitle: book.title,
        chapterId: item.id,
        chapterTitle: item.title,
        kind: 'article',
      })),
      ...(book.chapters || []).map(item => ({
        bookId: book.id,
        bookTitle: book.title,
        chapterId: item.id,
        chapterTitle: item.title,
        kind: 'chapter',
      })),
    ]);
  }

  return {
    listBooks,
    getBook,
    getChapter,
    getArticle,
    listReadingUnits,
    getPeriod: (periodId, opts) => getJson({
      apiPath: `/api/maps/period/${periodId}`,
      staticPath: `/periods/${periodId}.json`,
    }, opts),
    getStatus: () => ({ mode: activeMode, fallback: forceStatic || (apiBase && activeMode === 'static'), apiConfigured: Boolean(apiBase) }),
    useStatic: () => {
      forceStatic = true;
      reportStatus({ mode: 'static', fallback: true, reason: 'manual' });
    },
    useApi: () => {
      forceStatic = false;
      reportStatus({ mode: apiBase ? 'api' : 'static' });
    },
    geoUrl: (layer) => apiBase && activeMode === 'api' && !forceStatic
      ? `${apiBase}/api/geo/${layer}`
      : `${staticBase}/geo/${layer}.geojson`,
  };
}

class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

function shouldFallback(error) {
  return !(error instanceof HttpError) || error.status >= 500;
}

function normalizeBase(base) {
  return (base || '').replace(/\/+$/, '');
}

let dataSourceStatus = {
  mode: viteEnv.VITE_API_BASE_URL ? 'api' : 'static',
  fallback: false,
  reason: '',
  apiConfigured: Boolean(viteEnv.VITE_API_BASE_URL),
};
const dataSourceListeners = new Set();

export function getDataSourceStatus() {
  return dataSourceStatus;
}

export function subscribeDataSourceStatus(listener) {
  dataSourceListeners.add(listener);
  return () => dataSourceListeners.delete(listener);
}

export const api = createApiClient({
  apiBaseUrl: viteEnv.VITE_API_BASE_URL,
  staticBaseUrl: defaultStaticBase,
  onStatus: status => {
    dataSourceStatus = status;
    dataSourceListeners.forEach(listener => listener(status));
  },
});
