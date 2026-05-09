import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import { pushSearchHistory, loadSearchHistory } from '../utils/storage';

// Search across all chapters of all books (lazy-loaded and cached client-side).
// Matches against paragraph text (original + translation) and entity names.
export default function SearchMenu({ books, dispatch }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('search');  // 'search' | 'place' | 'person' | 'event'
  const [history, setHistory] = useState(() => loadSearchHistory());
  const [index, setIndex] = useState({});      // { [bookId::chapterId]: chapterDoc }
  const [loadingMsg, setLoadingMsg] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(loadSearchHistory());
    setTimeout(() => inputRef.current?.focus(), 30);
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Lazy-load all chapters of all books on first open. Cached in state so subsequent
  // opens are instant. Failures are silent — search just won't find that chapter.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const targets = [];
      for (const b of books) {
        for (const c of (b.chapters || [])) {
          const key = `${b.id}::${c.id}`;
          if (!index[key]) targets.push({ bookId: b.id, bookTitle: b.title, chapterId: c.id, chapterTitle: c.title, kind: b.itemKind });
        }
      }
      if (!targets.length) return;
      setLoadingMsg(`索引中… 0/${targets.length}`);
      const next = { ...index };
      let done = 0;
      for (const t of targets) {
        try {
          const load = t.kind === 'article' ? api.getArticle : api.getChapter;
          const doc = await load(t.bookId, t.chapterId);
          if (cancelled) return;
          next[`${t.bookId}::${t.chapterId}`] = { ...doc, _bookId: t.bookId, _bookTitle: t.bookTitle, _chapterId: t.chapterId, _chapterTitle: t.chapterTitle };
        } catch {
          // skip failed chapters
        }
        done++;
        if (!cancelled && done % 2 === 0) setLoadingMsg(`索引中… ${done}/${targets.length}`);
      }
      if (cancelled) return;
      setIndex(next);
      setLoadingMsg('');
    })();
    return () => { cancelled = true; };
  }, [open, books]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(() => {
    const term = q.trim();
    if (!term) return [];
    const out = [];
    for (const key of Object.keys(index)) {
      const doc = index[key];
      const paras = doc.paragraphs || (doc.sections || []).flatMap(s => s.paragraphs || []);
      for (const p of paras) {
        const hay = `${p.original || ''}\n${p.translation || ''}`;
        const idx = hay.indexOf(term);
        let matchType = null;
        let snippet = '';
        if (idx >= 0) {
          matchType = '原文';
          const start = Math.max(0, idx - 12);
          const end = Math.min(hay.length, idx + term.length + 16);
          snippet = (start > 0 ? '…' : '') + hay.slice(start, end).replace(/\n/g, ' ') + (end < hay.length ? '…' : '');
        } else {
          const ent = (p.entities || []).find(e => e.text && e.text.includes(term));
          if (ent) {
            matchType = ent.type === 'place' ? '地名' : ent.type === 'person' ? '人物' : '事件';
            snippet = `${ent.text}${ent.description ? ' · ' + ent.description.slice(0, 40) : ''}`;
          }
        }
        if (matchType) {
          out.push({
            bookId: doc._bookId,
            bookTitle: doc._bookTitle,
            chapterId: doc._chapterId,
            chapterTitle: doc._chapterTitle,
            paragraphId: p.id,
            matchType,
            snippet,
          });
          if (out.length >= 50) return out;
        }
      }
    }
    return out;
  }, [q, index]);

  // Build a deduplicated entity dictionary across the whole index.
  // Keyed by `${type}::${text}` plus rough coord proximity so 大泽 (陈胜) and 大泽 (高祖) stay separate.
  const dictionary = useMemo(() => {
    const buckets = { place: new Map(), person: new Map(), event: new Map() };
    for (const key of Object.keys(index)) {
      const doc = index[key];
      const paras = doc.paragraphs || (doc.sections || []).flatMap(s => s.paragraphs || []);
      for (const p of paras) {
        for (const e of (p.entities || [])) {
          if (!buckets[e.type]) continue;
          const coord = e.lat && e.lng ? `${Math.round(e.lat * 4)}_${Math.round(e.lng * 4)}` : '_';
          const k = `${e.text}::${coord}`;
          if (!buckets[e.type].has(k)) {
            buckets[e.type].set(k, {
              ...e,
              firstHit: { bookId: doc._bookId, bookTitle: doc._bookTitle, chapterId: doc._chapterId, chapterTitle: doc._chapterTitle, paragraphId: p.id },
              count: 1,
            });
          } else {
            buckets[e.type].get(k).count += 1;
          }
        }
      }
    }
    const filterByQ = (list) => {
      const term = q.trim();
      if (!term) return list;
      return list.filter(item => item.text.includes(term) || (item.description || '').includes(term));
    };
    return {
      place: filterByQ(Array.from(buckets.place.values())).sort((a, b) => b.count - a.count),
      person: filterByQ(Array.from(buckets.person.values())).sort((a, b) => b.count - a.count),
      event: filterByQ(Array.from(buckets.event.values())).sort((a, b) => b.count - a.count),
    };
  }, [index, q]);

  const onJump = (r) => {
    pushSearchHistory(q);
    dispatch({ type: 'jumpTo', bookId: r.bookId, chapterId: r.chapterId, paragraphId: r.paragraphId });
    setOpen(false);
  };

  const onJumpEntity = (item) => {
    onJump(item.firstHit);
  };

  return (
    <div className="picker" ref={ref}>
      <button
        type="button"
        className="iconbtn"
        title="搜索"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
          <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/>
        </svg>
      </button>
      {open && (
        <div className="picker__menu" style={{ minWidth: 360, maxWidth: 480, maxHeight: 480, overflowY: 'auto', padding: 0 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tab === 'search' ? '搜索原文、译文、地名、人物、事件…' : '在分类中筛选…'}
              style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', fontSize: 14, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--fg)' }}
            />
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {[
                { id: 'search', label: '全文' },
                { id: 'place', label: `地名 (${dictionary.place.length})` },
                { id: 'person', label: `人物 (${dictionary.person.length})` },
                { id: 'event', label: `事件 (${dictionary.event.length})` },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  style={{
                    flex: 1, padding: '4px 6px', fontSize: 11, cursor: 'pointer',
                    border: '1px solid var(--border)', borderRadius: 4,
                    background: tab === t.id ? 'var(--c-vermillion)' : 'transparent',
                    color: tab === t.id ? '#fff' : 'var(--fg-2)',
                  }}
                >{t.label}</button>
              ))}
            </div>
            {loadingMsg && (
              <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 6 }}>{loadingMsg}</div>
            )}
          </div>
          <div>
            {tab !== 'search' && (
              dictionary[tab].length === 0 ? (
                <div style={{ padding: '14px 12px', fontSize: 13, color: 'var(--fg-3)' }}>
                  {loadingMsg ? '索引中…' : '暂无匹配条目'}
                </div>
              ) : (
                dictionary[tab].slice(0, 200).map((item, i) => (
                  <button
                    key={i}
                    type="button"
                    className="picker__item"
                    onClick={() => onJumpEntity(item)}
                    style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 12px' }}
                  >
                    <span style={{ fontSize: 13, color: 'var(--fg)' }}>
                      {item.text}
                      {item.modernName ? <span style={{ color: 'var(--fg-4)', marginLeft: 6, fontSize: 11 }}>{item.modernName}</span> : null}
                      <span style={{ color: 'var(--fg-4)', marginLeft: 6, fontSize: 11 }}>×{item.count}</span>
                    </span>
                    {item.description && (
                      <span style={{ fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.4 }}>
                        {item.description.slice(0, 60)}{item.description.length > 60 ? '…' : ''}
                      </span>
                    )}
                  </button>
                ))
              )
            )}
            {tab === 'search' && !q.trim() && history.length > 0 && (
              <div style={{ padding: '8px 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--fg-4)', marginBottom: 4 }}>最近搜索</div>
                {history.map(h => (
                  <button
                    key={h.q}
                    type="button"
                    className="picker__item"
                    style={{ fontSize: 13 }}
                    onClick={() => setQ(h.q)}
                  >{h.q}</button>
                ))}
              </div>
            )}
            {tab === 'search' && q.trim() && results.length === 0 && !loadingMsg && (
              <div style={{ padding: '14px 12px', fontSize: 13, color: 'var(--fg-3)' }}>无匹配结果</div>
            )}
            {tab === 'search' && results.map((r, i) => (
              <button
                key={i}
                type="button"
                className="picker__item"
                onClick={() => onJump(r)}
                style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 12px' }}
              >
                <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>
                  [{r.matchType}] 《{r.bookTitle}》· {r.chapterTitle}
                </span>
                <span style={{ fontSize: 13, color: 'var(--fg)', lineHeight: 1.4 }}>
                  {highlight(r.snippet, q.trim())}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function highlight(text, term) {
  if (!term || !text) return text;
  const i = text.indexOf(term);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark style={{ background: 'rgba(196,30,36,0.18)', color: 'inherit', padding: '0 1px' }}>{text.slice(i, i + term.length)}</mark>
      {text.slice(i + term.length)}
    </>
  );
}
