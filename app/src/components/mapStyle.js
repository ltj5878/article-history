// 古风地图样式表 (MapLibre style spec)
// Hybrid of 谭其骧《中国历史地图集》 (precise borders, fine ink lines, neutral fills)
// and 明清舆图 (rice-paper texture, indigo water, brushy mountains).
// GeoJSON sources are pre-built static files under /data/geo (see
// scripts/build-data.mjs).

const GEO_BASE = `${import.meta.env.BASE_URL || '/'}data/geo`.replace(/\/+$/, '');

// Color palette pulled from design tokens (var(--c-paper) etc not usable inside
// MapLibre style spec, so duplicated as literals here).
const PAPER = '#F5F0E8';
const PAPER_2 = '#EDE5D3';
const PAPER_3 = '#E4D9BF';
const INK = '#1F1A14';
const INK_2 = '#3B3328';
const INK_3 = '#6B5F4E';
const SEA = '#D9E4EC';
const SEA_2 = '#C8D6E0';
const RIVER = '#5B89B3';
const RIVER_HIGHLIGHT = '#3D6890';
const VERMILLION = '#C41E24';

export function buildMapStyle({ theme = 'classic' } = {}) {
  const isDark = theme === 'dark';
  const isBright = theme === 'bright';

  // Theme-adjusted palette
  const bg = isDark ? '#1E1A12' : isBright ? '#FFFFFF' : PAPER;
  const land = isDark ? '#2A2418' : isBright ? '#F5F2EA' : PAPER_2;
  const landShade = isDark ? '#332B1D' : isBright ? '#EDEAE0' : PAPER_3;
  const seaColor = isDark ? '#0F1A24' : isBright ? '#E8EFF5' : SEA;
  const seaHatch = isDark ? '#1A2838' : isBright ? '#D5DFEA' : SEA_2;
  const inkColor = isDark ? '#C9BC9F' : INK;
  const subtleInk = isDark ? '#9E9277' : INK_3;

  return {
    version: 8,
    name: '经史舆图古风',
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'sea-bg': {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]],
            },
          }],
        },
      },
      'ne-land': { type: 'geojson', data: `${GEO_BASE}/ne_land_china.geojson` },
      'ne-coastline': { type: 'geojson', data: `${GEO_BASE}/ne_coastline_china.geojson` },
      'ne-rivers': { type: 'geojson', data: `${GEO_BASE}/ne_rivers_china.geojson` },
      'ne-lakes': { type: 'geojson', data: `${GEO_BASE}/ne_lakes_china.geojson` },
      'china-provinces': { type: 'geojson', data: `${GEO_BASE}/china_provinces.geojson` },
    },
    layers: [
      // ---------- Sea base (rice-paper bluish wash) ----------
      // sea-bg polygon is intentionally huge so it covers the full canvas at any
      // pan/zoom — prevents the container background from bleeding through as a
      // colored band along edges.
      {
        id: 'sea-fill',
        type: 'fill',
        source: 'sea-bg',
        paint: { 'fill-color': seaColor },
      },
      // ---------- Land (rice-paper ochre) ----------
      {
        id: 'land-fill',
        type: 'fill',
        source: 'ne-land',
        paint: {
          'fill-color': land,
        },
      },
      // Subtle inner shadow on land — second land layer slightly inset gives 卷轴 feel
      {
        id: 'land-shade',
        type: 'fill',
        source: 'ne-land',
        paint: {
          'fill-color': landShade,
          'fill-opacity': [
            'interpolate', ['linear'], ['zoom'],
            4, 0.15, 8, 0.05,
          ],
        },
      },

      // ---------- Lakes ----------
      {
        id: 'lakes-fill',
        type: 'fill',
        source: 'ne-lakes',
        paint: { 'fill-color': seaColor, 'fill-opacity': 0.85 },
      },
      {
        id: 'lakes-outline',
        type: 'line',
        source: 'ne-lakes',
        paint: { 'line-color': RIVER_HIGHLIGHT, 'line-width': 0.6, 'line-opacity': 0.7 },
      },

      // ---------- Rivers (indigo + thicker for major) ----------
      {
        id: 'rivers-minor',
        type: 'line',
        source: 'ne-rivers',
        filter: ['!=', ['get', 'major'], 1],
        paint: {
          'line-color': RIVER,
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            4, 0.4, 8, 1.0, 12, 1.6,
          ],
          'line-opacity': 0.7,
        },
      },
      {
        id: 'rivers-major-glow',
        type: 'line',
        source: 'ne-rivers',
        filter: ['==', ['get', 'major'], 1],
        paint: {
          'line-color': RIVER,
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            4, 1.6, 8, 4.0, 12, 7.0,
          ],
          'line-opacity': 0.25,
          'line-blur': 1.5,
        },
      },
      {
        id: 'rivers-major',
        type: 'line',
        source: 'ne-rivers',
        filter: ['==', ['get', 'major'], 1],
        paint: {
          'line-color': RIVER_HIGHLIGHT,
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            4, 0.8, 8, 2.0, 12, 3.4,
          ],
          'line-opacity': 0.95,
        },
      },

      // ---------- Coastline (ink line, double-stroke for textbook feel) ----------
      {
        id: 'coastline-shade',
        type: 'line',
        source: 'ne-coastline',
        paint: {
          'line-color': inkColor,
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            4, 1.4, 8, 2.6, 12, 4.0,
          ],
          'line-opacity': 0.15,
          'line-blur': 1.5,
          'line-translate': [1, 1],
        },
      },
      {
        id: 'coastline',
        type: 'line',
        source: 'ne-coastline',
        paint: {
          'line-color': inkColor,
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            4, 0.6, 8, 1.0, 12, 1.4,
          ],
          'line-opacity': 0.85,
        },
      },

      // ---------- Modern provinces (rendered last so they sit on top of all base layers) ----------
      // Layer is added but visibility:none — frontend toggles via setLayoutProperty.
      {
        id: 'province-fill',
        type: 'fill',
        source: 'china-provinces',
        layout: { visibility: 'none' },
        paint: { 'fill-color': inkColor, 'fill-opacity': 0.0 },
      },
      // Halo line for legibility against complex backgrounds
      {
        id: 'province-outline-halo',
        type: 'line',
        source: 'china-provinces',
        layout: { visibility: 'none' },
        paint: {
          'line-color': isDark ? '#000' : '#fff',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            3, 3, 6, 4.5, 10, 6.5,
          ],
          'line-opacity': 0.55,
        },
      },
      {
        id: 'province-outline',
        type: 'line',
        source: 'china-provinces',
        layout: { visibility: 'none' },
        paint: {
          'line-color': isDark ? '#C9BC9F' : '#3B3328',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            3, 1.0, 6, 1.5, 10, 2.0,
          ],
          'line-opacity': 0.85,
          'line-dasharray': [3, 2.5],
        },
      },
    ],
  };
}
