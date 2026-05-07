/* ReaderPane.jsx — left side. Renders chapter title, paragraphs with entity tagging,
   responds to active-paragraph / text-mode / vertical toggle. */

const ReaderPane = ({ chapter, state, dispatch }) => {
  const containerRef = React.useRef(null);

  // Scroll the active paragraph into view when changed externally
  React.useEffect(() => {
    const el = containerRef.current?.querySelector(`[data-pid="${state.activeParagraph}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state.activeParagraph]);

  if (!chapter) return <div className="reader reader--empty">选择一篇章以开始阅读</div>;

  return (
    <div className={"reader" + (state.vertical ? " reader--vert" : "")}>
      <div className="reader__head">
        <div className="reader__crumb">《{state.bookTitle}》· {state.dynasty}</div>
        <h1 className="reader__title">{chapter.title}</h1>
        <div className="reader__sub">{chapter.subtitle} · {formatYear(chapter.year)}</div>
        <img className="reader__rule" src="../../assets/yun-rule.svg" alt="" />
      </div>
      <div ref={containerRef} className="reader__body">
        {chapter.paragraphs.map((p, i) => (
          <Paragraph key={p.id} idx={i} para={p} state={state} dispatch={dispatch} />
        ))}
        <div className="reader__endseal">
          <img src="../../assets/seal-du.svg" alt="读" />
        </div>
      </div>
    </div>
  );
};

const formatYear = (y) => y < 0 ? `公元前 ${-y} 年` : `公元 ${y} 年`;

const Paragraph = ({ idx, para, state, dispatch }) => {
  const isActive = state.activeParagraph === para.id;
  const onClick = () => dispatch({ type: "set", key: "activeParagraph", value: para.id });
  const showOriginal = state.textMode === "original" || state.textMode === "both";
  const showTranslation = state.textMode === "translation" || state.textMode === "both";

  return (
    <div className={"para" + (isActive ? " is-active" : "")} data-pid={para.id} onClick={onClick}>
      <div className="para__num">{(idx + 1).toString().padStart(2, "0")}</div>
      {showOriginal && (
        <p className="para__original">
          {renderWithEntities(para.original, para.entities, state, dispatch)}
        </p>
      )}
      {showTranslation && (
        <p className="para__translation">{para.translation}</p>
      )}
    </div>
  );
};

// Render text with entities highlighted. Entities are matched by `text` substring.
function renderWithEntities(text, entities, state, dispatch) {
  if (!entities || !entities.length) return text;
  // Build segment list by linear scan (longest-first to avoid substring shadowing)
  const sorted = [...entities].sort((a, b) => b.text.length - a.text.length);
  const matches = [];
  for (const e of sorted) {
    let from = 0;
    while (from < text.length) {
      const idx = text.indexOf(e.text, from);
      if (idx === -1) break;
      // skip if overlaps an existing match
      const overlaps = matches.some(m => idx < m.end && idx + e.text.length > m.start);
      if (!overlaps) matches.push({ start: idx, end: idx + e.text.length, ent: e });
      from = idx + e.text.length;
    }
  }
  matches.sort((a, b) => a.start - b.start);
  const out = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (cursor < m.start) out.push(text.slice(cursor, m.start));
    out.push(
      <span key={i} className={`ent ent-${m.ent.type}`}
        title={m.ent.description}
        onClick={(ev) => {
          ev.stopPropagation();
          if (m.ent.type === "place" && m.ent.lat) {
            dispatch({ type: "focusEntity", entity: m.ent });
          }
        }}>
        {text.slice(m.start, m.end)}
      </span>
    );
    cursor = m.end;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

window.ReaderPane = ReaderPane;
