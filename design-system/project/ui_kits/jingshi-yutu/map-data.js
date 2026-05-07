// 经史舆图 — Professional historical map data
// Hand-traced from Tan Qixiang《中国历史地图集》and 部编版 history textbook references.
// Coordinate system: real lat/lng. Projection is equirectangular over a focused
// East-Asia bbox (lng 95-125, lat 18-43) — same as a typical textbook plate.

// ---------- Projection ----------
window.JSY_PROJECT = function project(lat, lng) {
  const LNG_MIN = 95, LNG_MAX = 125;
  const LAT_MIN = 18, LAT_MAX = 43;
  const W = 1200, H = 900;
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * W;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * H;
  return { x, y };
};

// ---------- Hand-traced China silhouette (simplified, recognisable) ----------
// Polyline of [lng, lat] pairs traced from a public-domain coastline reference
// at ~50m resolution. Inland frontier is approximate (sufficient for a stylised
// "中国全图" backdrop, not a survey).
window.JSY_COUNTRY_OUTLINE = [
  // Northwest frontier (越过河套, 阴山以南)
  [95.0, 42.5], [97.5, 42.6], [100.5, 42.3], [103.0, 41.8], [106.5, 42.4],
  [109.0, 42.0], [111.5, 41.5], [114.0, 42.2], [116.5, 42.5], [119.5, 42.0],
  [121.5, 40.8],
  // Liaodong → Bohai
  [122.5, 40.0], [121.8, 39.0], [121.0, 38.7], [121.5, 38.0],
  [120.0, 37.6], [121.0, 37.4], [122.6, 37.4], [122.0, 36.9], [120.7, 36.0],
  // Shandong → Jiangsu
  [120.3, 35.5], [119.5, 34.7], [120.2, 34.0], [121.5, 32.0], [121.9, 31.0],
  // Yangtze mouth → Hangzhou
  [121.5, 30.6], [121.0, 30.0], [121.7, 29.0], [121.2, 28.2], [120.5, 27.5],
  // Min coast
  [120.0, 26.5], [119.6, 25.4], [118.5, 24.5], [117.5, 24.0], [116.5, 23.0],
  // Pearl mouth
  [114.0, 22.5], [113.5, 22.2], [113.2, 21.9], [112.0, 21.7], [110.5, 21.2],
  // Beibu gulf
  [109.5, 21.5], [108.5, 21.5], [107.8, 21.4],
  // Yunnan-Tibet southern frontier (very simplified)
  [105.5, 22.8], [103.0, 22.5], [101.5, 21.8], [100.0, 21.5], [98.5, 23.0],
  [97.5, 24.5], [96.0, 27.0], [95.5, 29.0], [95.0, 31.0],
  // Tibetan plateau back up
  [95.5, 33.5], [95.0, 35.5], [95.5, 38.0], [95.0, 40.0], [95.0, 42.5],
];

// ---------- Major rivers (real paths, simplified) ----------
window.JSY_RIVERS = {
  // 黄河 — Yellow River, source → mouth (Hetao → Bohai)
  huanghe: [
    [96.0, 35.0], [98.5, 35.5], [100.0, 35.0], [102.5, 35.7], [103.5, 36.0],
    [104.5, 36.6], [106.0, 37.5], [107.0, 39.0], [109.0, 40.5], [111.0, 40.4],
    [112.5, 39.6], [110.5, 37.5], [110.4, 35.0], [111.5, 34.7], [113.5, 34.8],
    [115.5, 35.4], [117.5, 36.6], [118.5, 37.5], [119.0, 37.8],
  ],
  // 长江 — Yangtze, Tibetan plateau → East Sea
  changjiang: [
    [97.0, 33.0], [99.0, 32.0], [101.0, 30.0], [103.5, 29.5], [105.0, 29.0],
    [106.5, 29.5], [108.0, 30.5], [110.0, 30.7], [112.0, 30.5], [113.7, 30.5],
    [115.5, 30.2], [117.0, 30.7], [118.7, 31.5], [120.0, 31.7], [121.5, 31.4],
  ],
  // 淮河 — Huai, central plain
  huaihe: [
    [113.5, 33.4], [114.5, 33.0], [116.0, 32.8], [117.5, 32.7], [118.5, 33.0], [120.0, 33.2],
  ],
  // 渭水 — Wei, west of Chang'an
  weishui: [
    [104.5, 35.0], [106.0, 34.7], [107.5, 34.5], [108.9, 34.3], [109.5, 34.4], [110.4, 34.7],
  ],
  // 汉水 — Han, Hanzhong → Wuhan
  hanshui: [
    [106.5, 33.2], [108.5, 32.9], [110.0, 32.7], [112.0, 32.3], [113.7, 30.5],
  ],
  // 漳水 — Zhang (项羽渡河之处)
  zhangshui: [
    [113.0, 36.0], [114.0, 36.2], [114.7, 36.3], [115.5, 36.6], [116.5, 36.8],
  ],
  // 济水 — Ji (春秋 still flowed, now subsumed into 黄河)
  jishui: [
    [112.5, 35.5], [114.5, 35.8], [116.5, 36.3], [117.5, 36.5], [118.7, 37.0],
  ],
  // 泗水 — Si (彭城 area)
  sishui: [
    [117.0, 35.5], [117.2, 34.8], [117.5, 34.2], [117.8, 33.5], [118.3, 32.8],
  ],
};

// ---------- Major mountains (point + label, range hint) ----------
window.JSY_MOUNTAINS = [
  { name: "崤山", lat: 34.55, lng: 111.20, range: [[110.6, 34.4], [111.8, 34.6]] },
  { name: "太行", lat: 36.50, lng: 113.50, range: [[113.0, 35.5], [114.2, 39.5]] },
  { name: "泰山", lat: 36.25, lng: 117.10, range: [[116.8, 36.1], [117.4, 36.5]] },
  { name: "嵩山", lat: 34.50, lng: 113.00, range: [[112.6, 34.3], [113.4, 34.6]] },
  { name: "巫山", lat: 31.05, lng: 109.85, range: [[109.5, 30.7], [110.2, 31.4]] },
  { name: "燕山", lat: 40.60, lng: 117.50, range: [[115.5, 40.0], [119.0, 41.2]] },
  { name: "秦岭", lat: 33.80, lng: 108.50, range: [[105.5, 33.4], [112.0, 34.1]] },
  { name: "终南", lat: 33.95, lng: 108.95, range: [[108.5, 33.85], [109.4, 34.05]] },
];

// ---------- Historical periods ----------
// Each period defines: state polygons (rough boundaries), capitals, key cities.
// Boundaries are simplified textbook approximations.

window.JSY_PERIODS = {
  // 春秋后期 ~ 632 BCE (城濮之战时)
  "spring_autumn": {
    label: "春秋 · 公元前 7 世纪",
    states: [
      { name: "晋", color: "#2B4490",
        polygon: [[110.5, 39.0],[112.5, 39.5],[114.0, 38.5],[114.0, 37.0],[113.0, 35.5],[111.5, 35.0],[110.0, 35.5],[109.5, 37.0],[110.0, 38.5]] },
      { name: "齐", color: "#C8893A",
        polygon: [[116.5, 38.0],[118.5, 37.8],[120.5, 37.5],[120.7, 36.0],[119.0, 35.0],[117.0, 35.2],[116.0, 36.5]] },
      { name: "秦", color: "#6B3F1D",
        polygon: [[104.5, 36.0],[107.0, 35.5],[109.0, 34.5],[108.5, 33.5],[106.5, 33.5],[104.5, 34.0],[103.5, 35.0]] },
      { name: "楚", color: "#C41E24",
        polygon: [[110.0, 32.5],[113.0, 33.0],[115.5, 32.5],[117.5, 31.5],[117.5, 29.5],[115.0, 28.5],[112.0, 29.0],[109.5, 30.5]] },
      { name: "鲁", color: "#8B572A",
        polygon: [[116.0, 36.0],[118.0, 36.0],[118.0, 34.7],[116.5, 34.5],[115.8, 35.2]] },
      { name: "宋", color: "#6B8E5A",
        polygon: [[114.5, 35.0],[116.0, 35.0],[116.5, 33.8],[115.0, 33.5],[114.0, 34.2]] },
      { name: "卫", color: "#7BA098",
        polygon: [[114.0, 36.2],[115.5, 36.0],[115.7, 35.0],[114.2, 35.0]] },
      { name: "郑", color: "#A39580",
        polygon: [[113.0, 34.8],[114.5, 34.8],[114.5, 34.0],[113.0, 34.0]] },
      { name: "曹", color: "#C8A465",
        polygon: [[114.8, 35.5],[115.6, 35.6],[115.6, 35.0],[114.8, 35.0]] },
      { name: "吴", color: "#4A6FB0",
        polygon: [[118.5, 32.5],[120.5, 32.5],[121.0, 30.5],[119.5, 30.0],[118.0, 31.0]] },
    ],
    cities: [
      { name: "绛", role: "晋都", lat: 35.65, lng: 111.50, type: "capital" },
      { name: "临淄", role: "齐都", lat: 36.85, lng: 118.30, type: "capital" },
      { name: "雍",  role: "秦都", lat: 34.50, lng: 107.40, type: "capital" },
      { name: "郢",  role: "楚都", lat: 30.40, lng: 112.20, type: "capital" },
      { name: "曲阜", role: "鲁都", lat: 35.60, lng: 116.99, type: "capital" },
      { name: "商丘", role: "宋都", lat: 34.41, lng: 115.65, type: "capital" },
      { name: "新郑", role: "郑都", lat: 34.40, lng: 113.74, type: "capital" },
      { name: "朝歌", role: "卫都", lat: 35.60, lng: 114.20, type: "capital" },
      { name: "陶丘", role: "曹都", lat: 35.20, lng: 115.40, type: "capital" },
      { name: "姑苏", role: "吴都", lat: 31.30, lng: 120.60, type: "capital" },
      { name: "洛邑", role: "周王畿", lat: 34.62, lng: 112.45, type: "royal" },
    ],
  },

  // 战国晚期 ~ 230 BCE (秦统一前夕)
  "warring_states": {
    label: "战国 · 公元前 3 世纪",
    states: [
      { name: "秦", color: "#6B3F1D",
        polygon: [[100.0, 38.0],[105.0, 38.0],[108.0, 37.5],[110.0, 36.5],[110.5, 35.0],[111.5, 34.0],[110.5, 33.0],[108.0, 32.5],[105.0, 32.5],[103.0, 33.5],[101.0, 34.5],[100.0, 36.0]] },
      { name: "楚", color: "#C41E24",
        polygon: [[110.5, 33.5],[113.5, 33.8],[117.0, 33.5],[120.5, 32.5],[121.5, 30.5],[120.5, 28.0],[117.0, 26.5],[113.0, 26.5],[110.5, 28.0],[108.5, 30.5],[109.0, 32.5]] },
      { name: "齐", color: "#C8893A",
        polygon: [[116.0, 38.5],[118.5, 38.2],[120.7, 37.5],[120.5, 35.5],[118.5, 34.7],[116.5, 35.0],[115.5, 36.5],[115.8, 38.0]] },
      { name: "燕", color: "#3B3328",
        polygon: [[114.5, 42.0],[118.0, 42.5],[121.5, 41.5],[122.0, 40.0],[120.0, 39.5],[117.0, 39.5],[115.0, 40.0],[114.0, 41.0]] },
      { name: "赵", color: "#7BA098",
        polygon: [[111.0, 40.0],[114.5, 40.0],[115.5, 38.5],[115.0, 37.0],[113.5, 36.5],[112.0, 36.5],[110.5, 37.5],[110.5, 39.0]] },
      { name: "魏", color: "#4A6FB0",
        polygon: [[111.0, 35.5],[114.0, 35.8],[115.5, 35.5],[115.5, 34.0],[113.5, 33.7],[112.0, 34.0],[111.0, 34.5]] },
      { name: "韩", color: "#8B572A",
        polygon: [[112.5, 34.7],[114.5, 34.5],[114.5, 33.5],[112.5, 33.5],[112.0, 34.2]] },
    ],
    cities: [
      { name: "咸阳", role: "秦都", lat: 34.34, lng: 108.71, type: "capital" },
      { name: "郢陈", role: "楚都(末)", lat: 33.74, lng: 114.65, type: "capital" },
      { name: "临淄", role: "齐都", lat: 36.85, lng: 118.30, type: "capital" },
      { name: "蓟",   role: "燕都", lat: 39.95, lng: 116.40, type: "capital" },
      { name: "邯郸", role: "赵都", lat: 36.62, lng: 114.54, type: "capital" },
      { name: "大梁", role: "魏都", lat: 34.80, lng: 114.31, type: "capital" },
      { name: "新郑", role: "韩都", lat: 34.40, lng: 113.74, type: "capital" },
    ],
  },

  // 楚汉之际 ~ 207-202 BCE
  "chu_han": {
    label: "楚汉之际 · 公元前 207–202",
    states: [
      { name: "西楚", color: "#C41E24",
        polygon: [[112.0, 35.0],[116.0, 35.5],[120.5, 33.0],[121.0, 30.0],[117.0, 28.0],[113.0, 29.0],[111.0, 31.5],[111.5, 34.0]] },
      { name: "汉", color: "#2B4490",
        polygon: [[103.0, 34.0],[107.5, 34.0],[110.0, 33.5],[111.0, 32.0],[108.5, 30.5],[105.0, 31.0],[102.5, 32.0]] },
      { name: "齐", color: "#C8893A",
        polygon: [[116.5, 38.0],[120.5, 37.5],[120.5, 35.5],[117.0, 35.5],[116.0, 36.8]] },
    ],
    cities: [
      { name: "彭城", role: "西楚都", lat: 34.27, lng: 117.18, type: "capital" },
      { name: "栎阳", role: "汉都(初)", lat: 34.65, lng: 109.20, type: "capital" },
      { name: "巨鹿", role: "战场", lat: 37.07, lng: 115.05, type: "battle" },
      { name: "垓下", role: "战场", lat: 33.40, lng: 117.55, type: "battle" },
      { name: "乌江", role: "项羽自刎处", lat: 31.72, lng: 118.42, type: "pass" },
    ],
  },
};

// ---------- Default era index per chapter id ----------
window.JSY_CHAPTER_PERIOD = {
  chengpu: "spring_autumn",
  yao: "spring_autumn",
  qinunify: "warring_states",
  julu: "chu_han",
  gaixia: "chu_han",
  sanxia: "spring_autumn",
};
