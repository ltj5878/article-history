// Pure GeoJSON builders for MapLibre sources. Extracted from MapPane so the
// component is leaner and these can be unit-tested in isolation.

export function createRouteSourceData(routes, progress = 1) {
  if (!Array.isArray(routes) || !routes.length) return { type: 'FeatureCollection', features: [] };
  return {
    type: 'FeatureCollection',
    features: routes.map((r, i) => ({
      type: 'Feature',
      properties: { color: r.color || '#1F1A14', dashed: r.dashed ? 1 : 0, idx: i },
      geometry: {
        type: 'LineString',
        coordinates: clipRouteCoords(r.points, progress),
      },
    })),
  };
}

export function createRoutePointsData(routes) {
  if (!Array.isArray(routes) || !routes.length) return { type: 'FeatureCollection', features: [] };
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

export function createTerritoryData(states) {
  const validStates = (Array.isArray(states) ? states : []).filter(s => Array.isArray(s.polygon) && s.polygon.length >= 3);
  if (!validStates.length) return { type: 'FeatureCollection', features: [] };
  return {
    type: 'FeatureCollection',
    features: validStates.map(s => ({
      type: 'Feature',
      properties: { name: s.name, color: s.color },
      geometry: {
        type: 'Polygon',
        coordinates: [[...s.polygon, s.polygon[0]]],
      },
    })),
  };
}

// Truncate a polyline by cumulative arc length to render the first
// (progress * total) of its length. progress in [0, 1].
export function clipRouteCoords(points, progress) {
  const coords = (Array.isArray(points) ? points : []).map(p => [p.lng, p.lat]);
  if (!coords.length) return [];
  if (progress >= 1 || coords.length < 2) return coords;
  if (progress <= 0) return [coords[0]];
  const segs = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const dx = coords[i][0] - coords[i - 1][0];
    const dy = coords[i][1] - coords[i - 1][1];
    const d = Math.sqrt(dx * dx + dy * dy);
    segs.push(d);
    total += d;
  }
  const target = total * progress;
  const out = [coords[0]];
  let acc = 0;
  for (let i = 1; i < coords.length; i++) {
    const segLen = segs[i - 1];
    if (acc + segLen <= target) {
      out.push(coords[i]);
      acc += segLen;
    } else {
      const t = (target - acc) / segLen;
      const x = coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t;
      const y = coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t;
      out.push([x, y]);
      break;
    }
  }
  return out;
}
