import { lazy, Suspense, useMemo, useReducer, useEffect, useRef, useState } from 'react';
import TopNav from './components/TopNav';
import ReaderPane from './components/ReaderPane';
import Timeline from './components/Timeline';
import ErrorBoundary from './components/ErrorBoundary';
import { api, getDataSourceStatus, subscribeDataSourceStatus } from './api/client';
import { createAdminClient } from './api/adminClient';
import { authClient } from './api/authClient';
import { getProgress, saveProgress } from './utils/storage';

const PREFS_KEY = 'jingshi.prefs.v1';
const MapPane = lazy(() => import('./components/MapPane'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const savedPrefs = loadPrefs();
const legacyShijiBookIds = new Set(['xiangyu', 'gaozu', 'qinshihuang', 'liezhuan']);
const savedBookId = legacyShijiBookIds.has(savedPrefs.bookId) ? 'shiji' : savedPrefs.bookId;

const initialBookId = savedBookId || 'shiji';
const initialProgress = getProgress(initialBookId);
const initialMobileViewport = isMobileViewport();
const initialTimelineCollapsed = initialMobileViewport
  ? (typeof savedPrefs.timelineCollapsedMobile === 'boolean' ? savedPrefs.timelineCollapsedMobile : true)
  : Boolean(savedPrefs.timelineCollapsed);

const initialState = {
  bookId: initialBookId,
  bookTitle: '史记',
  dynasty: '西汉',
  chapterId: initialProgress?.chapterId || null,
  activeParagraph: null,
  pendingSection: null,
  pendingParagraph: initialProgress?.paragraphId || null,
  textMode: 'both',
  timelineCollapsed: initialTimelineCollapsed,
  vertical: false,
  theme: savedPrefs.theme || 'classic',
  layers: { places: true, routes: true, territories: true, provinces: true },
  selectedPlace: null,
  splitRatio: typeof savedPrefs.splitRatio === 'number' ? savedPrefs.splitRatio : 0.4,
};

function reducer(state, action) {
  switch (action.type) {
    case 'set':
      return { ...state, [action.key]: action.value };
    case 'toggle':
      return { ...state, [action.key]: !state[action.key] };
    case 'toggleLayer':
      return { ...state, layers: { ...state.layers, [action.layer]: !state.layers[action.layer] } };
    case 'selectBook': {
      // Switch books. Restore last reading position if any, else let the load
      // effect pick the first chapter.
      const progress = getProgress(action.id);
      return {
        ...state,
        bookId: action.id,
        chapterId: progress?.chapterId || null,
        activeParagraph: null,
        pendingSection: null,
        pendingParagraph: progress?.paragraphId || null,
        selectedPlace: null,
      };
    }
    case 'selectChapter':
      return { ...state, chapterId: action.id, activeParagraph: null, pendingSection: null, pendingParagraph: null, selectedPlace: null };
    case 'jumpTo':
      // Jump to a specific paragraph (used by bookmarks, search, map→text).
      // If chapter changes, defer paragraph selection via pendingParagraph.
      if (action.bookId && action.bookId !== state.bookId) {
        return {
          ...state,
          bookId: action.bookId,
          chapterId: action.chapterId,
          activeParagraph: null,
          pendingSection: null,
          pendingParagraph: action.paragraphId || null,
          selectedPlace: null,
        };
      }
      if (action.chapterId && action.chapterId !== state.chapterId) {
        return {
          ...state,
          chapterId: action.chapterId,
          activeParagraph: null,
          pendingSection: null,
          pendingParagraph: action.paragraphId || null,
          selectedPlace: null,
        };
      }
      return { ...state, activeParagraph: action.paragraphId || state.activeParagraph };
    case 'selectPlace':
    case 'focusEntity':
      return { ...state, selectedPlace: action.entity };
    case 'cycleTheme': {
      const order = ['classic', 'dark', 'bright'];
      return { ...state, theme: order[(order.indexOf(state.theme) + 1) % order.length] };
    }
    case 'pickEra':
      if (action.event.targets?.length) {
        const target = action.event.targets.find(t => t.article === state.chapterId) || action.event.targets[0];
        return {
          ...state,
          chapterId: target.article,
          pendingSection: target.section || null,
          activeParagraph: null,
          pendingParagraph: null,
          selectedPlace: null,
        };
      }
      if (action.event.article) {
        return {
          ...state,
          chapterId: action.event.article,
          pendingSection: action.event.section || null,
          activeParagraph: null,
          pendingParagraph: null,
          selectedPlace: null,
        };
      }
      return { ...state, chapterId: action.event.chapter, pendingSection: null, activeParagraph: null, pendingParagraph: null, selectedPlace: null };
    case 'setSplit':
      return { ...state, splitRatio: Math.max(0.25, Math.min(0.65, action.value)) };
    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [authUser, setAuthUser] = useState(() => authClient.getStoredUser());
  const [authError, setAuthError] = useState('');
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminDirty, setAdminDirty] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [allBooks, setAllBooks] = useState([]);
  const [bookMeta, setBookMeta] = useState(null);
  const [chapter, setChapter] = useState(null);
  const [period, setPeriod] = useState(null);
  const [error, setError] = useState(null);
  const [dataSourceStatus, setDataSourceStatus] = useState(getDataSourceStatus);

  useEffect(() => subscribeDataSourceStatus(setDataSourceStatus), []);

  useEffect(() => {
    let active = true;
    authClient.consumeOAuthCallback()
      .then(user => {
        if (active && user) setAuthUser(user);
      })
      .catch(err => {
        if (active) setAuthError(err?.message || '第三方登录失败');
      });
    return () => {
      active = false;
    };
  }, []);

  // Theme sync
  useEffect(() => {
    const t = state.theme === 'classic' ? '' : state.theme;
    if (t) document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }, [state.theme]);

  // Persist reading progress per book
  useEffect(() => {
    if (!state.bookId || !state.chapterId || !state.activeParagraph) return;
    saveProgress(state.bookId, {
      chapterId: state.chapterId,
      paragraphId: state.activeParagraph,
    });
  }, [state.bookId, state.chapterId, state.activeParagraph]);

  // Persist user preferences
  useEffect(() => {
    try {
      const current = loadPrefs();
      const timelineKey = isMobileViewport() ? 'timelineCollapsedMobile' : 'timelineCollapsed';
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        ...current,
        bookId: state.bookId,
        theme: state.theme,
        splitRatio: state.splitRatio,
        [timelineKey]: state.timelineCollapsed,
      }));
    } catch {
      // localStorage may be unavailable (private mode, quota); ignore
    }
  }, [state.bookId, state.theme, state.splitRatio, state.timelineCollapsed]);

  // Load global book list once
  useEffect(() => {
    const ctrl = new AbortController();
    api.listBooks({ signal: ctrl.signal })
      .then(setAllBooks)
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => ctrl.abort();
  }, [dataVersion]);

  // Load book metadata + chapter list when bookId changes
  useEffect(() => {
    // Clear stale data so the picker / reader don't show the previous book
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBookMeta(null);
    setChapter(null);
    setPeriod(null);
    const ctrl = new AbortController();
    let active = true;
    api.getBook(state.bookId, { signal: ctrl.signal })
      .then(b => {
        if (active) setBookMeta(b);
      })
      .catch(e => {
        if (e.name === 'AbortError' || !active) return;
        // The active book may have been deleted in the admin panel. Switch to
        // the first remaining book instead of leaving the app on an error.
        if (e.status === 404) {
          api.listBooks()
            .then(list => {
              if (!active) return;
              if (list.some(book => book.id === state.bookId)) {
                setError(e.message);
                return;
              }
              const nextBook = list[0] || null;
              if (nextBook) {
                dispatch({ type: 'selectBook', id: nextBook.id });
              } else {
                setError('书目为空，请先在后台导入内容');
              }
            })
            .catch(() => {
              if (active) setError(e.message);
            });
          return;
        }
        setError(e.message);
      });
    return () => {
      active = false;
      ctrl.abort();
    };
  }, [state.bookId, dataVersion]);

  const readingItems = useMemo(() => [
    ...(bookMeta?.articles || []).map(item => ({ ...item, kind: 'article' })),
    ...(bookMeta?.chapters || []).map(item => ({ ...item, kind: 'chapter' })),
  ], [bookMeta]);

  // Whenever bookMeta loads or chapter is null, ensure a reading item is selected.
  // Guard against stale bookMeta: only auto-select when bookMeta is for the
  // currently-active book (otherwise we'd pick a chapter from the previous book).
  useEffect(() => {
    if (!bookMeta || bookMeta.id !== state.bookId || !readingItems[0]) return;
    const exists = state.chapterId && readingItems.some(item => item.id === state.chapterId);
    if (!exists) {
      dispatch({ type: 'selectChapter', id: readingItems[0].id });
    }
  }, [bookMeta, state.bookId, state.chapterId, readingItems]);

  // Load chapter/article content when chapterId changes
  useEffect(() => {
    if (!state.chapterId || !bookMeta || bookMeta.id !== state.bookId) return;
    const item = readingItems.find(readingItem => readingItem.id === state.chapterId);
    if (!item) return;
    const ctrl = new AbortController();
    const load = item.kind === 'article' ? api.getArticle : api.getChapter;
    load(state.bookId, state.chapterId, { signal: ctrl.signal })
      .then(c => {
        setChapter(c);
        const pending = state.pendingParagraph
          ? findParagraph(c, state.pendingParagraph)
          : null;
        const firstParagraph = pending
          || findSection(c, state.pendingSection)?.paragraphs?.[0]
          || getFirstParagraph(c);
        if (firstParagraph) {
          dispatch({ type: 'set', key: 'activeParagraph', value: firstParagraph.id });
        }
      })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => ctrl.abort();
  }, [state.chapterId, state.bookId, bookMeta, readingItems, state.pendingSection, state.pendingParagraph]);

  // Keep rendering the previous document out of the tree while a new
  // chapter/article is loading; otherwise pickers and reader briefly disagree.
  const activeChapter = chapter?.id === state.chapterId ? chapter : null;
  const paragraph = findParagraph(activeChapter, state.activeParagraph) || getFirstParagraph(activeChapter);
  const activeSection = findSectionForParagraph(activeChapter, paragraph?.id);
  const periodId = activeSection?.period || activeChapter?.period || null;
  const currentYear = activeSection?.year || activeChapter?.year;
  const currentTimelineItem = activeSection?.id || state.chapterId;
  const mapChapter = activeChapter ? { ...activeChapter, paragraphs: getAllParagraphs(activeChapter) } : null;

  useEffect(() => {
    if (!periodId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPeriod(null);
      return;
    }
    const ctrl = new AbortController();
    api.getPeriod(periodId, { signal: ctrl.signal })
      .then(setPeriod)
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => ctrl.abort();
  }, [periodId]);

  // Split-pane drag
  const dragRef = useRef(null);
  const onSplitDown = (e) => {
    if (e.button !== 0 && e.button !== undefined) return;
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startRatio: state.splitRatio, w: window.innerWidth };
    document.body.style.cursor = 'col-resize';
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  useEffect(() => {
    const move = (e) => {
      if (!dragRef.current) return;
      if (dragRef.current.pointerId !== undefined && e.pointerId !== dragRef.current.pointerId) return;
      const dx = e.clientX - dragRef.current.startX;
      dispatch({ type: 'setSplit', value: dragRef.current.startRatio + dx / dragRef.current.w });
    };
    const stop = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      document.body.style.cursor = '';
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('blur', stop);
    };
  }, []);

  const retryData = () => {
    api.useApi();
    setError(null);
    setDataVersion(version => version + 1);
  };

  const useOfflineData = () => {
    api.useStatic();
    setError(null);
    setDataVersion(version => version + 1);
  };

  const auth = useMemo(() => ({
    user: authUser,
    login: async (email, password) => {
      const result = await authClient.login(email, password);
      setAuthUser(result.user);
      return result;
    },
    register: (email, password) => authClient.register(email, password),
    getOAuthProviders: () => authClient.getOAuthProviders(),
    startOAuth: (provider) => authClient.startOAuth(provider),
    logout: () => {
      if (adminOpen && adminDirty && !window.confirm('后台有尚未保存的修改，确定退出登录吗？')) return;
      authClient.logout();
      setAuthUser(null);
      setAdminOpen(false);
      setAdminDirty(false);
    },
    openAdmin: () => setAdminOpen(true),
  }), [adminDirty, adminOpen, authUser]);

  if (error) {
    return <div className="app-error" role="alert">
      <h2>无法加载数据</h2>
      <p>{error}</p>
      <p>请检查网络后重试；本地开发还可在 <code>app/</code> 目录执行 <code>npm run build:data</code>。</p>
      <div className="app-error__actions">
        <button type="button" onClick={retryData}>重试</button>
        {dataSourceStatus.apiConfigured && <button type="button" onClick={useOfflineData}>使用离线数据</button>}
      </div>
    </div>;
  }

  if (!bookMeta || bookMeta.id !== state.bookId) return <div className="loading">加载中…</div>;

  // Books picker shows all available books from the backend; the active book's
  // chapter list comes from bookMeta (which is bookId-specific). Books may
  // contain chapters, articles, or both, so decorate every item with its kind.
  const decorateItems = (items, kind) => (items || []).map(item => ({ ...item, kind }));
  const activeBookItems = decorateItems(bookMeta.articles, 'article')
    .concat(decorateItems(bookMeta.chapters, 'chapter'));
  const books = allBooks.length
    ? allBooks.map(b => ({
        ...b,
        chapters: b.id === bookMeta.id ? activeBookItems : [],
        itemKind: b.id === bookMeta.id
          ? (bookMeta.articles?.length ? 'article' : 'chapter')
          : (b.articleCount > 0 ? 'article' : 'chapter'),
      }))
    : [{ id: bookMeta.id, title: bookMeta.title, dynasty: bookMeta.dynasty, chapters: activeBookItems, itemKind: bookMeta.articles ? 'article' : 'chapter' }];

  const adminClient = createAdminClient({
    getToken: authClient.getToken,
  });

  return (
    <ErrorBoundary>
      <div className="app">
        <TopNav state={state} dispatch={dispatch} books={books} auth={auth} catalogVersion={dataVersion} />
        {authError && (
          <div className="auth-error-banner" role="alert">
            <span>{authError}</span>
            <button type="button" onClick={() => setAuthError('')}>关闭</button>
          </div>
        )}
        {dataSourceStatus.fallback && (
          <div className="data-source-banner" role="status">
            <span>后端暂不可用，当前使用离线数据。</span>
            <button type="button" onClick={retryData}>重试后端</button>
          </div>
        )}
        {adminOpen && authUser?.role === 'admin' && (
          <Suspense fallback={<div className="admin-panel admin-panel--loading">正在加载后台…</div>}>
            <AdminPanel
              adminClient={adminClient}
              onClose={() => {
                setAdminOpen(false);
                setAdminDirty(false);
              }}
              onChanged={() => setDataVersion(version => version + 1)}
              onDirtyChange={setAdminDirty}
            />
          </Suspense>
        )}
        <div className="splitpane" style={{ '--split': `${state.splitRatio * 100}%` }}>
          <div className="splitpane__left">
            <ErrorBoundary label="阅读器渲染错误">
              <ReaderPane chapter={activeChapter} state={{ ...state, bookTitle: bookMeta.title, dynasty: bookMeta.dynasty }} dispatch={dispatch} />
            </ErrorBoundary>
          </div>
          <div
            className="splitpane__gutter"
            role="separator"
            aria-label="调整阅读区与地图宽度"
            aria-orientation="vertical"
            aria-valuemin="25"
            aria-valuemax="65"
            aria-valuenow={Math.round(state.splitRatio * 100)}
            tabIndex={0}
            onPointerDown={onSplitDown}
            onKeyDown={event => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              event.preventDefault();
              dispatch({ type: 'setSplit', value: state.splitRatio + (event.key === 'ArrowRight' ? 0.02 : -0.02) });
            }}
          />
          <div className="splitpane__right">
            <ErrorBoundary label="地图渲染错误">
              <Suspense fallback={<div className="map map--loading">加载地图组件…</div>}>
                <MapPane key={`map-${dataSourceStatus.mode}`} paragraph={paragraph} state={state} dispatch={dispatch} chapter={mapChapter} period={period} />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
        <ErrorBoundary label="时间轴渲染错误">
        <Timeline
          events={bookMeta.eraEvents || []}
          chapters={readingItems}
          currentChapter={currentTimelineItem}
          currentYear={currentYear}
          collapsed={state.timelineCollapsed}
          onToggleCollapsed={() => dispatch({ type: 'toggle', key: 'timelineCollapsed' })}
          onPick={(ev) => dispatch({ type: 'pickEra', event: ev })}
        />
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
}

function getAllParagraphs(doc) {
  if (!doc) return [];
  if (Array.isArray(doc.paragraphs)) return doc.paragraphs;
  return (Array.isArray(doc.sections) ? doc.sections : []).flatMap(
    section => (Array.isArray(section?.paragraphs) ? section.paragraphs : [])
  );
}

function getFirstParagraph(doc) {
  return getAllParagraphs(doc)[0] || null;
}

function findParagraph(doc, paragraphId) {
  if (!doc || !paragraphId) return null;
  return getAllParagraphs(doc).find(p => p.id === paragraphId) || null;
}

function findSection(doc, sectionId) {
  if (!Array.isArray(doc?.sections) || !sectionId) return null;
  return doc.sections.find(section => section.id === sectionId) || null;
}

function findSectionForParagraph(doc, paragraphId) {
  if (!Array.isArray(doc?.sections) || !paragraphId) return null;
  return doc.sections.find(section => (Array.isArray(section?.paragraphs) ? section.paragraphs : []).some(p => p.id === paragraphId)) || null;
}

function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
}
