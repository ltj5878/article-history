import { useReducer, useEffect, useRef, useState } from 'react';
import TopNav from './components/TopNav';
import ReaderPane from './components/ReaderPane';
import MapPane from './components/MapPane';
import Timeline from './components/Timeline';
import ErrorBoundary from './components/ErrorBoundary';
import { api } from './api/client';

const initialState = {
  bookId: 'xiangyu',
  bookTitle: '项羽本纪',
  dynasty: '西汉',
  chapterId: null,
  activeParagraph: null,
  textMode: 'both',
  vertical: false,
  theme: 'classic',
  layers: { places: true, routes: true, territories: true, provinces: true },
  selectedPlace: null,
  splitRatio: 0.4,
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
      return { ...state, bookId: action.id, chapterId: null, activeParagraph: null, selectedPlace: null };
    case 'selectChapter':
      return { ...state, chapterId: action.id, activeParagraph: null, selectedPlace: null };
    case 'selectPlace':
    case 'focusEntity':
      return { ...state, selectedPlace: action.entity };
    case 'cycleTheme': {
      const order = ['classic', 'dark', 'bright'];
      return { ...state, theme: order[(order.indexOf(state.theme) + 1) % order.length] };
    }
    case 'pickEra':
      return { ...state, chapterId: action.event.chapter, activeParagraph: null, selectedPlace: null };
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

  // Load global book list once
  useEffect(() => {
    api.listBooks()
      .then(setAllBooks)
      .catch(e => setError(e.message));
  }, []);

  // Load book metadata + chapter list when bookId changes
  useEffect(() => {
    // Clear stale data so the picker / reader don't show the previous book
    setBookMeta(null);
    setChapter(null);
    setPeriod(null);
    api.getBook(state.bookId)
      .then(b => setBookMeta(b))
      .catch(e => setError(e.message));
  }, [state.bookId]);

  // Whenever bookMeta loads or chapter is null, ensure a chapter is selected.
  // Guard against stale bookMeta: only auto-select when bookMeta is for the
  // currently-active book (otherwise we'd pick a chapter from the previous book).
  useEffect(() => {
    if (bookMeta && bookMeta.id === state.bookId && !state.chapterId && bookMeta.chapters[0]) {
      dispatch({ type: 'selectChapter', id: bookMeta.chapters[0].id });
    }
  }, [bookMeta, state.bookId, state.chapterId]);

  // Load chapter content when chapterId changes
  useEffect(() => {
    if (!state.chapterId) return;
    api.getChapter(state.bookId, state.chapterId)
      .then(c => {
        setChapter(c);
        if (c.paragraphs?.[0]) {
          dispatch({ type: 'set', key: 'activeParagraph', value: c.paragraphs[0].id });
        }
        // Load period for this chapter
        if (c.period) {
          api.getPeriod(c.period).then(setPeriod).catch(e => setError(e.message));
        }
      })
      .catch(e => setError(e.message));
  }, [state.chapterId, state.bookId]);

  const paragraph = chapter?.paragraphs?.find(p => p.id === state.activeParagraph) || chapter?.paragraphs?.[0];

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
    const up = () => { dragRef.current = null; document.body.style.cursor = ''; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []);

  if (error) {
    return <div style={{ padding: 40, fontFamily: 'var(--font-serif)' }}>
      <h2>无法连接到后端</h2>
      <p>{error}</p>
      <p style={{ fontSize: 13, color: '#6B5F4E' }}>请确保后端服务运行在 http://localhost:4000 — 在 server/ 目录下执行 <code>node index.js</code></p>
    </div>;
  }

  if (!bookMeta) return <div className="loading">加载中…</div>;

  // Books picker shows all available books from the backend; the active book's
  // chapter list comes from bookMeta (which is bookId-specific).
  const books = allBooks.length
    ? allBooks.map(b => ({
        ...b,
        chapters: b.id === bookMeta.id ? bookMeta.chapters : [],
      }))
    : [{ id: bookMeta.id, title: bookMeta.title, dynasty: bookMeta.dynasty, chapters: bookMeta.chapters }];

  return (
    <div className="app">
      <TopNav state={state} dispatch={dispatch} books={books} />
      <div className="splitpane" style={{ '--split': `${state.splitRatio * 100}%` }}>
        <div className="splitpane__left">
          <ReaderPane chapter={chapter} state={{ ...state, bookTitle: bookMeta.title, dynasty: bookMeta.dynasty }} dispatch={dispatch} />
        </div>
        <div className="splitpane__gutter" onMouseDown={onSplitDown} />
        <div className="splitpane__right">
          <ErrorBoundary>
            <MapPane paragraph={paragraph} state={state} dispatch={dispatch} chapter={chapter} period={period} />
          </ErrorBoundary>
        </div>
      </div>
      <Timeline
        events={bookMeta.eraEvents || []}
        chapters={bookMeta.chapters || []}
        currentChapter={state.chapterId}
        currentYear={chapter?.year}
        onPick={(ev) => dispatch({ type: 'pickEra', event: ev })}
      />
    </div>
  );
}
