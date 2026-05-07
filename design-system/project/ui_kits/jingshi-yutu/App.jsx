/* Main JingShiYuTu app — orchestrates state across TopNav, ReaderPane, MapPane, Timeline */

const initialState = {
  bookId: "zuozhuan",
  bookTitle: "左传",
  dynasty: "春秋",
  chapterId: "chengpu",
  activeParagraph: "p1",
  textMode: "both",       // original | translation | both
  vertical: false,
  theme: "classic",       // classic | dark | bright
  layers: { places: true, routes: true, territories: true },
  selectedPlace: null,
  splitRatio: 0.4,
};

function reducer(state, action) {
  const data = window.JSY_DATA;
  switch (action.type) {
    case "set":
      return { ...state, [action.key]: action.value };
    case "toggle":
      return { ...state, [action.key]: !state[action.key] };
    case "toggleLayer":
      return { ...state, layers: { ...state.layers, [action.layer]: !state.layers[action.layer] } };
    case "selectBook": {
      const book = data.books.find(b => b.id === action.id);
      const ch = book?.chapters[0];
      return { ...state, bookId: action.id, bookTitle: book?.title, dynasty: book?.dynasty,
        chapterId: ch?.id, activeParagraph: ch?.paragraphs[0]?.id, selectedPlace: null };
    }
    case "selectChapter": {
      const book = data.books.find(b => b.id === state.bookId);
      const ch = book?.chapters.find(c => c.id === action.id);
      return { ...state, chapterId: action.id, activeParagraph: ch?.paragraphs[0]?.id, selectedPlace: null };
    }
    case "selectPlace":
      return { ...state, selectedPlace: action.entity };
    case "focusEntity":
      return { ...state, selectedPlace: action.entity };
    case "cycleTheme": {
      const order = ["classic", "dark", "bright"];
      const next = order[(order.indexOf(state.theme) + 1) % order.length];
      return { ...state, theme: next };
    }
    case "pickEra": {
      // Find chapter whose year matches; switch to it
      const ev = action.event;
      for (const b of data.books) {
        for (const c of b.chapters) {
          if (c.id === ev.chapter) {
            return { ...state, bookId: b.id, bookTitle: b.title, dynasty: b.dynasty,
              chapterId: c.id, activeParagraph: c.paragraphs[0]?.id, selectedPlace: null };
          }
        }
      }
      return state;
    }
    case "setSplit":
      return { ...state, splitRatio: Math.max(0.25, Math.min(0.65, action.value)) };
    default:
      return state;
  }
}

const App = () => {
  const data = window.JSY_DATA;
  const [state, dispatch] = React.useReducer(reducer, initialState);

  // Sync theme on root
  React.useEffect(() => {
    const t = state.theme === "classic" ? "" : state.theme;
    if (t) document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }, [state.theme]);

  const book = data.books.find(b => b.id === state.bookId);
  const chapter = book?.chapters.find(c => c.id === state.chapterId);
  const paragraph = chapter?.paragraphs.find(p => p.id === state.activeParagraph) || chapter?.paragraphs[0];

  // Drag handle for split
  const dragRef = React.useRef(null);
  const onSplitDown = (e) => { dragRef.current = { startX: e.clientX, startRatio: state.splitRatio, w: window.innerWidth }; document.body.style.cursor = "col-resize"; };
  React.useEffect(() => {
    const move = (e) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      dispatch({ type: "setSplit", value: dragRef.current.startRatio + dx / dragRef.current.w });
    };
    const up = () => { dragRef.current = null; document.body.style.cursor = ""; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);

  return (
    <div className="app">
      <TopNav state={state} dispatch={dispatch} books={data.books} />
      <div className="splitpane" style={{ "--split": `${state.splitRatio * 100}%` }}>
        <div className="splitpane__left">
          <ReaderPane chapter={chapter} state={{...state, bookTitle: book?.title, dynasty: book?.dynasty}} dispatch={dispatch} />
        </div>
        <div className="splitpane__gutter" onMouseDown={onSplitDown} />
        <div className="splitpane__right">
          <MapPane paragraph={paragraph} state={state} dispatch={dispatch} chapter={chapter} />
        </div>
      </div>
      <Timeline events={data.eraEvents} currentYear={chapter?.year} onPick={(ev) => dispatch({ type: "pickEra", event: ev })} />
    </div>
  );
};

window.JSYApp = App;
