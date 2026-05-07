# 经史舆图

> 古文与历史地图相融的阅读系统 —— 边读《左传》《史记》原文，边在专业历史地图上看人物走动、疆界变迁。

![status](https://img.shields.io/badge/status-active-brightgreen) ![stack](https://img.shields.io/badge/stack-React%20%2B%20Express%20%2B%20MapLibre-blue)

## 功能概览

- **5 本古籍 · 31 章原文**：《左传》《史记·项羽本纪》《史记·高祖本纪》《史记·秦始皇本纪》《史记》世家列传选
- **章节级完整原文**：中华书局点校本，原文 + 现代汉语译文双栏对照
- **专业历史地图**：MapLibre GL JS 渲染，使用 Natural Earth 1:50m 真实地理数据，自定义古风样式
- **9 个历史时期疆界**：春秋早/中/晚 → 战国中/晚 → 秦帝国 → 楚汉 → 楚汉相争
- **古今对照**：可切换"今省界"图层，将古地名与现代省份对应
- **互动注释**：
  - 点击文中**地名** → 地图飞到该地，朱红圆环高亮 + InfoCard
  - 点击文中**人名** → 内联弹出人物简介
  - 点击文中**事件** → 内联弹出事件解释
  - 地图上 **彭城/垓下/咸阳** 等历史名城均可点击查看
- **军事路线动画**：每段文本对应的进军路线在地图上以 faction 颜色绘制
- **可拖动时间轴**：底部时间轴像长卷一样左右拖动，浏览整本书的事件
- **三套主题**：古风（宣纸）/ 暗色 / 明亮，全 UI 切换
- **段落级地图联动**：切换章节内段落时，地图自动 fitBounds 到对应区域

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + Vite + MapLibre GL JS |
| 后端 | Node.js + Express |
| 地图样式 | 自定义 MapLibre Style Spec（古风宣纸 / 墨线 / 青绿水系） |
| 地理数据 | Natural Earth 1:50m（裁剪到中国 bbox） |
| 字体 | Noto Serif SC、Ma Shan Zheng（行楷）、ZCOOL XiaoWei、JetBrains Mono |

## 项目结构

```
.
├── app/                   # 前端 (React + Vite)
│   ├── src/
│   │   ├── App.jsx        # 顶层状态机 + 三栏布局
│   │   ├── api/client.js  # 后端 API 客户端
│   │   ├── components/
│   │   │   ├── TopNav.jsx       # 书籍/章节/模式/层切换
│   │   │   ├── ReaderPane.jsx   # 古文阅读 + 实体气泡
│   │   │   ├── MapPane.jsx      # MapLibre 地图 + 历史叠加层
│   │   │   ├── Timeline.jsx     # 可拖动时间轴
│   │   │   └── mapStyle.js      # 古风地图样式表
│   │   └── data/          # 客户端兜底数据（已弃用，从 server 拉取）
│   └── public/assets/     # 图标 / 印章 / 装饰 SVG
├── server/                # 后端 (Express)
│   ├── index.js           # API 入口
│   ├── data/
│   │   ├── periods.js     # 9 个历史时期的疆界 + 城邑
│   │   └── books/         # 5 本书的原文 + entity 标注
│   │       ├── zuozhuan.js          # 左传 8 篇
│   │       ├── xiangyu-benji.js     # 项羽本纪 11 章
│   │       ├── gaozu-benji.js       # 高祖本纪 4 章
│   │       ├── qin-shihuang-benji.js # 秦始皇本纪 4 章
│   │       └── shiji-liezhuan.js    # 世家列传选 4 章
│   └── geo/               # 真实地理数据（GeoJSON）
│       ├── ne_coastline_china.geojson
│       ├── ne_rivers_china.geojson
│       ├── ne_lakes_china.geojson
│       ├── ne_land_china.geojson
│       └── china_provinces.geojson
├── start.sh               # 一键启动脚本（前后端）
├── design-system/         # 原始设计稿 + 设计 token
└── README.md              # 本文件
```

## 快速开始

### 依赖

- Node.js ≥ 18
- npm

### 启动

```bash
# 一键启动前后端
./start.sh start

# 输出
#   前端: http://127.0.0.1:5174
#   后端: http://127.0.0.1:4000/api
```

### 其他命令

```bash
./start.sh stop              # 停止两个服务
./start.sh restart           # 重启
./start.sh status            # 查看运行状态
./start.sh start-backend     # 只启后端
./start.sh start-frontend    # 只启前端
./start.sh logs              # 实时查看日志
./start.sh help              # 查看完整命令
```

### 自定义端口

```bash
FRONTEND_PORT=5180 BACKEND_PORT=4001 ./start.sh start
```

## API 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/books` | 列出全部书籍 |
| GET | `/api/books/:id` | 单本书的元数据 + 章节列表 + 时间事件 |
| GET | `/api/books/:bookId/chapters/:chapterId` | 单章完整内容（原文/译文/entity/路线） |
| GET | `/api/maps/period/:periodId` | 单个历史时期的疆界数据 |
| GET | `/api/geo/:layer` | 地理 GeoJSON 数据（coastline/rivers/lakes/land/provinces） |

## 数据格式示例

### 章节
```js
{
  id: 'wujiang',
  title: '乌江自刎',
  subtitle: '天亡我也',
  year: -202,
  period: 'chu_han_war',
  paragraphs: [
    {
      id: 'p3',
      original: '于是项王乃欲东渡乌江...',
      translation: '于是项王打算向东渡过乌江...',
      entities: [
        { text: '项王', type: 'person', description: '项羽' },
        { text: '乌江', type: 'place', modernName: '今安徽和县东北',
          lat: 31.72, lng: 118.42, poi: 'pass', description: '项羽自刎之地' },
        { text: '天之亡我', type: 'event', description: '项羽末言' },
      ],
      routes: [
        { name: '项王末路', faction: '楚', color: '#C41E24',
          points: [
            { lat: 32.34, lng: 117.85, label: '东城' },
            { lat: 31.72, lng: 118.42, label: '乌江' },
          ] },
      ],
    },
  ],
}
```

## 地图样式

- 底色：宣纸米黄 `#F5F0E8`
- 海岸线：墨黑细线（双线增加质感）
- 河流：靛青 `#5B89B3`，黄河长江加粗描边
- 历史疆界：faction 色虚线 `[4, 3]`
- 今省界：棕褐细虚线 `[3, 2.5]`，带白色 halo
- 城邑标记：朱砂方块（国都）、青绿三角（关隘）、橙色菱形（战场）、白圆点（城邑）

## 已知限制

- 部分事件 entity（如"破釜沉舟"、"四面楚歌"）是概括性词语，不在原文中逐字出现，因此不会以 entity tag 形式渲染
- 历史疆界为简化版本，参考谭其骧《中国历史地图集》手绘
- 中文字体走 Google Fonts CDN，离线环境需自备 woff2

## 路线图

- [ ] 增加章节内全文搜索
- [ ] 段落音频朗读（吴语/官话）
- [ ] 路线动画时间轴控制
- [ ] 导出当前地图视图为 PNG
- [ ] 用户笔记 / 高亮标记
- [ ] 移动端布局适配

## 致谢

- 文本：中华书局点校本《左传》《史记》
- 历史地图：参考谭其骧《中国历史地图集》
- 地理数据：Natural Earth (public domain)
- 字体：Google Fonts (Noto Serif SC、Ma Shan Zheng、ZCOOL XiaoWei)

## License

MIT
