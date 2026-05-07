/* TopNav.jsx — top bar: book picker, chapter, layer toggles, mode switches, theme */

const TopNav = ({ state, dispatch, books }) => {
  const book = books.find(b => b.id === state.bookId);
  const chapter = book?.chapters.find(c => c.id === state.chapterId);

  return (
    <div className="topnav">
      <div className="topnav__brand">
        <img src="../../assets/seal-square.svg" alt="" width="28" height="28" />
        <div className="topnav__title">经史舆图</div>
      </div>

      <div className="topnav__divider" />

      <Picker
        label={book ? `《${book.title}》· ${book.dynasty}` : "选择书籍"}
        icon="book"
        items={books.map(b => ({ id: b.id, label: `《${b.title}》`, sub: b.dynasty }))}
        selected={state.bookId}
        onSelect={id => dispatch({ type: "selectBook", id })}
      />

      <Picker
        label={chapter ? chapter.title : "选择篇章"}
        icon="chapter"
        items={book?.chapters.map(c => ({ id: c.id, label: c.title, sub: c.subtitle })) || []}
        selected={state.chapterId}
        onSelect={id => dispatch({ type: "selectChapter", id })}
      />

      <div className="topnav__spacer" />

      {/* Reading mode segmented */}
      <Segmented
        value={state.textMode}
        onChange={v => dispatch({ type: "set", key: "textMode", value: v })}
        options={[
          { value: "original", label: "原文" },
          { value: "translation", label: "译文" },
          { value: "both", label: "对照" },
        ]}
      />

      {/* Direction */}
      <IconBtn
        icon={state.vertical ? "vertical" : "horizontal"}
        title={state.vertical ? "竖排" : "横排"}
        onClick={() => dispatch({ type: "toggle", key: "vertical" })}
      />

      <div className="topnav__divider topnav__divider--vert" />

      {/* Layers */}
      <LayerBtn active={state.layers.places} icon="layer-place" label="地名"
        onClick={() => dispatch({ type: "toggleLayer", layer: "places" })} />
      <LayerBtn active={state.layers.routes} icon="layer-route" label="路线"
        onClick={() => dispatch({ type: "toggleLayer", layer: "routes" })} />
      <LayerBtn active={state.layers.territories} icon="layer-territory" label="势力"
        onClick={() => dispatch({ type: "toggleLayer", layer: "territories" })} />

      <div className="topnav__divider topnav__divider--vert" />

      {/* Theme */}
      <IconBtn icon={`theme-${state.theme === "classic" ? "classic" : state.theme === "dark" ? "dark" : "bright"}`}
        title="主题"
        onClick={() => dispatch({ type: "cycleTheme" })} />
    </div>
  );
};

const Picker = ({ label, icon, items, selected, onSelect }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <div className="picker" ref={ref}>
      <button className="picker__btn" onClick={() => setOpen(o => !o)}>
        <img className="ic" src={`../../assets/icons/${icon}.svg`} />
        <span>{label}</span>
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 3l4 4 4-4" stroke="currentColor" fill="none" strokeWidth="1.3"/></svg>
      </button>
      {open && (
        <div className="picker__menu">
          {items.map(it => (
            <button key={it.id} className={"picker__item" + (it.id === selected ? " is-active" : "")}
              onClick={() => { onSelect(it.id); setOpen(false); }}>
              <span className="picker__item-label">{it.label}</span>
              {it.sub && <span className="picker__item-sub">{it.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const Segmented = ({ value, onChange, options }) => (
  <div className="seg">
    {options.map(o => (
      <button key={o.value} className={"seg__btn" + (value === o.value ? " is-active" : "")}
        onClick={() => onChange(o.value)}>{o.label}</button>
    ))}
  </div>
);

const IconBtn = ({ icon, title, onClick }) => (
  <button className="iconbtn" title={title} onClick={onClick}>
    <img src={`../../assets/icons/${icon}.svg`} />
  </button>
);

const LayerBtn = ({ active, icon, label, onClick }) => (
  <button className={"layerbtn" + (active ? " is-on" : "")} onClick={onClick}>
    <img src={`../../assets/icons/${icon}.svg`} />
    <span>{label}</span>
  </button>
);

window.TopNav = TopNav;
