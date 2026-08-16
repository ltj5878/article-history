import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { isBookmarked, addBookmark, removeBookmark } from '../utils/storage';

export default function ReaderPane({ chapter, state, dispatch }) {
  const containerRef = useRef(null);
  const [popover, setPopover] = useState(null);  // { entity, x, y } | null
  const popoverContext = `${chapter?.id || 'none'}:${state.activeParagraph || 'none'}`;
  const activePopover = popover?.context === popoverContext ? popover : null;

  useEffect(() => {
    if (state.activeParagraph === getFirstParagraphId(chapter)) return;
    const el = Array.from(containerRef.current?.querySelectorAll('[data-pid]') || [])
      .find(node => node.dataset.pid === state.activeParagraph);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state.activeParagraph, chapter]);

  // Stop any in-flight speech when chapter changes or component unmounts
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [chapter?.id]);

  // Close popover when clicking outside or pressing Esc
  useEffect(() => {
    if (!activePopover) return;
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
  }, [activePopover]);

  // Close popover when the reader body scrolls — its anchor would otherwise drift
  useEffect(() => {
    if (!activePopover) return;
    const body = containerRef.current;
    if (!body) return;
    const onScroll = () => setPopover(null);
    body.addEventListener('scroll', onScroll, { passive: true });
    return () => body.removeEventListener('scroll', onScroll);
  }, [activePopover]);

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
      context: popoverContext,
    });
  }, [dispatch, popoverContext]);

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
        {Array.isArray(chapter.sections)
          ? chapter.sections.map(section => (
              <ArticleSection
                key={section.id}
                section={section}
                chapter={chapter}
                state={state}
                dispatch={dispatch}
                onEntityClick={onEntityClick}
              />
            ))
          : (chapter.paragraphs || []).map((p, i) => (
              <Paragraph key={p.id} idx={i} para={p} chapter={chapter} state={state} dispatch={dispatch} onEntityClick={onEntityClick} />
            ))}
        <div className="reader__endseal">
          <img src="/assets/seal-du.svg" alt="读" />
        </div>
        {activePopover && (
          <EntityPopover
            entity={activePopover.entity}
            x={activePopover.x}
            y={activePopover.y}
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
  if (Array.isArray(chapter.paragraphs) && chapter.paragraphs[0]) return chapter.paragraphs[0].id;
  const sections = Array.isArray(chapter.sections) ? chapter.sections : [];
  return sections.find(section => Array.isArray(section?.paragraphs) && section.paragraphs[0])?.paragraphs?.[0]?.id || null;
}

function formatYear(y) {
  return y < 0 ? `公元前 ${-y} 年` : `公元 ${y} 年`;
}

function ArticleSection({ section, chapter, state, dispatch, onEntityClick }) {
  const paragraphs = Array.isArray(section?.paragraphs) ? section.paragraphs : [];
  const firstParagraph = paragraphs[0];
  const isActive = Boolean(firstParagraph && paragraphs.some(p => p.id === state.activeParagraph));

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
        {paragraphs.map((p, i) => (
          <Paragraph key={p.id} idx={i} para={p} chapter={chapter} state={state} dispatch={dispatch} onEntityClick={onEntityClick} />
        ))}
      </div>
    </section>
  );
}

function Paragraph({ idx, para, state, dispatch, onEntityClick, chapter }) {
  const isActive = state.activeParagraph === para.id;
  const onClick = () => dispatch({ type: "set", key: "activeParagraph", value: para.id });
  const showOriginal = state.textMode === "original" || state.textMode === "both";
  const showTranslation = state.textMode === "translation" || state.textMode === "both";

  const [bookmarked, setBookmarked] = useState(() =>
    isBookmarked(state.bookId, chapter?.id, para.id)
  );
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const refresh = () => setBookmarked(isBookmarked(state.bookId, chapter?.id, para.id));
    refresh();
    window.addEventListener('jingshi:bookmarks-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('jingshi:bookmarks-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [state.bookId, chapter?.id, para.id]);

  const toggleBookmark = (e) => {
    e.stopPropagation();
    if (bookmarked) {
      removeBookmark(state.bookId, chapter?.id, para.id);
      setBookmarked(false);
    } else {
      const snippet = (para.original || para.translation || '').slice(0, 40);
      addBookmark({
        bookId: state.bookId,
        bookTitle: state.bookTitle,
        chapterId: chapter?.id,
        chapterTitle: chapter?.title || '',
        paragraphId: para.id,
        snippet,
      });
      setBookmarked(true);
    }
    window.dispatchEvent(new Event('jingshi:bookmarks-changed'));
  };

  const toggleSpeak = (e) => {
    e.stopPropagation();
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    synth.cancel();
    const text = [para.original, para.translation].filter(Boolean).join('。');
    if (!text) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'zh-CN';
    utter.rate = 0.9;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    synth.speak(utter);
    setSpeaking(true);
  };

  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  return (
    <article className={"para" + (isActive ? " is-active" : "")} data-pid={para.id} onClick={onClick}>
      <button
        type="button"
        className="para__num"
        aria-label={`选择第 ${idx + 1} 段并联动地图`}
        aria-pressed={isActive}
        onClick={event => {
          event.stopPropagation();
          onClick();
        }}
      >
        {(idx + 1).toString().padStart(2, "0")}
      </button>
      <div className="para__tools" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={"para__tool" + (bookmarked ? " is-on" : "")}
          onClick={toggleBookmark}
          title={bookmarked ? '取消收藏' : '收藏此段'}
          aria-label="收藏"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
            <path d="M8 1.8l1.9 3.85 4.25.62-3.07 3 .73 4.23L8 11.5l-3.81 2 .73-4.23-3.07-3 4.25-.62L8 1.8z"/>
          </svg>
        </button>
        {ttsSupported && (
          <button
            type="button"
            className={"para__tool" + (speaking ? " is-on" : "")}
            onClick={toggleSpeak}
            title={speaking ? '停止朗读' : '朗读此段'}
            aria-label="朗读"
          >
            {speaking ? (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="4" width="3" height="8"/><rect x="9" y="4" width="3" height="8"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"><path d="M3 6v4h2.5L9 12.5v-9L5.5 6H3z" fill="currentColor"/><path d="M11 5.5c1 .8 1 4.2 0 5"/><path d="M12.5 4c1.8 1.4 1.8 6.6 0 8"/></svg>
            )}
          </button>
        )}
      </div>
      {showOriginal && (
        <p className="para__original">
          <ParagraphOriginal text={para.original} entities={para.entities} onEntityClick={onEntityClick} />
        </p>
      )}
      {showTranslation && para.translation && (
        <p className="para__translation">{para.translation}</p>
      )}
    </article>
  );
}

function ParagraphOriginal({ text, entities, onEntityClick }) {
  const matches = useMemo(() => computeEntityMatches(String(text ?? ''), entities), [text, entities]);
  if (!matches.length) return text;
  const out = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (cursor < m.start) out.push(text.slice(cursor, m.start));
    out.push(
      <button type="button" key={i} className={`ent ent-${m.ent.type}`}
        title={m.ent.description}
        aria-label={`${text.slice(m.start, m.end)}${m.ent.description ? `：${m.ent.description}` : ''}`}
        onClick={(ev) => onEntityClick(m.ent, ev)}>
        {text.slice(m.start, m.end)}
      </button>
    );
    cursor = m.end;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

function computeEntityMatches(text, entities) {
  if (!text || !Array.isArray(entities) || !entities.length) return [];
  const sorted = entities
    .filter(e => e && e.text !== null && e.text !== undefined && String(e.text).length > 0)
    .map(e => ({ ...e, text: String(e.text) }))
    .sort((a, b) => b.text.length - a.text.length);
  const matches = [];
  for (const e of sorted) {
    const needle = e.text;
    let from = 0;
    while (from < text.length) {
      const idx = text.indexOf(needle, from);
      if (idx === -1) break;
      const overlaps = matches.some(m => idx < m.end && idx + needle.length > m.start);
      if (!overlaps) matches.push({ start: idx, end: idx + needle.length, ent: e });
      from = idx + needle.length;
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
