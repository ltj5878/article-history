import { useMemo, useReducer, useEffect, useRef, useState } from 'react';
import TopNav from './components/TopNav';
import ReaderPane from './components/ReaderPane';
import MapPane from './components/MapPane';
import Timeline from './components/Timeline';
import ErrorBoundary from './components/ErrorBoundary';
import { api } from './api/client';

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

const initialState = {
  bookId: savedBookId || 'shiji',
  bookTitle: '史记',
  dynasty: '西汉',
  chapterId: null,
  activeParagraph: null,
  pendingSection: null,
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
    case 'selectBook':
      // Switch to a different book; clear current chapter so the load effect picks the first one
      return { ...state, bookId: action.id, chapterId: null, activeParagraph: null, pendingSection: null, selectedPlace: null };
    case 'selectChapter':
      return { ...state, chapterId: action.id, activeParagraph: null, pendingSection: null, selectedPlace: null };
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
          selectedPlace: null,
        };
      }
      if (action.event.article) {
        return {
          ...state,
          chapterId: action.event.article,
          pendingSection: action.event.section || null,
          activeParagraph: null,
          selectedPlace: null,
        };
      }
      return { ...state, chapterId: action.event.chapter, pendingSection: null, activeParagraph: null, selectedPlace: null };
    case 'setSplit':
      return { ...state, splitRatio: Math.max(0.25, Math.min(0.65, action.value)) };
    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
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
  }, []);

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
  }, [state.bookId]);

  const readingItems = useMemo(() => bookMeta?.articles || bookMeta?.chapters || [], [bookMeta]);
  const isArticleBook = Boolean(bookMeta?.articles);

  // Whenever bookMeta loads or chapter is null, ensure a reading item is selected.
  // Guard against stale bookMeta: only auto-select when bookMeta is for the
  // currently-active book (otherwise we'd pick a chapter from the previous book).
  useEffect(() => {
    if (bookMeta && bookMeta.id === state.bookId && !state.chapterId && readingItems[0]) {
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
        const firstParagraph = findSection(c, state.pendingSection)?.paragraphs?.[0] || getFirstParagraph(c);
        if (firstParagraph) {
          dispatch({ type: 'set', key: 'activeParagraph', value: firstParagraph.id });
        }
      })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => ctrl.abort();
  }, [state.chapterId, state.bookId, isArticleBook, state.pendingSection]);

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

  return (
    <ErrorBoundary>
      <div className="app">
        <TopNav state={state} dispatch={dispatch} books={books} />
        <div className="splitpane" style={{ '--split': `${state.splitRatio * 100}%` }}>
          <div className="splitpane__left">
            <ErrorBoundary>
              <ReaderPane chapter={chapter} state={{ ...state, bookTitle: bookMeta.title, dynasty: bookMeta.dynasty }} dispatch={dispatch} />
            </ErrorBoundary>
          </div>
          <div className="splitpane__gutter" onMouseDown={onSplitDown} />
          <div className="splitpane__right">
            <ErrorBoundary>
              <MapPane paragraph={paragraph} state={state} dispatch={dispatch} chapter={mapChapter} period={period} />
            </ErrorBoundary>
          </div>
        </div>
        <Timeline
          events={bookMeta.eraEvents || []}
          chapters={readingItems}
          currentChapter={currentTimelineItem}
          currentYear={currentYear}
          collapsed={state.timelineCollapsed}
          onToggleCollapsed={() => dispatch({ type: 'toggle', key: 'timelineCollapsed' })}
          onPick={(ev) => dispatch({ type: 'pickEra', event: ev })}
        />
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
