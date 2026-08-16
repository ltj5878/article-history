import { useState, useEffect, useId, useRef } from 'react';
import AuthControl from './AuthControl';
import BookmarksMenu from './BookmarksMenu';
import SearchMenu from './SearchMenu';

export default function TopNav({ state, dispatch, books, auth, catalogVersion = 0 }) {
  const book = books.find(b => b.id === state.bookId);
  const chapter = book?.chapters.find(c => c.id === state.chapterId);
  const itemKind = chapter?.kind === 'article' ? '文章' : chapter?.kind === 'chapter' ? '篇章' : (book?.itemKind === 'article' ? '文章' : '篇章');
  const [toolsOpen, setToolsOpen] = useState(false);
  const navRef = useRef(null);
  const toolsId = useId();

  useEffect(() => {
    if (!toolsOpen) return;
    const onDoc = event => {
      if (navRef.current && !navRef.current.contains(event.target)) setToolsOpen(false);
    };
    const onKey = event => {
      if (event.key === 'Escape') setToolsOpen(false);
    };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [toolsOpen]);

  return (
    <nav className="topnav" aria-label="阅读工具栏" ref={navRef}>
      <div className="topnav__brand">
        <img src="/assets/seal-square.svg" alt="" width="28" height="28" />
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
        label={chapter ? chapter.title : `选择${itemKind}`}
        icon="chapter"
        items={book?.chapters.map(c => ({ id: c.id, label: c.title, sub: c.subtitle })) || []}
        selected={state.chapterId}
        onSelect={id => dispatch({ type: "selectChapter", id })}
      />

      <div className="topnav__spacer" />

      <button
        type="button"
        className="topnav__more iconbtn"
        aria-expanded={toolsOpen}
        aria-controls={toolsId}
        aria-label={toolsOpen ? '收起阅读工具' : '展开阅读工具'}
        onClick={() => setToolsOpen(open => !open)}
      >
        <span aria-hidden="true">•••</span>
      </button>

      <div id={toolsId} className={`topnav__tools${toolsOpen ? ' is-open' : ''}`}>
        <Segmented
          value={state.textMode}
          onChange={v => dispatch({ type: "set", key: "textMode", value: v })}
          options={[
            { value: "original", label: "原文" },
            { value: "translation", label: "译文" },
            { value: "both", label: "对照" },
          ]}
        />

        <IconBtn
          icon={state.vertical ? "vertical" : "horizontal"}
          title={state.vertical ? "竖排" : "横排"}
          ariaLabel={`切换为${state.vertical ? '横排' : '竖排'}，当前为${state.vertical ? '竖排' : '横排'}`}
          onClick={() => dispatch({ type: "toggle", key: "vertical" })}
        />

        <div className="topnav__divider topnav__divider--vert" />

        <LayerBtn active={state.layers.places} icon="layer-place" label="地名"
          onClick={() => dispatch({ type: "toggleLayer", layer: "places" })} />
        <LayerBtn active={state.layers.routes} icon="layer-route" label="路线"
          onClick={() => dispatch({ type: "toggleLayer", layer: "routes" })} />
        <LayerBtn active={state.layers.territories} icon="layer-territory" label="势力"
          onClick={() => dispatch({ type: "toggleLayer", layer: "territories" })} />
        <LayerBtn active={state.layers.provinces} icon="layer-territory" label="今省"
          onClick={() => dispatch({ type: "toggleLayer", layer: "provinces" })} />

        <div className="topnav__divider topnav__divider--vert" />

        <SearchMenu dispatch={dispatch} catalogVersion={catalogVersion} />
        <BookmarksMenu dispatch={dispatch} />

        <IconBtn
          icon={`theme-${state.theme}`}
          title="主题"
          ariaLabel={`切换主题，当前为${themeLabel(state.theme)}`}
          onClick={() => dispatch({ type: "cycleTheme" })}
        />

        <div className="topnav__divider topnav__divider--vert" />
        <AuthControl auth={auth} />
      </div>
    </nav>
  );
}

function Picker({ label, icon, items, selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const menuId = useId();
  // Close on click outside — but only register the listener while open,
  // so the very click that opens us isn't seen as "outside" by stale listeners.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    // Use click (after React onClick) instead of mousedown — avoids the race
    // where mousedown fires before React's synthetic onClick toggles open.
    document.addEventListener('click', onDoc);
    const onKey = event => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleSelect = (id) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <div className="picker" ref={ref}>
      <button
        type="button"
        className="picker__btn"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
      >
        <img className="ic" src={`/assets/icons/${icon}.svg`} alt="" />
        <span>{label}</span>
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 3l4 4 4-4" stroke="currentColor" fill="none" strokeWidth="1.3"/></svg>
      </button>
      {open && items.length > 0 && (
        <div id={menuId} className="picker__menu" role="listbox" onClick={(e) => e.stopPropagation()}>
          {items.map(it => (
            <button
              type="button"
              role="option"
              aria-selected={it.id === selected}
              key={it.id}
              className={"picker__item" + (it.id === selected ? " is-active" : "")}
              onClick={() => handleSelect(it.id)}
            >
              <span className="picker__item-label">{it.label}</span>
              {it.sub && <span className="picker__item-sub">{it.sub}</span>}
            </button>
          ))}
        </div>
      )}
      {open && items.length === 0 && (
        <div id={menuId} className="picker__menu picker__menu--empty" role="status">
          <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--fg-3)' }}>暂无可选项</div>
        </div>
      )}
    </div>
  );
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="seg" aria-label="文字显示模式">
      {options.map(o => (
        <button key={o.value} type="button" aria-pressed={value === o.value} className={"seg__btn" + (value === o.value ? " is-active" : "")}
          onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

function IconBtn({ icon, title, ariaLabel = title, onClick }) {
  return (
    <button type="button" className="iconbtn" title={title} aria-label={ariaLabel} onClick={onClick}>
      <img src={`/assets/icons/${icon}.svg`} alt="" />
    </button>
  );
}

function LayerBtn({ active, icon, label, onClick }) {
  return (
    <button type="button" aria-pressed={active} className={"layerbtn" + (active ? " is-on" : "")} onClick={onClick}>
      <img src={`/assets/icons/${icon}.svg`} alt="" />
      <span>{label}</span>
    </button>
  );
}

function themeLabel(theme) {
  return theme === 'dark' ? '暗色' : theme === 'bright' ? '明亮' : '古风';
}
