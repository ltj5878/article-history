import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildMapStyle } from './mapStyle';
import { api } from '../api/client';

const CENTER = [113, 34];
const DEFAULT_ZOOM = 4.5;

// Brushy state-label SVG creator (rendered as DOM markers, not in MapLibre layers,
// so they can use 行楷 web font + paper-shadow)
function createStateLabelEl(name, color) {
  const el = document.createElement('div');
  el.className = 'map-state-label';
  el.style.color = color;
  el.textContent = name;
  return el;
}

// Faction-colored marker glyphs (rectangles for capitals, diamonds for battles, triangles for passes)
function createCityMarkerEl(type, name, role) {
  const el = document.createElement('div');
  el.className = 'map-city-marker';
  let glyph;
  switch (type) {
    case 'capital':
      glyph = `<div style="width:10px;height:10px;background:#C41E24;border:1.2px solid #1F1A14;flex-shrink:0"></div>`;
      break;
    case 'royal':
      glyph = `<div style="width:12px;height:12px;background:#D4AF37;border:1.2px solid #1F1A14;display:flex;align-items:center;justify-content:center;flex-shrink:0"><div style="width:4px;height:4px;border-radius:50%;background:#1F1A14"></div></div>`;
      break;
    case 'battle':
      glyph = `<div style="width:10px;height:10px;background:#E8553A;border:1.2px solid #1F1A14;transform:rotate(45deg);flex-shrink:0"></div>`;
      break;
    case 'pass':
      glyph = `<div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:11px solid #6B8E5A;filter:drop-shadow(0 0 0.5px #1F1A14);flex-shrink:0"></div>`;
      break;
    default:
      glyph = `<div style="width:8px;height:8px;border-radius:50%;background:#fff;border:1.2px solid #1F1A14;display:flex;align-items:center;justify-content:center;flex-shrink:0"><div style="width:3px;height:3px;border-radius:50%;background:#1F1A14"></div></div>`;
  }
  el.innerHTML = `
    <div class="city-marker__inner">
      ${glyph}
      <div class="city-marker__label">
        <span class="city-marker__name">${name}</span>
        ${role ? `<span class="city-marker__role">${role}</span>` : ''}
      </div>
    </div>
  `;
  return el;
}

// Animated route path on a custom canvas overlay
function createRouteSourceData(routes) {
  if (!routes || !routes.length) return { type: 'FeatureCollection', features: [] };
  return {
    type: 'FeatureCollection',
    features: routes.map((r, i) => ({
      type: 'Feature',
      properties: { color: r.color || '#1F1A14', dashed: r.dashed ? 1 : 0, idx: i },
      geometry: {
        type: 'LineString',
        coordinates: r.points.map(p => [p.lng, p.lat]),
      },
    })),
  };
}

function createRoutePointsData(routes) {
  if (!routes || !routes.length) return { type: 'FeatureCollection', features: [] };
  const features = [];
  routes.forEach(r => {
    r.points.forEach(p => {
      features.push({
        type: 'Feature',
        properties: { label: p.label, color: r.color || '#1F1A14' },
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      });
    });
  });
  return { type: 'FeatureCollection', features };
}

function createTerritoryData(states) {
  if (!states || !states.length) return { type: 'FeatureCollection', features: [] };
  return {
    type: 'FeatureCollection',
    features: states.map(s => ({
      type: 'Feature',
      properties: { name: s.name, color: s.color },
      geometry: {
        type: 'Polygon',
        coordinates: [[...s.polygon, s.polygon[0]]],
      },
    })),
  };
}

export default function MapPane({ paragraph, state, dispatch, chapter, period }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markers = useRef({ states: [], cities: [], pois: [], provinces: [] });
  const [mapReady, setMapReady] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  // Show ALL place entities from the entire chapter (across all paragraphs), not
  // just the active paragraph. Deduplication is name + proximity-based: two
  // entities with the same `text` AND coords within ~10km are considered the
  // same place (handles minor coord-precision drift in the dataset).
  // Different places that happen to share a name (e.g. 大泽 = 陈胜起义大泽乡 in
  // 项羽本纪 vs 高祖斩蛇丰西大泽 in 高祖本纪 — distance >100km) are kept separate.
  const SAME_PLACE_THRESHOLD_DEG = 0.15;  // ~16km — generous for dataset precision
  const placeEntities = useMemo(() => {
    const all = [];
    const allParas = chapter?.paragraphs || (paragraph ? [paragraph] : []);
    for (const p of allParas) {
      for (const e of (p.entities || [])) {
        if (e.type !== 'place' || !e.lat || !e.lng) continue;
        // Skip if a previous entity with same text is within threshold
        const dup = all.find(prev =>
          prev.text === e.text &&
          Math.abs(prev.lat - e.lat) < SAME_PLACE_THRESHOLD_DEG &&
          Math.abs(prev.lng - e.lng) < SAME_PLACE_THRESHOLD_DEG
        );
        if (dup) continue;
        all.push(e);
      }
    }
    return all;
  }, [chapter, paragraph]);

  // Active-paragraph entities — highlighted brighter than inactive ones.
  // Match is name+proximity so an entity that's been deduplicated up to a
  // sibling paragraph still gets marked active.
  const activeEntityKeys = useMemo(() => {
    return (paragraph?.entities || [])
      .filter(e => e.type === 'place' && e.lat && e.lng)
      .map(e => ({ text: e.text, lat: e.lat, lng: e.lng }));
  }, [paragraph]);

  const isEntityActive = useCallback((e) => {
    return activeEntityKeys.some(a =>
      a.text === e.text &&
      Math.abs(a.lat - e.lat) < SAME_PLACE_THRESHOLD_DEG &&
      Math.abs(a.lng - e.lng) < SAME_PLACE_THRESHOLD_DEG
    );
  }, [activeEntityKeys]);

  useEffect(() => { setAnimKey(k => k + 1); }, [paragraph?.id]);

  // Initialize MapLibre — wait for ref to be attached
  useEffect(() => {
    if (mapInstance.current) return;
    let map = null;
    let mounted = true;
    // Defer to next tick so React commit has finished and ref is attached
    const tryInit = () => {
      if (!mounted) return;
      const container = mapRef.current;
      if (!container || !(container instanceof HTMLElement) || !document.body.contains(container)) {
        // Try again next tick
        requestAnimationFrame(tryInit);
        return;
      }
      try {
        map = new maplibregl.Map({
          container,
          style: buildMapStyle({ theme: state.theme }),
          center: CENTER,
          zoom: DEFAULT_ZOOM,
          minZoom: 3,
          maxZoom: 10,
          attributionControl: false,
          pitchWithRotate: false,
          dragRotate: false,
          touchZoomRotate: false,
        });
      } catch (e) {
        console.warn('MapLibre init failed:', e);
        return;
      }
      mapInstance.current = map;
      attachMapHandlers(map);
    };
    tryInit();

    return () => {
      mounted = false;
      const m = mapInstance.current;
      // Clean up DOM markers first
      Object.values(markers.current).forEach(arr => arr.forEach(mk => mk.remove?.()));
      markers.current = { states: [], cities: [], pois: [], provinces: [] };
      if (m) {
        try { m.remove(); } catch (e) { /* noop */ }
      }
      mapInstance.current = null;
      setMapReady(false);
    };

    function attachMapHandlers(map) {

    map.on('load', () => {
      // Sources for historical overlays
      map.addSource('territories', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, lineMetrics: true });
      map.addSource('route-points', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

      // Territory fills
      map.addLayer({
        id: 'territory-fill',
        type: 'fill',
        source: 'territories',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.18,
        },
      });
      map.addLayer({
        id: 'territory-outline',
        type: 'line',
        source: 'territories',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 1.6,
          'line-opacity': 0.85,
          'line-dasharray': [4, 3],
        },
      });

      // Routes (animated dash via line-gradient)
      map.addLayer({
        id: 'routes-glow',
        type: 'line',
        source: 'routes',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 5,
          'line-opacity': 0.18,
          'line-blur': 1.5,
        },
      });
      // Solid routes
      map.addLayer({
        id: 'routes-main',
        type: 'line',
        source: 'routes',
        filter: ['!=', ['get', 'dashed'], 1],
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2.4,
          'line-opacity': 0.95,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });
      // Dashed routes (separate layer because dasharray can't be a data expression)
      map.addLayer({
        id: 'routes-main-dashed',
        type: 'line',
        source: 'routes',
        filter: ['==', ['get', 'dashed'], 1],
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2.4,
          'line-opacity': 0.95,
          'line-dasharray': [3, 2],
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });
      map.addLayer({
        id: 'route-points',
        type: 'circle',
        source: 'route-points',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 3.5,
          'circle-stroke-color': '#F5F0E8',
          'circle-stroke-width': 1.2,
        },
      });

      setMapReady(true);
    });
    } // end attachMapHandlers
  }, []);

  // Theme change → rebuild style
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady) return;
    map.setStyle(buildMapStyle({ theme: state.theme }));
    map.once('styledata', () => {
      if (!map.getSource('territories')) {
        map.addSource('territories', { type: 'geojson', data: createTerritoryData(period?.states || []) });
        map.addSource('routes', { type: 'geojson', data: createRouteSourceData(paragraph?.routes), lineMetrics: true });
        map.addSource('route-points', { type: 'geojson', data: createRoutePointsData(paragraph?.routes) });

        map.addLayer({ id: 'territory-fill', type: 'fill', source: 'territories', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.18 } });
        map.addLayer({ id: 'territory-outline', type: 'line', source: 'territories', paint: { 'line-color': ['get', 'color'], 'line-width': 1.6, 'line-opacity': 0.85, 'line-dasharray': [4, 3] } });
        map.addLayer({ id: 'routes-glow', type: 'line', source: 'routes', paint: { 'line-color': ['get', 'color'], 'line-width': 5, 'line-opacity': 0.18, 'line-blur': 1.5 } });
        map.addLayer({ id: 'routes-main', type: 'line', source: 'routes', filter: ['!=', ['get', 'dashed'], 1], paint: { 'line-color': ['get', 'color'], 'line-width': 2.4, 'line-opacity': 0.95 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
        map.addLayer({ id: 'routes-main-dashed', type: 'line', source: 'routes', filter: ['==', ['get', 'dashed'], 1], paint: { 'line-color': ['get', 'color'], 'line-width': 2.4, 'line-opacity': 0.95, 'line-dasharray': [3, 2] }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
        map.addLayer({ id: 'route-points', type: 'circle', source: 'route-points', paint: { 'circle-color': ['get', 'color'], 'circle-radius': 3.5, 'circle-stroke-color': '#F5F0E8', 'circle-stroke-width': 1.2 } });
      }
    });
  }, [state.theme]);

  // === Modern province layer (toggleable, for古今对照) ===
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady) return;

    const visibility = state.layers.provinces ? 'visible' : 'none';
    try {
      map.setLayoutProperty('province-fill', 'visibility', visibility);
      map.setLayoutProperty('province-outline-halo', 'visibility', visibility);
      map.setLayoutProperty('province-outline', 'visibility', visibility);
    } catch (e) {
      // Layer may not be ready yet during style swaps; ignore
    }

    // Province name labels (DOM markers, only when visible)
    markers.current.provinces.forEach(m => m.remove());
    markers.current.provinces = [];

    if (!state.layers.provinces) return;

    // Fetch province centers and add labels
    const src = map.getSource('china-provinces');
    if (!src || !src._data) return;
    const data = typeof src._data === 'string' ? null : src._data;
    if (!data?.features) {
      // Source data is a URL string (lazy-loaded). Fetch directly to read centers.
      fetch(api.geoUrl('china_provinces'))
        .then(r => r.json())
        .then(geo => {
          if (!state.layers.provinces) return;  // user toggled off while fetching
          geo.features.forEach(f => {
            const { name_short, center_lng, center_lat } = f.properties;
            if (!name_short) return;
            const el = document.createElement('div');
            el.className = 'province-label';
            el.textContent = name_short;
            const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
              .setLngLat([center_lng, center_lat])
              .addTo(map);
            markers.current.provinces.push(marker);
          });
        })
        .catch(() => {});
    }
  }, [state.layers.provinces, mapReady]);

  // Update territory polygons + state labels when period or layer toggle changes
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady || !period) return;

    // Clear old state-name markers
    markers.current.states.forEach(m => m.remove());
    markers.current.states = [];

    if (!state.layers.territories) {
      const src = map.getSource('territories');
      if (src) src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const src = map.getSource('territories');
    if (src) src.setData(createTerritoryData(period.states));

    // Add state-name markers at centroid
    period.states.forEach(s => {
      const cLng = s.polygon.reduce((a, c) => a + c[0], 0) / s.polygon.length;
      const cLat = s.polygon.reduce((a, c) => a + c[1], 0) / s.polygon.length;
      const el = createStateLabelEl(s.name, s.color);
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([cLng, cLat])
        .addTo(map);
      markers.current.states.push(marker);
    });
  }, [period, state.layers.territories, mapReady]);

  // Update period base cities — these are also clickable (becomes selectable
  // place entity) so users can inspect e.g. 彭城/垓下 even when they're not in
  // the current chapter's narrative entities.
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady || !period) return;

    markers.current.cities.forEach(m => m.remove());
    markers.current.cities = [];

    if (!state.layers.places) return;

    period.cities.forEach(c => {
      // Skip cities that are already rendered as chapter POIs (proximity match
      // catches minor coord drift like 废丘/会稽 between periods.js and book data)
      const dup = placeEntities.find(e =>
        e.text === c.name &&
        Math.abs(e.lat - c.lat) < SAME_PLACE_THRESHOLD_DEG &&
        Math.abs(e.lng - c.lng) < SAME_PLACE_THRESHOLD_DEG
      );
      if (dup) return;

      // Build a synthetic entity for the InfoCard
      const entity = {
        text: c.name,
        modernName: c.role || '',
        description: c.role || '',
        lat: c.lat,
        lng: c.lng,
        poi: c.type,
      };

      const el = createCityMarkerEl(c.type, c.name, c.role);
      el.style.cursor = 'pointer';
      el.style.pointerEvents = 'auto';
      // Period cities are background context, dim slightly relative to active POIs
      el.classList.add('map-city-marker--dim');

      // Vermillion ring around selected city
      if (state.selectedPlace?.text === c.name &&
          Math.abs((state.selectedPlace.lat ?? 0) - c.lat) < 0.01 &&
          Math.abs((state.selectedPlace.lng ?? 0) - c.lng) < 0.01) {
        const ring = document.createElement('div');
        ring.style.cssText = `
          position: absolute; top: 50%; left: 0; transform: translate(-14px, -50%);
          width: 28px; height: 28px; border: 1.5px dashed #C41E24;
          border-radius: 50%; pointer-events: none;
          animation: pulseRing 1.6s ease-in-out infinite;
        `;
        el.appendChild(ring);
      }

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        dispatch({ type: 'selectPlace', entity });
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'left', offset: [4, 0] })
        .setLngLat([c.lng, c.lat])
        .addTo(map);
      markers.current.cities.push(marker);
    });
  }, [period, state.layers.places, mapReady, placeEntities, state.selectedPlace, dispatch]);

  // Routes
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady) return;
    const routesData = state.layers.routes ? (paragraph?.routes || []) : [];
    map.getSource('routes')?.setData(createRouteSourceData(routesData));
    map.getSource('route-points')?.setData(createRoutePointsData(routesData));
  }, [paragraph, state.layers.routes, mapReady, animKey]);

  // POI markers
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady) return;

    markers.current.pois.forEach(m => m.remove());
    markers.current.pois = [];

    if (!state.layers.places) return;

    placeEntities.forEach(e => {
      const isActive = isEntityActive(e);
      const el = createCityMarkerEl(e.poi || 'city', e.text, e.modernName?.replace(/^今/, ''));
      el.style.cursor = 'pointer';
      el.style.pointerEvents = 'auto';
      // Dim entities not in the currently-active paragraph so the focal scene
      // is still visually emphasized.
      if (!isActive) el.classList.add('map-city-marker--dim');

      // Vermillion ring around selected POI
      if (state.selectedPlace?.text === e.text) {
        const ring = document.createElement('div');
        ring.style.cssText = `
          position: absolute; top: 50%; left: 0; transform: translate(-14px, -50%);
          width: 28px; height: 28px; border: 1.5px dashed #C41E24;
          border-radius: 50%; pointer-events: none;
          animation: pulseRing 1.6s ease-in-out infinite;
        `;
        el.appendChild(ring);
      }

      el.addEventListener('click', () => dispatch({ type: 'selectPlace', entity: e }));
      const marker = new maplibregl.Marker({ element: el, anchor: 'left', offset: [4, 0] })
        .setLngLat([e.lng, e.lat])
        .addTo(map);
      markers.current.pois.push(marker);
    });
  }, [placeEntities, isEntityActive, state.layers.places, state.selectedPlace, mapReady, dispatch]);

  // Fly to selected place
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !state.selectedPlace) return;
    map.flyTo({
      center: [state.selectedPlace.lng, state.selectedPlace.lat],
      zoom: Math.max(map.getZoom(), 6),
      duration: 800,
      essential: true,
    });
  }, [state.selectedPlace]);

  // Auto-fit on chapter change — bounds cover the whole chapter (all paragraphs'
  // entities + routes), so when 乌江自刎 章节加载时, 阴陵/东城/乌江 都在视野内
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady || !chapter) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const p of (chapter.paragraphs || [])) {
      for (const e of (p.entities || [])) {
        if (e.type === 'place' && e.lat && e.lng) bounds.extend([e.lng, e.lat]);
      }
      for (const r of (p.routes || [])) {
        for (const pt of r.points) bounds.extend([pt.lng, pt.lat]);
      }
    }
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 80, duration: 800, maxZoom: 6.5 });
    }
  }, [chapter?.id, mapReady]);

  const handleZoomIn = useCallback(() => mapInstance.current?.zoomIn(), []);
  const handleZoomOut = useCallback(() => mapInstance.current?.zoomOut(), []);
  const handleRecenter = useCallback(() => {
    mapInstance.current?.flyTo({ center: CENTER, zoom: DEFAULT_ZOOM, duration: 600 });
  }, []);
  const handleReplay = useCallback(() => setAnimKey(k => k + 1), []);

  return (
    <div className="map">
      <div ref={mapRef} className="map__libre" />
      {!period && <div className="map__loading-overlay">加载地图…</div>}

      <div className="map__controls">
        <button className="iconbtn" title="放大" onClick={handleZoomIn}>
          <img src="/assets/icons/zoom-in.svg" />
        </button>
        <button className="iconbtn" title="缩小" onClick={handleZoomOut}>
          <img src="/assets/icons/zoom-out.svg" />
        </button>
        <button className="iconbtn" title="复位" onClick={handleRecenter}>
          <img src="/assets/icons/recenter.svg" />
        </button>
        <div className="iconbtn__spacer" />
        <button className="iconbtn" title="重播" onClick={handleReplay}>
          <img src="/assets/icons/replay.svg" />
        </button>
      </div>

      {period && (
        <div className="map__cartouche">
          <div className="cart__line"></div>
          <div className="cart__title">{period.label}</div>
          <div className="cart__sub">据 谭其骧《中国历史地图集》改绘</div>
        </div>
      )}

      <div className="map__legend map__legend--full">
        <div className="legend__title">图　例</div>
        <div className="legend__row"><svg width="22" height="14"><rect x="3" y="3" width="14" height="8" fill="#C41E24" stroke="#1F1A14" strokeWidth="1"/></svg><span>诸侯国都</span></div>
        <div className="legend__row"><svg width="22" height="14"><circle cx="11" cy="7" r="4" fill="#FFFFFF" stroke="#1F1A14" strokeWidth="1.2"/><circle cx="11" cy="7" r="1.6" fill="#1F1A14"/></svg><span>主要城邑</span></div>
        <div className="legend__row"><svg width="22" height="14"><g transform="translate(11,7) rotate(45)"><rect x="-5" y="-5" width="10" height="10" fill="#E8553A" stroke="#1F1A14" strokeWidth="1"/></g></svg><span>战场</span></div>
        <div className="legend__row"><svg width="22" height="14"><path d="M11,2 L18,12 L4,12 Z" fill="none" stroke="#6B8E5A" strokeWidth="1.4"/></svg><span>关隘</span></div>
        <div className="legend__row"><svg width="22" height="14"><path d="M2,7 Q7,3 12,7 T22,7" fill="none" stroke="#5B89B3" strokeWidth="1.6"/></svg><span>河流</span></div>
        <div className="legend__row"><svg width="22" height="14"><path d="M2,7 L20,7" stroke="#1F1A14" strokeWidth="1" strokeDasharray="3 2"/></svg><span>诸侯疆界</span></div>
        <div className="legend__row"><svg width="22" height="14"><path d="M2,7 L20,7" stroke="#5A4530" strokeWidth="1" strokeDasharray="3 2.5"/></svg><span>今省界</span></div>
      </div>

      {state.selectedPlace && (
        <InfoCard place={state.selectedPlace} onClose={() => dispatch({ type: 'selectPlace', entity: null })} />
      )}
    </div>
  );
}

function InfoCard({ place, onClose }) {
  return (
    <div className="infocard">
      <button className="infocard__close" onClick={onClose}>
        <img src="/assets/icons/close.svg" />
      </button>
      <div className="infocard__seal"><img src="/assets/seal-du.svg" /></div>
      <h4 className="infocard__title">{place.text}</h4>
      <div className="infocard__modern">古地名 · {place.modernName}</div>
      <div className="infocard__role">{place.description}</div>
      <div className="infocard__coords">{place.lat?.toFixed(2)}°N · {place.lng?.toFixed(2)}°E</div>
    </div>
  );
}
