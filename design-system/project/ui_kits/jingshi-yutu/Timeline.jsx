/* Timeline.jsx — bottom horizontal axis with scrubber + event markers */

const Timeline = ({ events, currentYear, onPick }) => {
  const minY = -700, maxY = 600;   // covers spec range
  const pct = (y) => ((y - minY) / (maxY - minY)) * 100;
  const cy = currentYear ?? -200;

  return (
    <div className="timeline">
      <div className="timeline__rule" />
      {/* anchor ticks every 100 years */}
      {Array.from({ length: 7 }, (_, i) => {
        const y = minY + i * 200;
        return (
          <div key={y} className="timeline__tick" style={{ left: `${pct(y)}%` }}>
            <div className="timeline__tickmark" />
            <div className="timeline__tickyear">{y < 0 ? `前${-y}` : `${y}`}</div>
          </div>
        );
      })}
      {events.map(ev => (
        <button key={ev.year + ev.label} className="timeline__event" style={{ left: `${pct(ev.year)}%` }}
          title={`${ev.label} · ${ev.year < 0 ? `公元前 ${-ev.year}` : ev.year} 年`}
          onClick={() => onPick(ev)}>
          <span className="timeline__dot" />
          <span className="timeline__lbl">{ev.label}</span>
        </button>
      ))}
      <div className="timeline__scrubber" style={{ left: `${pct(cy)}%` }}>
        <div className="timeline__handle" />
      </div>
    </div>
  );
};

window.Timeline = Timeline;
