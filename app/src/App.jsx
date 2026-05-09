import { useMemo, useReducer, useEffect, useRef, useState } from 'react';
import TopNav from './components/TopNav';
import ReaderPane from './components/ReaderPane';
import MapPane from './components/MapPane';
import Timeline from './components/Timeline';
import ErrorBoundary from './components/ErrorBoundary';
import AdminPanel from './components/AdminPanel';
import { api } from './api/client';
import { createAdminClient } from './api/adminClient';
import { authClient } from './api/authClient';
import { getProgress, saveProgress } from './utils/storage';

const PREFS_KEY = 'jingshi.prefs.v1';

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

const initialState = {
  bookId: initialBookId,
  bookTitle: '史记',
  dynasty: '西汉',
  chapterId: initialProgress?.chapterId || null,
  activeParagraph: null,
  pendingSection: null,
  pendingParagraph: initialProgress?.paragraphId || null,
  textMode: 'both',
  timelineCollapsed: savedPrefs.timelineCollapsed || false,
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
  const [adminOpen, setAdminOpen] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [allBooks, setAllBooks] = useState([]);
  const [bookMeta, setBookMeta] = useState(null);
  const [chapter, setChapter] = useState(null);
  const [period, setPeriod] = useState(null);
  const [error, setError] = useState(null);

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
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        bookId: state.bookId,
        theme: state.theme,
        splitRatio: state.splitRatio,
        timelineCollapsed: state.timelineCollapsed,
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
    api.getBook(state.bookId, { signal: ctrl.signal })
      .then(b => setBookMeta(b))
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => ctrl.abort();
  }, [state.bookId, dataVersion]);

  const readingItems = useMemo(() => bookMeta?.articles || bookMeta?.chapters || [], [bookMeta]);
  const isArticleBook = Boolean(bookMeta?.articles);

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
    if (!state.chapterId) return;
    const ctrl = new AbortController();
    const load = isArticleBook ? api.getArticle : api.getChapter;
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
  }, [state.chapterId, state.bookId, isArticleBook, state.pendingSection, state.pendingParagraph]);

  const paragraph = findParagraph(chapter, state.activeParagraph) || getFirstParagraph(chapter);
  const activeSection = findSectionForParagraph(chapter, paragraph?.id);
  const periodId = activeSection?.period || chapter?.period || null;
  const currentYear = activeSection?.year || chapter?.year;
  const currentTimelineItem = activeSection?.id || state.chapterId;
  const mapChapter = chapter ? { ...chapter, paragraphs: getAllParagraphs(chapter) } : null;

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
    dragRef.current = { startX: e.clientX, startRatio: state.splitRatio, w: window.innerWidth };
    document.body.style.cursor = 'col-resize';
  };
  useEffect(() => {
    const move = (e) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      dispatch({ type: 'setSplit', value: dragRef.current.startRatio + dx / dragRef.current.w });
    };
    const stop = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
    window.addEventListener('blur', stop);
    document.addEventListener('mouseleave', stop);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('blur', stop);
      document.removeEventListener('mouseleave', stop);
    };
  }, []);

  if (error) {
    return <div style={{ padding: 40, fontFamily: 'var(--font-serif)' }}>
      <h2>无法加载数据</h2>
      <p>{error}</p>
      <p style={{ fontSize: 13, color: '#6B5F4E' }}>若是本地开发，请先在 <code>app/</code> 目录下执行 <code>npm run build:data</code> 生成静态数据。</p>
    </div>;
  }

  if (!bookMeta) return <div className="loading">加载中…</div>;

  // Books picker shows all available books from the backend; the active book's
  // chapter list comes from bookMeta (which is bookId-specific).
  const books = allBooks.length
    ? allBooks.map(b => ({
        ...b,
        chapters: b.id === bookMeta.id ? (bookMeta.chapters || bookMeta.articles || []) : [],
        itemKind: b.id === bookMeta.id && bookMeta.articles ? 'article' : 'chapter',
      }))
    : [{ id: bookMeta.id, title: bookMeta.title, dynasty: bookMeta.dynasty, chapters: readingItems, itemKind: isArticleBook ? 'article' : 'chapter' }];

  const auth = {
    user: authUser,
    login: async (email, password) => {
      const result = await authClient.login(email, password);
      setAuthUser(result.user);
      return result;
    },
    register: (email, password) => authClient.register(email, password),
    logout: () => {
      authClient.logout();
      setAuthUser(null);
      setAdminOpen(false);
    },
    openAdmin: () => setAdminOpen(true),
  };

  const adminClient = createAdminClient({
    getToken: authClient.getToken,
  });

  return (
    <ErrorBoundary>
      <div className="app">
        <TopNav state={state} dispatch={dispatch} books={books} auth={auth} />
        {adminOpen && authUser?.role === 'admin' && (
          <AdminPanel
            adminClient={adminClient}
            onClose={() => setAdminOpen(false)}
            onChanged={() => setDataVersion(version => version + 1)}
          />
        )}
        <div className="splitpane" style={{ '--split': `${state.splitRatio * 100}%` }}>
          <div className="splitpane__left">
            <ErrorBoundary label="阅读器渲染错误">
              <ReaderPane chapter={chapter} state={{ ...state, bookTitle: bookMeta.title, dynasty: bookMeta.dynasty }} dispatch={dispatch} />
            </ErrorBoundary>
          </div>
          <div className="splitpane__gutter" onMouseDown={onSplitDown} />
          <div className="splitpane__right">
            <ErrorBoundary label="地图渲染错误">
              <MapPane paragraph={paragraph} state={state} dispatch={dispatch} chapter={mapChapter} period={period} />
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
  if (doc.paragraphs) return doc.paragraphs;
  return (doc.sections || []).flatMap(section => section.paragraphs || []);
}

function getFirstParagraph(doc) {
  return getAllParagraphs(doc)[0] || null;
}

function findParagraph(doc, paragraphId) {
  if (!doc || !paragraphId) return null;
  return getAllParagraphs(doc).find(p => p.id === paragraphId) || null;
}

function findSection(doc, sectionId) {
  if (!doc?.sections || !sectionId) return null;
  return doc.sections.find(section => section.id === sectionId) || null;
}

function findSectionForParagraph(doc, paragraphId) {
  if (!doc?.sections || !paragraphId) return null;
  return doc.sections.find(section => (section.paragraphs || []).some(p => p.id === paragraphId)) || null;
}
