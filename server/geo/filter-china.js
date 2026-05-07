// Filter Natural Earth global data to China region (lng 70-140, lat 15-55)
// and tag major rivers with their Chinese names.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BBOX = [70, 15, 140, 55]; // [minLng, minLat, maxLng, maxLat]

function inBBox(coord) {
  return coord[0] >= BBOX[0] && coord[0] <= BBOX[2] && coord[1] >= BBOX[1] && coord[1] <= BBOX[3];
}

function anyInBBox(geom) {
  if (geom.type === 'Point') return inBBox(geom.coordinates);
  if (geom.type === 'LineString' || geom.type === 'MultiPoint') {
    return geom.coordinates.some(inBBox);
  }
  if (geom.type === 'Polygon' || geom.type === 'MultiLineString') {
    return geom.coordinates.some(ring => ring.some(inBBox));
  }
  if (geom.type === 'MultiPolygon') {
    return geom.coordinates.some(poly => poly.some(ring => ring.some(inBBox)));
  }
  return false;
}

function clipFeatures(geojson) {
  return {
    type: 'FeatureCollection',
    features: geojson.features.filter(f => f.geometry && anyInBBox(f.geometry)),
  };
}

const RIVER_NAMES = {
  // Map English Natural Earth names to Chinese
  'Huang He': { zh: '黄河', major: true },
  'Yangtze': { zh: '长江', major: true },
  'Chang Jiang': { zh: '长江', major: true },
  'Mekong': { zh: '湄公河', major: false },
  'Salween': { zh: '怒江', major: false },
  'Brahmaputra': { zh: '雅鲁藏布江', major: false },
  'Ganges': { zh: '恒河', major: false },
  'Indus': { zh: '印度河', major: false },
  'Pearl': { zh: '珠江', major: true },
  'Xi Jiang': { zh: '珠江', major: true },
  'Han Shui': { zh: '汉水', major: true },
  'Wei He': { zh: '渭水', major: true },
  'Songhua': { zh: '松花江', major: false },
  'Liao': { zh: '辽河', major: false },
  'Amur': { zh: '黑龙江', major: false },
  'Argun': { zh: '额尔古纳河', major: false },
};

function tagRivers(geojson) {
  return {
    type: 'FeatureCollection',
    features: geojson.features.map(f => {
      const name = f.properties?.name || f.properties?.name_en;
      const meta = name ? RIVER_NAMES[name] : null;
      if (meta) {
        return { ...f, properties: { ...f.properties, name_zh: meta.zh, major: meta.major ? 1 : 0 } };
      }
      return { ...f, properties: { ...f.properties, name_zh: null, major: 0 } };
    }),
  };
}

const datasets = ['ne_coastline', 'ne_rivers', 'ne_lakes', 'ne_land'];
for (const name of datasets) {
  const inPath = path.join(__dirname, `${name}.geojson`);
  const outPath = path.join(__dirname, `${name}_china.geojson`);
  const data = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  const clipped = clipFeatures(data);
  const tagged = name === 'ne_rivers' ? tagRivers(clipped) : clipped;
  fs.writeFileSync(outPath, JSON.stringify(tagged));
  console.log(`${name}: ${data.features.length} -> ${clipped.features.length} features (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`);
}
