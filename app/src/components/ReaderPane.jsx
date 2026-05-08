import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

export default function ReaderPane({ chapter, state, dispatch }) {
  const containerRef = useRef(null);
  const [popover, setPopover] = useState(null);  // { entity, x, y } | null

  useEffect(() => {
    if (state.activeParagraph === getFirstParagraphId(chapter)) return;
    const el = containerRef.current?.querySelector(`[data-pid="${state.activeParagraph}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state.activeParagraph, chapter]);

  // Close popover when clicking outside or pressing Esc
  useEffect(() => {
    if (!popover) return;
    const onDoc = (e) => {
      if (e.target.closest('.ent-popover') || e.target.closest('.ent')) return;
      setPopover(null);
    };
    const onKey = (e) => { if (e.key === 'Escape') setPopover(null); };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [popover]);

  // Close popover on chapter/paragraph change
  useEffect(() => { setPopover(null); }, [state.activeParagraph, chapter?.id]);

  // Close popover when the reader body scrolls — its anchor would otherwise drift
  useEffect(() => {
    if (!popover) return;
    const body = containerRef.current;
    if (!body) return;
    const onScroll = () => setPopover(null);
    body.addEventListener('scroll', onScroll, { passive: true });
    return () => body.removeEventListener('scroll', onScroll);
  }, [popover]);

  const onEntityClick = useCallback((entity, ev) => {
    ev.stopPropagation();
    if (entity.type === 'place' && entity.lat) {
      // Places open the InfoCard on the map
      dispatch({ type: 'focusEntity', entity });
      setPopover(null);
      return;
    }
    // Person & event: open inline popover anchored next to the click
    const target = ev.currentTarget;
    const rect = target.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    setPopover({
      entity,
      // Position relative to the .reader__body container so popover scrolls with content
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.bottom - containerRect.top + 6,
    });
  }, [dispatch]);

  if (!chapter) return <div className="reader reader--empty">选择一篇章以开始阅读</div>;

  return (
    <div className={"reader" + (state.vertical ? " reader--vert" : "")}>
      <div className="reader__head">
        <div className="reader__crumb">《{state.bookTitle}》· {state.dynasty}</div>
        <h1 className="reader__title">{chapter.title}</h1>
        <div className="reader__sub">{formatSubtitle(chapter)}</div>
        <img className="reader__rule" src="/assets/yun-rule.svg" alt="" />
      </div>
      <div ref={containerRef} className="reader__body">
        {chapter.sections
          ? chapter.sections.map(section => (
              <ArticleSection
                key={section.id}
                section={section}
                state={state}
                dispatch={dispatch}
                onEntityClick={onEntityClick}
              />
            ))
          : chapter.paragraphs.map((p, i) => (
              <Paragraph key={p.id} idx={i} para={p} state={state} dispatch={dispatch} onEntityClick={onEntityClick} />
            ))}
        <div className="reader__endseal">
          <img src="/assets/seal-du.svg" alt="读" />
        </div>
        {popover && (
          <EntityPopover
            entity={popover.entity}
            x={popover.x}
            y={popover.y}
            onClose={() => setPopover(null)}
          />
        )}
      </div>
    </div>
  );
}

function formatSubtitle(chapter) {
  const parts = [chapter.subtitle];
  if (typeof chapter.year === 'number') parts.push(formatYear(chapter.year));
  return parts.filter(Boolean).join(' · ');
}

function getFirstParagraphId(chapter) {
  if (!chapter) return null;
  if (chapter.paragraphs?.[0]) return chapter.paragraphs[0].id;
  return chapter.sections?.find(section => section.paragraphs?.[0])?.paragraphs?.[0]?.id || null;
}

function formatYear(y) {
  return y < 0 ? `公元前 ${-y} 年` : `公元 ${y} 年`;
}

function ArticleSection({ section, state, dispatch, onEntityClick }) {
  const firstParagraph = section.paragraphs?.[0];
  const isActive = Boolean(firstParagraph && section.paragraphs?.some(p => p.id === state.activeParagraph));

  return (
    <section className="reader-section">
      <button
        type="button"
        className={"reader-section__head" + (isActive ? " is-active" : "")}
        onClick={() => {
          if (firstParagraph) dispatch({ type: "set", key: "activeParagraph", value: firstParagraph.id });
        }}
      >
        <span className="reader-section__title">{section.title}</span>
        <span className="reader-section__sub">
          {[section.subtitle, typeof section.year === 'number' ? formatYear(section.year) : null].filter(Boolean).join(' · ')}
        </span>
      </button>
      <div className="reader-section__body">
        {(section.paragraphs || []).map((p, i) => (
          <Paragraph key={p.id} idx={i} para={p} state={state} dispatch={dispatch} onEntityClick={onEntityClick} />
        ))}
      </div>
    </section>
  );
}

function Paragraph({ idx, para, state, dispatch, onEntityClick }) {
  const isActive = state.activeParagraph === para.id;
  const onClick = () => dispatch({ type: "set", key: "activeParagraph", value: para.id });
  const showOriginal = state.textMode === "original" || state.textMode === "both";
  const showTranslation = state.textMode === "translation" || state.textMode === "both";

  return (
    <div className={"para" + (isActive ? " is-active" : "")} data-pid={para.id} onClick={onClick}>
      <div className="para__num">{(idx + 1).toString().padStart(2, "0")}</div>
      {showOriginal && (
        <p className="para__original">
          <ParagraphOriginal text={para.original} entities={para.entities} onEntityClick={onEntityClick} />
        </p>
      )}
      {showTranslation && para.translation && (
        <p className="para__translation">{para.translation}</p>
      )}
    </div>
  );
}

function ParagraphOriginal({ text, entities, onEntityClick }) {
  const matches = useMemo(() => computeEntityMatches(text, entities), [text, entities]);
  if (!matches.length) return text;
  const out = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (cursor < m.start) out.push(text.slice(cursor, m.start));
    out.push(
      <span key={i} className={`ent ent-${m.ent.type}`}
        title={m.ent.description}
        onClick={(ev) => onEntityClick(m.ent, ev)}>
        {text.slice(m.start, m.end)}
      </span>
    );
    cursor = m.end;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

function computeEntityMatches(text, entities) {
  if (!entities || !entities.length) return [];
  const sorted = [...entities].sort((a, b) => b.text.length - a.text.length);
  const matches = [];
  for (const e of sorted) {
    let from = 0;
    while (from < text.length) {
      const idx = text.indexOf(e.text, from);
      if (idx === -1) break;
      const overlaps = matches.some(m => idx < m.end && idx + e.text.length > m.start);
      if (!overlaps) matches.push({ start: idx, end: idx + e.text.length, ent: e });
      from = idx + e.text.length;
    }
  }
  matches.sort((a, b) => a.start - b.start);
  return matches;
}

// === Inline popover for person/event entities ===
function EntityPopover({ entity, x, y, onClose }) {
  const ref = useRef(null);
  const [adjusted, setAdjusted] = useState({ x, y, flipUp: false });

  // After render, adjust to keep within viewport (popover is positioned within
  // the .reader__body container which scrolls; use absolute viewport coords)
  useEffect(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const parent = ref.current.offsetParent?.getBoundingClientRect() || { left: 0, top: 0, right: window.innerWidth };
    const parentW = parent.right - parent.left;

    let nx = x;
    let ny = y;
    let flipUp = false;

    // Horizontal: keep within parent left/right
    if (x + r.width / 2 > parentW - 16) nx = parentW - r.width / 2 - 16;
    if (x - r.width / 2 < 16) nx = r.width / 2 + 16;

    // Vertical: r.bottom/r.top are absolute viewport coords, compare to window
    if (r.bottom + 12 > window.innerHeight) {
      // Popover overflows bottom — flip up. Adjust ny: original y was the click's
      // bottom position relative to the parent; we now need ny = (click top) - height
      flipUp = true;
      ny = y - r.height - 30;  // 30 ~ span line-height + arrow gap
    }
    setAdjusted({ x: nx, y: ny, flipUp });
  }, [x, y]);

  const typeLabel = entity.type === 'person' ? '人物' : '事件';
  const typeColor = entity.type === 'person' ? 'var(--e-person)' : 'var(--e-event)';

  return (
    <div
      ref={ref}
      className={`ent-popover ent-popover--${entity.type}` + (adjusted.flipUp ? ' is-flipped' : '')}
      style={{
        left: adjusted.x,
        top: adjusted.y,
        '--accent': typeColor,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button className="ent-popover__close" onClick={onClose} aria-label="关闭">
        <img src="/assets/icons/close.svg" alt="" />
      </button>
      <div className="ent-popover__type">{typeLabel}</div>
      <div className="ent-popover__name">{entity.text}</div>
      {entity.description && (
        <div className="ent-popover__desc">{entity.description}</div>
      )}
    </div>
  );
}
