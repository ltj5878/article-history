import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildMapStyle } from './mapStyle';
import { api } from '../api/client';
import { createRouteSourceData, createRoutePointsData, createTerritoryData } from './map/geometry';
import { useRouteAnimation } from './map/useRouteAnimation';

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

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

// Faction-colored marker glyphs (rectangles for capitals, diamonds for battles, triangles for passes)
function createCityMarkerEl(type, name, role) {
  const el = document.createElement('div');
  el.className = 'map-city-marker';
  const safeName = escapeHtml(name);
  const safeRole = escapeHtml(role);
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
        <span class="city-marker__name">${safeName}</span>
        ${safeRole ? `<span class="city-marker__role">${safeRole}</span>` : ''}
      </div>
    </div>
  `;
  return el;
}

// Geometry helpers and route animation hook live in ./map/

export default function MapPane({ paragraph, state, dispatch, chapter, period }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markers = useRef({ states: [], cities: [], pois: [], provinces: [] });
  const [mapReady, setMapReady] = useState(false);
  const { progress: animProgress, playing, togglePlay, scrub, replay } = useRouteAnimation({
    paragraphId: paragraph?.id,
  });

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
      for (const e of (Array.isArray(p.entities) ? p.entities : [])) {
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
    return (Array.isArray(paragraph?.entities) ? paragraph.entities : [])
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
          preserveDrawingBuffer: true,  // required for PNG export via canvas.toBlob
        });
      } catch (e) {
        console.warn('MapLibre init failed:', e);
        return;
      }
      mapInstance.current = map;
      attachMapHandlers(map);

      // Keep canvas sized to container — guards against grid-row reflow leaving
      // a strip of empty space under the canvas after timeline height changes.
      const ro = new ResizeObserver(() => {
        try { map.resize(); } catch { /* noop */ }
      });
      ro.observe(container);
      map.__ro = ro;
    };
    tryInit();

    return () => {
      mounted = false;
      const m = mapInstance.current;
      if (m?.__ro) { try { m.__ro.disconnect(); } catch { /* noop */ } }
      // Clean up DOM markers first
      Object.values(markers.current).forEach(arr => arr.forEach(mk => mk.remove?.()));
      markers.current = { states: [], cities: [], pois: [], provinces: [] };
      if (m) {
        try { m.remove(); } catch { /* noop */ }
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [state.theme]); // eslint-disable-line react-hooks/exhaustive-deps

  // === Modern province layer (toggleable, for古今对照) ===
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady) return;

    const visibility = state.layers.provinces ? 'visible' : 'none';
    try {
      map.setLayoutProperty('province-fill', 'visibility', visibility);
      map.setLayoutProperty('province-outline-halo', 'visibility', visibility);
      map.setLayoutProperty('province-outline', 'visibility', visibility);
    } catch {
      // Layer may not be ready yet during style swaps; ignore
    }

    // Province name labels (DOM markers, only when visible)
    markers.current.provinces.forEach(m => m.remove());
    markers.current.provinces = [];

    if (!state.layers.provinces) return;

    const addProvinceLabels = (geo) => {
      if (mapInstance.current !== map) return;
      for (const f of geo?.features || []) {
        const { name_short, center_lng, center_lat } = f?.properties || {};
        if (!name_short || !Number.isFinite(center_lng) || !Number.isFinite(center_lat)) continue;
        const el = document.createElement('div');
        el.className = 'province-label';
        el.textContent = name_short;
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([center_lng, center_lat])
          .addTo(map);
        markers.current.provinces.push(marker);
      }
    };

    // If MapLibre has already loaded the province source, read its in-memory
    // GeoJSON. Otherwise fetch the same layer (API or static fallback) once.
    const src = map.getSource('china-provinces');
    const loadedData = src && typeof src._data === 'object' ? src._data : null;
    if (loadedData?.features) {
      addProvinceLabels(loadedData);
      return;
    }

    let cancelled = false;
    fetch(api.geoUrl('china_provinces'))
      .then(r => {
        if (!r.ok) throw new Error(`Province layer request failed: ${r.status}`);
        return r.json();
      })
      .then(geo => {
        if (!cancelled && state.layers.provinces) addProvinceLabels(geo);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [state.layers.provinces, mapReady]);

  // Update territory polygons + state labels when period or layer toggle changes
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady) return;

    // Clear old state-name markers even when the period disappears, so stale
    // labels never outlive their data source.
    markers.current.states.forEach(m => m.remove());
    markers.current.states = [];

    const src = map.getSource('territories');
    if (!src) return;
    if (!period || !state.layers.territories) {
      src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    src.setData(createTerritoryData(period.states));

    // Add state-name markers at centroid
    for (const s of (Array.isArray(period.states) ? period.states : [])) {
      if (!Array.isArray(s.polygon) || s.polygon.length === 0) continue;
      const cLng = s.polygon.reduce((a, c) => a + c[0], 0) / s.polygon.length;
      const cLat = s.polygon.reduce((a, c) => a + c[1], 0) / s.polygon.length;
      const el = createStateLabelEl(s.name, s.color);
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([cLng, cLat])
        .addTo(map);
      markers.current.states.push(marker);
    }
  }, [period, state.layers.territories, mapReady]);

  // Update period base cities — these are also clickable (becomes selectable
  // place entity) so users can inspect e.g. 彭城/垓下 even when they're not in
  // the current chapter's narrative entities.
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady) return;

    markers.current.cities.forEach(m => m.remove());
    markers.current.cities = [];

    if (!period || !state.layers.places) return;

    for (const c of (Array.isArray(period.cities) ? period.cities : [])) {
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
          Math.abs((state.selectedPlace.lat ?? 0) - c.lat) < SAME_PLACE_THRESHOLD_DEG &&
          Math.abs((state.selectedPlace.lng ?? 0) - c.lng) < SAME_PLACE_THRESHOLD_DEG) {
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
    }
  }, [period, state.layers.places, mapReady, placeEntities, state.selectedPlace, dispatch]);

  // Routes — re-evaluated on animProgress for play/scrub animation
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady) return;
    const routesData = state.layers.routes ? (paragraph?.routes || []) : [];
    map.getSource('routes')?.setData(createRouteSourceData(routesData, animProgress));
    map.getSource('route-points')?.setData(animProgress >= 1 ? createRoutePointsData(routesData) : { type: 'FeatureCollection', features: [] });
  }, [paragraph, state.layers.routes, mapReady, animProgress]);

  // (route animation managed by useRouteAnimation hook)

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

      // Vermillion ring around selected POI (name + proximity so same-name
      // places at different locations don't all light up).
      if (state.selectedPlace?.text === e.text &&
          Math.abs((state.selectedPlace.lat ?? 0) - e.lat) < SAME_PLACE_THRESHOLD_DEG &&
          Math.abs((state.selectedPlace.lng ?? 0) - e.lng) < SAME_PLACE_THRESHOLD_DEG) {
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

  // Reverse linkage: when a place is selected on the map, scroll the reader to
  // the first paragraph mentioning it (by name + proximity). Skipped if the
  // active paragraph already mentions this place — avoids fighting text→map.
  useEffect(() => {
    if (!state.selectedPlace || !chapter?.paragraphs) return;
    const target = state.selectedPlace;
    const activeMentions = (Array.isArray(paragraph?.entities) ? paragraph.entities : []).some(e =>
      e.type === 'place' && e.text === target.text &&
      Math.abs((e.lat ?? 0) - (target.lat ?? 0)) < SAME_PLACE_THRESHOLD_DEG &&
      Math.abs((e.lng ?? 0) - (target.lng ?? 0)) < SAME_PLACE_THRESHOLD_DEG
    );
    if (activeMentions) return;
    const found = chapter.paragraphs.find(p =>
      (Array.isArray(p.entities) ? p.entities : []).some(e =>
        e.type === 'place' && e.text === target.text &&
        Math.abs((e.lat ?? 0) - (target.lat ?? 0)) < SAME_PLACE_THRESHOLD_DEG &&
        Math.abs((e.lng ?? 0) - (target.lng ?? 0)) < SAME_PLACE_THRESHOLD_DEG
      )
    );
    if (found) dispatch({ type: 'set', key: 'activeParagraph', value: found.id });
  }, [state.selectedPlace, chapter, paragraph, dispatch]);

  // Auto-fit on chapter change — bounds cover the whole chapter (all paragraphs'
  // entities + routes), so when 乌江自刎 章节加载时, 阴陵/东城/乌江 都在视野内
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady || !chapter) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const p of (Array.isArray(chapter.paragraphs) ? chapter.paragraphs : [])) {
      for (const e of (Array.isArray(p.entities) ? p.entities : [])) {
        if (e.type === 'place' && e.lat && e.lng) bounds.extend([e.lng, e.lat]);
      }
      for (const r of (Array.isArray(p.routes) ? p.routes : [])) {
        for (const pt of r.points) bounds.extend([pt.lng, pt.lat]);
      }
    }
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 80, duration: 800, maxZoom: 6.5 });
    }
  }, [chapter?.id, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Active paragraph remains the primary map focus. This matters for article
  // mode where one reading unit can contain many historical scenes.
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady || !paragraph) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const e of (Array.isArray(paragraph.entities) ? paragraph.entities : [])) {
      if (e.type === 'place' && e.lat && e.lng) bounds.extend([e.lng, e.lat]);
    }
    for (const r of (Array.isArray(paragraph.routes) ? paragraph.routes : [])) {
      for (const pt of r.points) bounds.extend([pt.lng, pt.lat]);
    }
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 90, duration: 650, maxZoom: 7 });
    }
  }, [paragraph?.id, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleZoomIn = useCallback(() => mapInstance.current?.zoomIn(), []);
  const handleZoomOut = useCallback(() => mapInstance.current?.zoomOut(), []);
  const handleRecenter = useCallback(() => {
    mapInstance.current?.flyTo({ center: CENTER, zoom: DEFAULT_ZOOM, duration: 600 });
  }, []);
  const handleReplay = useCallback(() => replay(), [replay]);

  const handleExport = useCallback(async () => {
    const map = mapInstance.current;
    if (!map) return;
    map.triggerRepaint();
    // Wait one frame so the next paint is captured before readback
    await new Promise(r => requestAnimationFrame(r));
    const mapCanvas = map.getCanvas();
    const W = mapCanvas.width;
    const H = mapCanvas.height;
    const bandH = 140;  // bottom band for title + text
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H + bandH;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(mapCanvas, 0, 0);

    // Bottom band — paper background + dark text
    ctx.fillStyle = '#F5F0E8';
    ctx.fillRect(0, H, W, bandH);
    ctx.fillStyle = '#1F1A14';
    ctx.font = '600 22px "Noto Serif SC", serif';
    const title = `${chapter?.title || ''}${period?.label ? ' · ' + period.label : ''}`;
    ctx.fillText(title, 24, H + 36);

    ctx.font = '14px "Noto Serif SC", serif';
    ctx.fillStyle = '#3A2F22';
    const text = (paragraph?.original || '').slice(0, 200);
    wrapText(ctx, text, 24, H + 64, W - 48, 22);

    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#8A7B66';
    ctx.fillText('经史舆图 · jingshi-map', 24, H + bandH - 14);

    out.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safe = (chapter?.id || 'map').replace(/[^\w-]/g, '_');
      a.download = `jingshi-${safe}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  }, [chapter, paragraph, period]);
  const hasRoutes = Boolean(paragraph?.routes?.length) && state.layers.routes;
  const onPlayPause = useCallback(() => { if (hasRoutes) togglePlay(); }, [hasRoutes, togglePlay]);
  const onScrub = useCallback((e) => scrub(e.target.value), [scrub]);

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
        <button className="iconbtn" title="导出当前视图为图片" onClick={handleExport}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
            <path d="M8 1.5v8.5"/><path d="M4.5 6.5L8 10l3.5-3.5"/><path d="M2 12.5v1.5h12v-1.5"/>
          </svg>
        </button>
        {hasRoutes && (
          <button className="iconbtn" title={playing ? '暂停' : '播放路线动画'} onClick={onPlayPause}>
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="3" y="2" width="3" height="10"/><rect x="8" y="2" width="3" height="10"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 2l9 5-9 5z"/></svg>
            )}
          </button>
        )}
      </div>
      {hasRoutes && (
        <div className="map__scrubber">
          <input
            type="range" min="0" max="1" step="0.01"
            value={animProgress}
            onChange={onScrub}
            aria-label="路线进度"
          />
        </div>
      )}

      {period && (
        <Cartouche label={period.label} />
      )}

      <div className="map__legend map__legend--full">
        <div className="legend__title">图例</div>
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

// CJK-friendly text wrap by character count to fit pixel width.
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  if (!text) return;
  let line = '';
  let cy = y;
  for (const ch of text) {
    const next = line + ch;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = ch;
      cy += lineHeight;
      if (cy > y + lineHeight * 3) {
        ctx.fillText(line + '…', x, cy);
        return;
      }
    } else {
      line = next;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

function Cartouche({ label }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="map__cartouche">
      <div className="cart__line"></div>
      <div className="cart__title">{label}</div>
      <div className="cart__sub">
        据 谭其骧《中国历史地图集》改绘
        <button
          type="button"
          className="cart__info"
          onClick={() => setOpen(o => !o)}
          title="数据来源说明"
          aria-label="数据来源说明"
        >?</button>
      </div>
      {open && (
        <div className="cart__source-pop" onClick={(e) => e.stopPropagation()}>
          <button className="cart__source-close" onClick={() => setOpen(false)} aria-label="关闭">×</button>
          <div className="cart__source-title">关于历史疆界</div>
          <p>9 个时期的政权疆界依据 <b>谭其骧主编《中国历史地图集》</b>（中国地图出版社）轮廓改绘，并参考史料对争议地段做了简化。</p>
          <p>春秋战国早期边界在学界存在争议；本图主要呈现政治势力范围，并非严格的现代意义上的国界。读者参阅时请留意时段叠加与文献版本差异。</p>
          <p style={{ color: 'var(--fg-4)' }}>地理底图：Natural Earth 1:50m，公共领域。</p>
        </div>
      )}
    </div>
  );
}

function formatCoordinate(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : '--';
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
      <div className="infocard__coords">{formatCoordinate(place.lat)}°N · {formatCoordinate(place.lng)}°E</div>
    </div>
  );
}
