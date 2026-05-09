// Filter Natural Earth admin_1_states_provinces to China provinces only.
// Adds standardized Chinese name property and simplifies geometry.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'ne_provinces.geojson'), 'utf8'));

// Mapping of pinyin/English province names → standard Chinese
const NAME_MAP = {
  'Beijing': '北京', 'Tianjin': '天津', 'Hebei': '河北', 'Shanxi': '山西',
  'Inner Mongol': '内蒙古', 'Inner Mongolia': '内蒙古',
  'Liaoning': '辽宁', 'Jilin': '吉林', 'Heilongjiang': '黑龙江',
  'Shanghai': '上海', 'Jiangsu': '江苏', 'Zhejiang': '浙江', 'Anhui': '安徽',
  'Fujian': '福建', 'Jiangxi': '江西', 'Shandong': '山东',
  'Henan': '河南', 'Hubei': '湖北', 'Hunan': '湖南',
  'Guangdong': '广东', 'Guangxi': '广西', 'Hainan': '海南',
  'Chongqing': '重庆', 'Sichuan': '四川', 'Guizhou': '贵州',
  'Yunnan': '云南', 'Xizang': '西藏', 'Tibet': '西藏',
  'Shaanxi': '陕西', 'Gansu': '甘肃', 'Qinghai': '青海',
  'Ningxia Hui': '宁夏', 'Ningxia': '宁夏',
  'Xinjiang Uygur': '新疆', 'Xinjiang': '新疆',
  'Hong Kong': '香港', 'Macau': '澳门', 'Macao': '澳门',
  'Taiwan': '台湾',
};

function chineseName(props) {
  // Prefer the actual Chinese 'name_zh' field if present, else map from English
  if (props.name_zh) return props.name_zh;
  if (props.name_zht) return props.name_zht;
  const candidates = [props.name, props.name_en, props.gn_name];
  for (const c of candidates) {
    if (!c) continue;
    if (NAME_MAP[c]) return NAME_MAP[c];
    // Try removing "Sheng" / "Zhuangzu Zizhiqu" suffixes etc.
    for (const k of Object.keys(NAME_MAP)) {
      if (c.startsWith(k)) return NAME_MAP[k];
    }
  }
  return props.name || '';
}

// Simplify a polygon ring by Douglas-Peucker-ish (just decimate by every N-th point for speed)
function decimateRing(ring, keep = 3) {
  if (ring.length < 30) return ring;
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    if (i % keep === 0) out.push(ring[i]);
  }
  // Always keep last point so polygon closes
  if (out[out.length - 1] !== ring[ring.length - 1]) out.push(ring[ring.length - 1]);
  return out;
}

function decimateGeom(geom) {
  if (geom.type === 'Polygon') {
    return { ...geom, coordinates: geom.coordinates.map(r => decimateRing(r)) };
  }
  if (geom.type === 'MultiPolygon') {
    return { ...geom, coordinates: geom.coordinates.map(poly => poly.map(r => decimateRing(r))) };
  }
  return geom;
}

// Approximate centroid (for label placement) — bounds center is good enough
function bboxCenter(geom) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const visit = (coords) => {
    if (typeof coords[0] === 'number') {
      if (coords[0] < minX) minX = coords[0];
      if (coords[0] > maxX) maxX = coords[0];
      if (coords[1] < minY) minY = coords[1];
      if (coords[1] > maxY) maxY = coords[1];
    } else {
      coords.forEach(visit);
    }
  };
  visit(geom.coordinates);
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

const chinaFeatures = data.features.filter(f => {
  const adm0 = f.properties?.adm0_a3 || f.properties?.iso_a2;
  return adm0 === 'CHN' || adm0 === 'CN';
});

const out = {
  type: 'FeatureCollection',
  features: chinaFeatures.map(f => {
    const zh = chineseName(f.properties);
    const center = bboxCenter(f.geometry);
    // Short label removes 省/市/自治区 suffixes for cleaner map labels
    const shortName = zh
      .replace(/省$/, '')
      .replace(/市$/, '')
      .replace(/特别行政区$/, '')
      .replace(/壮族自治区$/, '')
      .replace(/回族自治区$/, '')
      .replace(/维吾尔自治区$/, '')
      .replace(/自治区$/, '');
    return {
      type: 'Feature',
      properties: {
        name_zh: zh,
        name_short: shortName,
        name_en: f.properties.name || f.properties.name_en || '',
        center_lng: center[0],
        center_lat: center[1],
      },
      geometry: decimateGeom(f.geometry),
    };
  }),
};

fs.writeFileSync(path.join(__dirname, 'china_provinces.geojson'), JSON.stringify(out));
console.log(`Filtered: ${data.features.length} → ${out.features.length} China provinces`);
console.log(`Names: ${out.features.map(f => f.properties.name_zh).join(', ')}`);
console.log(`Output: ${(fs.statSync(path.join(__dirname, 'china_provinces.geojson')).size / 1024).toFixed(0)} KB`);
