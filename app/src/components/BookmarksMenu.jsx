import { useEffect, useRef, useState } from 'react';
import { loadBookmarks, removeBookmark } from '../utils/storage';

export default function BookmarksMenu({ dispatch }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(() => loadBookmarks());
  const ref = useRef(null);

  useEffect(() => {
    const refresh = () => setItems(loadBookmarks());
    window.addEventListener('jingshi:bookmarks-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('jingshi:bookmarks-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(loadBookmarks());
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [open]);

  const onJump = (b) => {
    dispatch({ type: 'jumpTo', bookId: b.bookId, chapterId: b.chapterId, paragraphId: b.paragraphId });
    setOpen(false);
  };

  const onDelete = (e, b) => {
    e.stopPropagation();
    removeBookmark(b.bookId, b.chapterId, b.paragraphId);
    setItems(loadBookmarks());
    window.dispatchEvent(new Event('jingshi:bookmarks-changed'));
  };

  return (
    <div className="picker" ref={ref}>
      <button
        type="button"
        className="iconbtn"
        title={`书签 (${items.length})`}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3.5 2.5h9v11l-4.5-3-4.5 3v-11z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill={items.length ? 'currentColor' : 'none'} fillOpacity={items.length ? 0.15 : 0}/>
        </svg>
      </button>
      {open && (
        <div className="picker__menu" style={{ minWidth: 280, maxWidth: 360, maxHeight: 420, overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
          {items.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--fg-3)' }}>暂无书签。在段落上点击 ☆ 收藏。</div>
          ) : (
            items.map(b => (
              <button
                type="button"
                key={b.id}
                className="picker__item"
                onClick={() => onJump(b)}
                style={{ display: 'flex', flexDirection: 'column', gap: 2, position: 'relative', paddingRight: 28 }}
              >
                <span className="picker__item-label" style={{ fontSize: 12, color: 'var(--fg-3)' }}>
                  《{b.bookTitle}》· {b.chapterTitle}
                </span>
                <span className="picker__item-sub" style={{ fontSize: 13, color: 'var(--fg)', lineHeight: 1.4 }}>
                  {b.snippet || '(无摘要)'}
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => onDelete(e, b)}
                  style={{ position: 'absolute', right: 8, top: 8, fontSize: 14, color: 'var(--fg-4)', cursor: 'pointer', padding: 2 }}
                  title="删除书签"
                >×</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
