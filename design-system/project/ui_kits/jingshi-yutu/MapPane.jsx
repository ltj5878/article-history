/* MapPane.jsx — professional historical map.
   Uses JSY_PROJECT (lat/lng → x/y), JSY_COUNTRY_OUTLINE (real coast),
   JSY_RIVERS (8 major rivers), JSY_MOUNTAINS, and JSY_PERIODS (state polygons,
   capitals, key cities) — modeled on Tan Qixiang's atlas + textbook plates. */

const { useState, useEffect, useRef, useMemo } = React;

const VBOX_W = 1200;
const VBOX_H = 900;

// turn an array of [lng,lat] into an SVG path "M ... L ... Z"
function polyPath(coords, project, close) {
  if (!coords || !coords.length) return "";
  let d = "";
  coords.forEach((c, i) => {
    const p = project(c[1], c[0]);
    d += (i === 0 ? "M" : "L") + p.x.toFixed(1) + "," + p.y.toFixed(1) + " ";
  });
  if (close) d += "Z";
  return d;
}

function smoothPath(coords, project) {
  // Catmull-Rom-ish smooth path for rivers — adds gentle curves between samples
  if (!coords || coords.length < 2) return "";
  const pts = coords.map(c => project(c[1], c[0]));
  let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

// ---------- Centroid for label placement ----------
function centroid(poly, project) {
  let cx = 0, cy = 0, n = poly.length;
  poly.forEach(([lng, lat]) => { const p = project(lat, lng); cx += p.x; cy += p.y; });
  return { x: cx / n, y: cy / n };
}

const MapPane = ({ paragraph, state, dispatch, chapter }) => {
  const project = window.JSY_PROJECT;
  const periodKey = (chapter && window.JSY_CHAPTER_PERIOD[chapter.id]) || "spring_autumn";
  const period = window.JSY_PERIODS[periodKey];

  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [animKey, setAnimKey] = useState(0);
  const [playing, setPlaying] = useState(true);
  const svgRef = useRef(null);

  useEffect(() => { setAnimKey(k => k + 1); setPlaying(true); }, [paragraph?.id]);

  const placeEntities = useMemo(
    () => (paragraph?.entities || []).filter(e => e.type === "place" && e.lat),
    [paragraph]
  );

  const onWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setView(v => ({ ...v, scale: Math.max(0.6, Math.min(3, v.scale * delta)) }));
  };
  const dragRef = useRef(null);
  const onMouseDown = (e) => { dragRef.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; };
  const onMouseMove = (e) => {
    if (!dragRef.current) return;
    setView(v => ({ ...v, x: dragRef.current.vx + (e.clientX - dragRef.current.x), y: dragRef.current.vy + (e.clientY - dragRef.current.y) }));
  };
  const onMouseUp = () => { dragRef.current = null; };

  const land = polyPath(window.JSY_COUNTRY_OUTLINE, project, true);

  return (
    <div className="map" onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
      <div className="map__controls">
        <button className="iconbtn" title="放大" onClick={() => setView(v => ({ ...v, scale: Math.min(3, v.scale * 1.2) }))}>
          <img src="../../assets/icons/zoom-in.svg" /></button>
        <button className="iconbtn" title="缩小" onClick={() => setView(v => ({ ...v, scale: Math.max(0.6, v.scale / 1.2) }))}>
          <img src="../../assets/icons/zoom-out.svg" /></button>
        <button className="iconbtn" title="复位" onClick={() => setView({ x: 0, y: 0, scale: 1 })}>
          <img src="../../assets/icons/recenter.svg" /></button>
        <div className="iconbtn__spacer" />
        <button className="iconbtn" title={playing ? "暂停" : "播放"} onClick={() => setPlaying(p => !p)}>
          <img src={playing ? "../../assets/icons/pause.svg" : "../../assets/icons/play.svg"} /></button>
        <button className="iconbtn" title="重播" onClick={() => setAnimKey(k => k + 1)}>
          <img src="../../assets/icons/replay.svg" /></button>
      </div>

      <div className="map__compass">
        <img src="../../assets/icons/compass.svg" />
        <span>北</span>
      </div>

      {/* Scale bar — equirectangular, 10° lng ≈ 400px at this projection */}
      <div className="map__scalebar">
        <div className="scalebar__tick"></div>
        <div className="scalebar__bar"><span></span><span></span></div>
        <div className="scalebar__labels"><span>0</span><span>500 里</span></div>
      </div>

      {/* Period title cartouche */}
      <div className="map__cartouche">
        <div className="cart__line"></div>
        <div className="cart__title">{period.label}</div>
        <div className="cart__sub">据 谭其骧《中国历史地图集》改绘</div>
      </div>

      {/* Legend (textbook-style) */}
      <div className="map__legend map__legend--full">
        <div className="legend__title">图　例</div>
        <div className="legend__row"><svg width="22" height="14"><rect x="3" y="3" width="14" height="8" fill="#C41E24" stroke="#1F1A14" strokeWidth="1"/></svg><span>诸侯国都</span></div>
        <div className="legend__row"><svg width="22" height="14"><circle cx="11" cy="7" r="4" fill="#FFFFFF" stroke="#1F1A14" strokeWidth="1.2"/><circle cx="11" cy="7" r="1.6" fill="#1F1A14"/></svg><span>主要城邑</span></div>
        <div className="legend__row"><svg width="22" height="14"><g transform="translate(11,7) rotate(45)"><rect x="-5" y="-5" width="10" height="10" fill="#E8553A" stroke="#1F1A14" strokeWidth="1"/></g></svg><span>战场</span></div>
        <div className="legend__row"><svg width="22" height="14"><path d="M11,2 L18,12 L4,12 Z" fill="none" stroke="#6B8E5A" strokeWidth="1.4"/></svg><span>关隘</span></div>
        <div className="legend__row"><svg width="22" height="14"><path d="M2,7 Q7,3 12,7 T22,7" fill="none" stroke="#5B89B3" strokeWidth="1.6"/></svg><span>河流</span></div>
        <div className="legend__row"><svg width="22" height="14"><path d="M2,11 L5,5 L8,11 M9,11 L13,4 L17,11 M18,11 L21,7" fill="none" stroke="#7A6953" strokeWidth="1.4"/></svg><span>山脉</span></div>
        <div className="legend__row"><svg width="22" height="14"><path d="M2,7 L20,7" stroke="#1F1A14" strokeWidth="1" strokeDasharray="3 2"/></svg><span>诸侯疆界</span></div>
      </div>

      <svg ref={svgRef} viewBox={`0 0 ${VBOX_W} ${VBOX_H}`} className="map__svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="paperGrain" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            <rect width="80" height="80" fill="var(--c-paper-2)"/>
            <circle cx="14" cy="22" r="0.8" fill="#8B572A" opacity="0.08"/>
            <circle cx="48" cy="56" r="1.0" fill="#8B572A" opacity="0.07"/>
            <circle cx="65" cy="14" r="0.6" fill="#8B572A" opacity="0.10"/>
            <circle cx="30" cy="68" r="0.5" fill="#8B572A" opacity="0.08"/>
          </pattern>
          <pattern id="seaHatch" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
            <path d="M0,3 L6,3" stroke="#A8C2D8" strokeWidth="0.4" opacity="0.5"/>
          </pattern>
          <filter id="paperShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
            <feOffset dx="0" dy="2" result="off"/>
            <feComponentTransfer><feFuncA type="linear" slope="0.25"/></feComponentTransfer>
            <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <marker id="arrow-jin" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 Z" fill="#2B4490"/>
          </marker>
          <marker id="arrow-chu" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 Z" fill="#C41E24"/>
          </marker>
          <marker id="arrow-qin" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 Z" fill="#6B3F1D"/>
          </marker>
          {/* clip rivers / mountains to land mass so they don't bleed into the sea */}
          <clipPath id="landClip"><path d={land}/></clipPath>
        </defs>

        {/* Sea */}
        <rect x="0" y="0" width={VBOX_W} height={VBOX_H} fill="url(#seaHatch)"/>
        {/* faint graticule grid every 5° */}
        <g className="graticule">
          {[20,25,30,35,40].map(lat => {
            const p1 = project(lat, 95), p2 = project(lat, 125);
            return <line key={"la"+lat} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#8AA8C9" strokeWidth="0.4" strokeDasharray="2 4" opacity="0.4"/>;
          })}
          {[100,105,110,115,120,125].map(lng => {
            const p1 = project(18, lng), p2 = project(43, lng);
            return <line key={"ln"+lng} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#8AA8C9" strokeWidth="0.4" strokeDasharray="2 4" opacity="0.4"/>;
          })}
        </g>

        <g transform={`translate(${view.x},${view.y}) scale(${view.scale})`}>
          {/* Land */}
          <path d={land} fill="url(#paperGrain)" stroke="#1F1A14" strokeWidth="1.4" strokeLinejoin="round" filter="url(#paperShadow)"/>

          {/* Coast double-line for textbook feel */}
          <path d={land} fill="none" stroke="#1F1A14" strokeWidth="0.4" strokeDasharray="0" opacity="0.5" transform="translate(2,2)"/>

          {/* State territories — drawn first, under everything */}
          {state.layers.territories && (
            <g className="territories">
              {period.states.map((s, i) => (
                <path key={s.name + i} d={polyPath(s.polygon, project, true)}
                  fill={s.color} fillOpacity="0.22"
                  stroke={s.color} strokeOpacity="0.95" strokeWidth="1.4" strokeDasharray="5 3"/>
              ))}
            </g>
          )}

          {/* Mountains — repeated zigzag glyphs along the range */}
          <g className="mountains" clipPath="url(#landClip)">
            {window.JSY_MOUNTAINS.map(m => {
              const a = project(m.range[0][1], m.range[0][0]);
              const b = project(m.range[1][1], m.range[1][0]);
              const len = Math.hypot(b.x - a.x, b.y - a.y);
              const count = Math.max(2, Math.floor(len / 14));
              const peaks = [];
              for (let i = 0; i <= count; i++) {
                const t = i / count;
                peaks.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
              }
              const lbl = project(m.lat, m.lng);
              return (
                <g key={m.name}>
                  {peaks.map((p, i) => (
                    <path key={i} d={`M ${p.x-4},${p.y+3} L ${p.x},${p.y-4} L ${p.x+4},${p.y+3}`}
                      fill="none" stroke="#7A6953" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                  ))}
                  <text x={lbl.x} y={lbl.y - 8} className="map__mountainlabel">{m.name}</text>
                </g>
              );
            })}
          </g>

          {/* Rivers — clipped to land */}
          <g className="rivers" clipPath="url(#landClip)">
            {Object.entries(window.JSY_RIVERS).map(([k, coords]) => (
              <path key={k} d={smoothPath(coords, project)}
                fill="none" stroke="#5B89B3" strokeWidth={k === "huanghe" || k === "changjiang" ? 2.4 : 1.5}
                strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>
            ))}
            {/* Wide-stroke for major rivers under to thicken */}
            <path d={smoothPath(window.JSY_RIVERS.huanghe, project)} fill="none" stroke="#5B89B3" strokeWidth="3.2" opacity="0.4"/>
            <path d={smoothPath(window.JSY_RIVERS.changjiang, project)} fill="none" stroke="#5B89B3" strokeWidth="3.4" opacity="0.4"/>
          </g>

          {/* River labels */}
          {(() => {
            const labels = [
              { coord: [110.5, 38.5], text: "黄  河" },
              { coord: [111.5, 30.5], text: "长  江" },
              { coord: [117.5, 32.9], text: "淮水" },
              { coord: [108.7, 34.5], text: "渭水" },
              { coord: [110.5, 32.6], text: "汉水" },
              { coord: [115.0, 36.5], text: "济水" },
              { coord: [117.4, 34.7], text: "泗水" },
            ];
            return labels.map(l => {
              const p = project(l.coord[1], l.coord[0]);
              return <text key={l.text} x={p.x} y={p.y} className="map__rivername">{l.text}</text>;
            });
          })()}

          {/* State labels (centroid of polygon) */}
          {state.layers.territories && period.states.map(s => {
            const c = centroid(s.polygon, project);
            return <text key={"L"+s.name} x={c.x} y={c.y} className="map__statelabel" fill={s.color}>{s.name}</text>;
          })}

          {/* Period base cities (always under chapter POIs) */}
          {state.layers.places && period.cities.map(c => {
            const p = project(c.lat, c.lng);
            return (
              <g key={"bc"+c.name}>
                <CityGlyph type={c.type} x={p.x} y={p.y} />
                <text x={p.x + 9} y={p.y + 4} className="city__label">{c.name}</text>
              </g>
            );
          })}

          {/* Routes (animated) */}
          {state.layers.routes && (paragraph?.routes || []).map((r, i) => (
            <Route key={animKey + "-" + i} route={r} project={project} delay={i * 250} playing={playing} />
          ))}

          {/* Chapter-specific POIs (highlighted on top) */}
          {state.layers.places && placeEntities.map((e, i) => (
            <POI key={e.text + i} entity={e} project={project} delay={i * 60}
              selected={state.selectedPlace?.text === e.text}
              onClick={() => dispatch({ type: "selectPlace", entity: e })} />
          ))}
        </g>
      </svg>

      {state.selectedPlace && (
        <InfoCard place={state.selectedPlace} onClose={() => dispatch({ type: "selectPlace", entity: null })} />
      )}
    </div>
  );
};

const CityGlyph = ({ type, x, y }) => {
  if (type === "capital") {
    return <g><rect x={x-4} y={y-4} width="8" height="8" fill="#C41E24" stroke="#1F1A14" strokeWidth="0.8"/></g>;
  }
  if (type === "royal") {
    return <g><rect x={x-5} y={y-5} width="10" height="10" fill="#D4AF37" stroke="#1F1A14" strokeWidth="0.8"/><circle cx={x} cy={y} r="2" fill="#1F1A14"/></g>;
  }
  if (type === "battle") {
    return <g transform={`translate(${x},${y}) rotate(45)`}><rect x="-4" y="-4" width="8" height="8" fill="#E8553A" stroke="#1F1A14" strokeWidth="0.8"/></g>;
  }
  if (type === "pass") {
    return <path d={`M ${x},${y-5} L ${x+5},${y+4} L ${x-5},${y+4} Z`} fill="#F5F0E8" stroke="#6B8E5A" strokeWidth="1.2"/>;
  }
  return <g><circle cx={x} cy={y} r="3" fill="#FFFFFF" stroke="#1F1A14" strokeWidth="1"/><circle cx={x} cy={y} r="1.2" fill="#1F1A14"/></g>;
};

const POI = ({ entity, project, delay, selected, onClick }) => {
  const p = project(entity.lat, entity.lng);
  const t = entity.poi || "city";
  return (
    <g style={{ cursor: "pointer" }} onClick={onClick}>
      {selected && <circle cx={p.x} cy={p.y} r="14" fill="none" stroke="#C41E24" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.9"/>}
      <g style={{ animation: `poiIn .3s var(--ease-ink) ${delay}ms both` }}>
        <CityGlyph type={t} x={p.x} y={p.y} />
        <text x={p.x + 8} y={p.y - 6} className="poi__label">{entity.text}</text>
        {entity.modernName && (
          <text x={p.x + 8} y={p.y + 8} className="poi__sublabel">{entity.modernName.replace(/^今/, "")}</text>
        )}
      </g>
    </g>
  );
};

const Route = ({ route, project, delay, playing }) => {
  const pts = route.points.map(p => project(p.lat, p.lng));
  if (pts.length < 2) return null;
  const d = pts.reduce((acc, p, i) => acc + (i === 0 ? `M ${p.x},${p.y}` : ` L ${p.x},${p.y}`), "");
  const factionColor = route.color || "#1F1A14";
  const arrowId = factionColor === "#2B4490" ? "arrow-jin"
                : factionColor === "#C41E24" ? "arrow-chu"
                : factionColor === "#6B3F1D" ? "arrow-qin"
                : "arrow-jin";
  return (
    <g>
      <path d={d}
        fill="none"
        stroke={factionColor}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={route.dashed ? "6 5" : "1500 1500"}
        markerEnd={`url(#${arrowId})`}
        style={{
          animation: route.dashed ? "none" : `drawRoute 1.4s var(--ease-ink) ${delay}ms both`,
          animationPlayState: playing ? "running" : "paused",
        }}
      />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="2.5" fill={factionColor} stroke="#F5F0E8" strokeWidth="0.6"/>
          <text x={p.x + 5} y={p.y - 6} className="route__label" style={{ fill: factionColor }}>{route.points[i].label}</text>
        </g>
      ))}
    </g>
  );
};

const InfoCard = ({ place, onClose }) => (
  <div className="infocard">
    <button className="infocard__close" onClick={onClose}>
      <img src="../../assets/icons/close.svg" />
    </button>
    <div className="infocard__seal"><img src="../../assets/seal-du.svg" /></div>
    <h4 className="infocard__title">{place.text}</h4>
    <div className="infocard__modern">古地名 · {place.modernName}</div>
    <div className="infocard__role">{place.description}</div>
    <div className="infocard__coords">{place.lat?.toFixed(2)}°N · {place.lng?.toFixed(2)}°E</div>
  </div>
);

window.MapPane = MapPane;
