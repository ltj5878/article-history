import { useMemo, useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';

/**
 * Timeline — a horizontally pannable scroll track.
 *
 * Layout:
 *   .timeline (viewport, fixed width = 100% of parent, overflow:hidden)
 *     .timeline__track (wide track, width = TRACK_SCALE × viewport, transform:translateX)
 *       — ticks, events, scrubber positioned absolutely on the track in % of track width
 *
 * Interaction:
 *   - Click + drag anywhere on empty track → pan the whole track left/right
 *   - Click on an event button → jump to that chapter
 *   - Mouse wheel → also pans (horizontal/shift+vertical)
 */
export default function Timeline({ events, currentYear, currentChapter, collapsed, onToggleCollapsed, onPick }) {
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const [pan, setPan] = useState(0);     // pixels translated; 0 = aligned to viewport left
  const [viewportW, setViewportW] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);

  // Range derived ONLY from events (chapter years that fall outside the events
  // span are not used to pad the bar — empty space wastes screen real estate).
  // Padding is small (just enough to give the first/last event some breathing room).
  const { minY, maxY, ticks } = useMemo(() => {
    const eventYears = events?.map(e => e.year) || [];
    if (!eventYears.length) {
      return { minY: -700, maxY: 600, ticks: [-700, -500, -300, -100, 100, 300, 500] };
    }
    const lo = Math.min(...eventYears);
    const hi = Math.max(...eventYears);
    const span = Math.max(hi - lo, 10);
    const padding = Math.max(span * 0.05, 2);  // ~5% padding on each side
    const minY = Math.floor((lo - padding) / 5) * 5;
    const maxY = Math.ceil((hi + padding) / 5) * 5;

    const totalSpan = maxY - minY;
    let step;
    if (totalSpan <= 30) step = 5;
    else if (totalSpan <= 80) step = 10;
    else if (totalSpan <= 200) step = 25;
    else if (totalSpan <= 500) step = 50;
    else step = 100;

    const ticks = [];
    const start = Math.ceil(minY / step) * step;
    for (let y = start; y <= maxY; y += step) ticks.push(y);

    return { minY, maxY, ticks };
  }, [events]);

  // Track is rendered wider than viewport so events get breathing room
  // and so the user can drag to explore.
  // Density: aim for ~180px per event so labels never crowd. Always at least 1.5×.
  const trackScale = useMemo(() => {
    const eventCount = events?.length || 1;
    const desired = (eventCount * 180) / Math.max(viewportW, 600);
    return Math.max(1.5, Math.min(4.0, desired));
  }, [events, viewportW]);

  // Track width in pixels
  const trackW = viewportW * trackScale;
  const trackPct = (y) => ((y - minY) / (maxY - minY)) * 100;

  // Pan limits
  const panMin = -(trackW - viewportW);   // furthest left (showing right edge)
  const panMax = 0;                       // furthest right (showing left edge)
  const clampPan = useCallback((p) => Math.max(panMin, Math.min(panMax, p)), [panMin, panMax]);

  // === Initial mount: measure viewport ===
  useLayoutEffect(() => {
    const update = () => {
      if (viewportRef.current) setViewportW(viewportRef.current.clientWidth);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // === Auto-scroll to current chapter when it actually changes ===
  // We only re-center when the *chapter* changes, not on every re-render.
  // Drag-induced pan stays put.
  const lastChapterRef = useRef(currentChapter);
  useEffect(() => {
    if (lastChapterRef.current === currentChapter) return;
    lastChapterRef.current = currentChapter;
    if (!viewportW || currentYear == null) return;
    const targetX = (trackPct(currentYear) / 100) * trackW;
    const desiredPan = clampPan(viewportW / 2 - targetX);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPan(desiredPan);
  }, [currentChapter, currentYear, viewportW, trackW]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Re-clamp pan when viewport / track size changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPan(p => clampPan(p));
  }, [trackW, viewportW, clampPan]);

  // === Drag handlers ===
  const onPointerDown = (e) => {
    if (collapsed) return;
    if (e.button !== 0 && e.button !== undefined) return;
    // Don't start drag if user pressed inside an event button
    if (e.target.closest('.timeline__event')) return;
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startPan: pan, moved: false };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      if (!dragRef.current) return;
      if (dragRef.current.pointerId !== undefined && e.pointerId !== dragRef.current.pointerId) return;
      const dx = e.clientX - dragRef.current.startX;
      if (Math.abs(dx) > 3) dragRef.current.moved = true;
      setPan(clampPan(dragRef.current.startPan + dx));
    };
    const onUp = () => {
      setDragging(false);
      dragRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, clampPan]);

  // Wheel scrolling — horizontal scroll OR shift+vertical
  const onWheel = useCallback((e) => {
    if (collapsed) return;
    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
    if (!dx) return;
    e.preventDefault();
    setPan(p => clampPan(p - dx));
  }, [clampPan, collapsed]);

  // Stagger overlapping events into vertical lanes
  const laneAssignments = useMemo(() => {
    if (!events?.length) return [];
    const sorted = [...events]
      .map((ev, i) => ({ ...ev, originalIdx: i }))
      .sort((a, b) => a.year - b.year);

    const lanes = [];
    sorted.forEach(ev => {
      const evPct = trackPct(ev.year);
      let laneIdx = lanes.findIndex(lane => {
        const last = lane[lane.length - 1];
        const lastPct = trackPct(last.year);
        // Larger gap requirement when track is wider
        const minGapPct = (80 / trackW) * 100;
        return Math.abs(evPct - lastPct) > minGapPct;
      });
      if (laneIdx === -1) {
        laneIdx = lanes.length;
        lanes.push([]);
      }
      lanes[laneIdx].push({ ...ev, lane: laneIdx });
    });

    const flat = [];
    lanes.forEach(lane => lane.forEach(ev => flat.push(ev)));
    flat.sort((a, b) => a.originalIdx - b.originalIdx);
    return flat;
  }, [events, minY, maxY, trackW]);  // eslint-disable-line react-hooks/exhaustive-deps

  const totalLanes = laneAssignments.length ? Math.max(...laneAssignments.map(e => e.lane)) + 1 : 1;

  return (
    <div
      className={'timeline' + (dragging ? ' is-dragging' : '') + (collapsed ? ' is-collapsed' : '')}
      style={{ '--lanes': totalLanes }}
      ref={viewportRef}
      onPointerDown={onPointerDown}
      onWheel={onWheel}
    >
      <button
        type="button"
        className="timeline__toggle"
        title={collapsed ? '展开时间轴' : '收起时间轴'}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onToggleCollapsed();
        }}
      >
        <span>{collapsed ? '展开时间轴' : '收起时间轴'}</span>
        <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
          <path d={collapsed ? 'M2 7l3.5-3L9 7' : 'M2 4l3.5 3L9 4'} stroke="currentColor" fill="none" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        className="timeline__track"
        ref={trackRef}
        style={{
          width: trackW || '100%',
          transform: `translateX(${pan}px)`,
          transition: dragging ? 'none' : 'transform 0.4s var(--ease-ink)',
        }}
      >
        <div className="timeline__rule" />
        {ticks.map(y => (
          <div key={y} className="timeline__tick" style={{ left: `${trackPct(y)}%` }}>
            <div className="timeline__tickmark" />
            <div className="timeline__tickyear">{y < 0 ? `前${-y}` : `${y}`}</div>
          </div>
        ))}
        {laneAssignments.map(ev => (
          <button
            key={ev.year + '-' + ev.label + '-' + ev.originalIdx}
            type="button"
            className={'timeline__event' + (isEventActive(ev, currentChapter) ? ' is-active' : '')}
            style={{
              left: `${trackPct(ev.year)}%`,
              '--lane': ev.lane,
            }}
            title={`${ev.label} · ${ev.year < 0 ? `公元前 ${-ev.year}` : ev.year} 年`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              // Suppress click if user dragged
              if (dragRef.current?.moved) return;
              onPick(ev);
            }}
          >
            <span className="timeline__dot" />
            <span className="timeline__lbl">{ev.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function isEventActive(event, currentChapter) {
  if ((event.section || event.chapter) === currentChapter) return true;
  return Boolean(event.targets?.some(target => target.section === currentChapter));
}
