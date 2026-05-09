# 经史舆图

> 古文与历史地图相融的阅读系统 —— 边读《左传》《史记》原文，边在专业历史地图上看人物走动、疆界变迁。

![status](https://img.shields.io/badge/status-active-brightgreen) ![stack](https://img.shields.io/badge/stack-React%20%2B%20Python%20%2B%20Postgres%20ready%20%2B%20MapLibre-blue)

## 功能概览

- **2 本古籍入口**：《左传》保留章节阅读；《史记》归并为 6 篇文章：《项羽本纪》《高祖本纪》《秦始皇本纪》《越王勾践世家》《廉颇蔺相如列传》《刺客列传·荆轲》
- **文章级阅读结构**：文章内保留小节标题，原文 + 现代汉语译文双栏对照
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
- **段落级地图联动**：切换文章/章节内段落时，地图自动 fitBounds 到对应区域

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React + Vite + MapLibre GL JS |
| 后端 | Python + FastAPI（内容 API，Postgres-ready；本地可用 SQLite） |
| 旧后端 | Node.js + Express（兼容旧接口，后续退场） |
| 数据库 | Postgres / Supabase-ready（本地过渡支持 SQLite） |
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
│   │   │   ├── TopNav.jsx       # 书籍/文章/章节/模式/层切换
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
│   │   └── books/         # 原文 + entity 标注
│   │       ├── zuozhuan.js          # 左传 8 篇
│   │       ├── shiji.js             # 史记 6 篇文章聚合入口
│   │       ├── xiangyu-benji.js     # 项羽本纪小节数据
│   │       ├── gaozu-benji.js       # 高祖本纪小节数据
│   │       ├── qin-shihuang-benji.js # 秦始皇本纪小节数据
│   │       └── shiji-liezhuan.js    # 世家/列传小节数据
│   └── geo/               # 真实地理数据（GeoJSON）
│       ├── ne_coastline_china.geojson
│       ├── ne_rivers_china.geojson
│       ├── ne_lakes_china.geojson
│       ├── ne_land_china.geojson
│       └── china_provinces.geojson
├── backend/               # Python 内容后端 (FastAPI + SQLAlchemy)
│   ├── api/
│   │   ├── app.py         # FastAPI 路由
│   │   ├── repository.py  # 经史内容数据 Module
│   │   ├── models.py      # Postgres-ready 数据模型
│   │   └── seed.py        # 从静态 JSON 导入数据库
│   └── tests/
├── start.sh               # 一键启动脚本（前后端）
├── design-system/         # 原始设计稿 + 设计 token
└── README.md              # 本文件
```

## 快速开始

### 依赖

- Node.js ≥ 18
- npm

### 启动

项目保留纯前端静态模式，同时新增 Python 内容后端。默认 `./start.sh start`
仍只启动前端并读取静态 JSON；需要验证数据库驱动的数据路径时，使用
`./start.sh start-with-python`。

```bash
# 默认：只启前端（纯静态数据）
./start.sh start
#   前端: http://127.0.0.1:5174

# 前端 + Python 内容后端（前端优先读 API，失败时 fallback 到静态 JSON）
./start.sh start-with-python
#   前端: http://127.0.0.1:5174
#   后端: http://127.0.0.1:8000/api

# 兼容旧用法：同时启动 Express 后端（一般不需要）
./start.sh start-with-backend
#   前端: http://127.0.0.1:5174
#   后端: http://127.0.0.1:4000/api
```

### 其他命令

```bash
./start.sh stop                    # 停止运行中的所有服务
./start.sh restart                 # 重启（前端模式）
./start.sh restart-with-backend    # 重启（前端 + 后端）
./start.sh status                  # 查看运行状态
./start.sh start-python-backend    # 只启 Python 内容后端
./start.sh start-backend           # 只启后端
./start.sh start-frontend          # 只启前端
./start.sh logs                    # 实时查看日志
./start.sh help                    # 查看完整命令
```

### 自定义端口

```bash
FRONTEND_PORT=5180 PY_BACKEND_PORT=8001 ./start.sh start-with-python
```

### Python 内容后端

Python 后端从当前生成的静态数据导入数据库，接口保持和前端现有读取形状一致。

```bash
# 安装依赖（start.sh 会自动做；手动执行也可以）
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt

# 生成静态 seed 数据
cd app && npm run build:data && cd ..

# 导入本地 SQLite 数据库
PYTHONPATH=backend backend/.venv/bin/python -m api.seed \
  --db-url sqlite:///backend/.data/content.db \
  --data-dir app/public/data

# 启动 API
PYTHONPATH=backend DATABASE_URL=sqlite:///backend/.data/content.db JWT_SECRET=dev-only-change-me \
  backend/.venv/bin/python -m uvicorn api.app:app --host 127.0.0.1 --port 8000
```

上线时可将 `DATABASE_URL` 指向 Postgres/Supabase，并必须将 `JWT_SECRET` 设置为强随机密钥。当前阶段已经有注册、登录、管理员权限校验和管理员内容维护入口。

### 身份与权限

Python 后端提供基础身份接口：

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/register` | 注册普通用户 |
| POST | `/api/auth/login` | 登录并返回 Bearer token |
| GET | `/api/auth/me` | 返回当前登录用户 |
| GET | `/api/admin/ping` | 管理员权限校验探针 |

密码使用 Argon2id 哈希后入库；前端只把 access token 放在 `sessionStorage`。公开注册不会自动创建管理员账号，管理员角色目前通过数据库修改授予。

### 管理员内容维护

管理员登录后，顶部导航会出现“后台”入口。该入口通过 Python 后端维护数据库中的书籍和基础章节，不再需要把新增书目写死在前端。当前 UI 支持：

- 新增、编辑、删除书籍元数据
- 为指定书籍新增基础章节
- 粘贴 JSON 内容包批量导入古籍
- 保存后刷新公开阅读入口中的书籍和章节列表

管理员接口统一要求 Bearer token 且用户角色为 `admin`：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/books` | 列出全部书籍维护视图 |
| POST | `/api/admin/books` | 新增书籍 |
| PATCH | `/api/admin/books/:bookId` | 更新书籍 |
| DELETE | `/api/admin/books/:bookId` | 删除书籍及其关联内容 |
| POST | `/api/admin/books/:bookId/chapters` | 新增基础章节 |
| POST | `/api/admin/import` | 导入 JSON 内容包 |

内容包按书籍维度 upsert：导入某本书会更新该书元数据并替换该书旧章节/文章，不会清空其他古籍、用户、时期或地理数据。当前数据库模型仍要求 reading unit ID 全局唯一，所以建议用 `book-id + chapter-id` 形式命名章节/文章 ID。

```json
{
  "books": [
    {
      "id": "guoyu",
      "title": "国语",
      "bookSeries": "国别体",
      "dynasty": "春秋",
      "author": "左丘明",
      "description": "春秋国别史料汇编",
      "eraEvents": [],
      "chapters": [
        {
          "id": "guoyu-zhouyu",
          "title": "周语",
          "subtitle": "敬王问治",
          "year": -520,
          "period": "spring_autumn_late",
          "paragraphs": [
            {
              "id": "p1",
              "original": "敬王问于史伯。",
              "translation": "周敬王向史伯询问政事。",
              "entities": [],
              "routes": []
            }
          ]
        }
      ]
    }
  ]
}
```

当前章节维护是第一版后台能力：可以录入章节标题、年份、时期、原文和译文，也可以导入完整 JSON 内容包。实体标注、路线、文章级结构的可视化编辑和数据库主键迁移会在后续重构切片继续加深。

## 部署到 Netlify + Python 后端

项目仍可作为纯静态站点部署，也可以作为完整前后端系统部署。完整部署时，Netlify 只托管 React/Vite 前端，Python FastAPI 后端部署在单独的 Python 托管平台，数据库使用 Postgres/Supabase。

### 本地试构建

```bash
cd app
npm install
npm run build      # 自动跑 prebuild 生成 public/data/，再 vite build
npm run preview    # 本地预览静态产物，访问 http://localhost:4173
```

### Netlify

仓库根目录已包含 `netlify.toml`（`base = "app"`，`publish = "dist"`，含 SPA fallback、静态安全 header 和 assets 长缓存）。导入仓库后设置前端环境变量：

| 变量 | 说明 |
|---|---|
| `VITE_API_BASE_URL` | Python 后端公开 origin，例如 `https://api.example.com`。留空则走纯静态 JSON fallback。 |

### Python 后端

后端部署命令：

```bash
cd backend
PYTHONPATH=. uvicorn api.app:app --host 0.0.0.0 --port "$PORT"
```

后端生产环境变量：

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | Postgres/Supabase 连接串，不能使用本地 SQLite。 |
| `JWT_SECRET` | 至少 24 字符的强随机密钥，不能使用 `dev-only-change-me`。 |
| `CORS_ORIGINS` | 允许访问后端的前端 origin，多个用逗号分隔。 |

上线前可运行部署检查：

```bash
./start.sh check-deploy
# 或
PYTHONPATH=backend backend/.venv/bin/python -m api.deploy_check
```

接口 `/api/deployment/readiness` 会返回同样的结构化检查结果，但不会返回密钥值。

> 注意：`app/public/data/` 是生成产物，已加入 `.gitignore`。本地开发执行
> `npm run dev` 时会自动通过 `predev` 脚本生成。

## API 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/deployment/readiness` | 部署环境变量就绪检查 |
| GET | `/api/books` | 列出全部书籍 |
| GET | `/api/books/:id` | 单本书的元数据 + 文章/章节列表 + 时间事件 |
| GET | `/api/books/:bookId/chapters/:chapterId` | 单章完整内容（原文/译文/entity/路线） |
| GET | `/api/books/:bookId/articles/:articleId` | 单篇文章完整内容（小节/原文/译文/entity/路线） |
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
