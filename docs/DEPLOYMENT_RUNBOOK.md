# 部署复现与运维 Runbook

本文记录“经史舆图”当前线上资源、日常发布顺序、从零重建方法和本次部署中遇到的问题。下次部署先阅读本文，再以仓库中的 `render.yaml`、`netlify.toml` 为最终配置依据。

> 更新日期：2026-07-15
>
> 当前生产分支：`feature_back`
>
> GitHub 仓库：<https://github.com/ltj5878/article-history>

## 1. 当前线上资源

| 层 | 当前资源 | 地址或标识 |
|---|---|---|
| 前端 | Netlify 项目 `article-history` | <https://article-history.netlify.app> |
| Netlify 管理页 | Site ID `7bccb12d-f39d-4f1f-a978-83ede3ac7527` | <https://app.netlify.com/projects/article-history> |
| 后端 | Render Web Service `article-history-api` | <https://article-history-api.onrender.com> |
| 后端健康检查 | FastAPI + Postgres 状态 | <https://article-history-api.onrender.com/api/health> |
| 部署就绪检查 | 环境变量检查（不返回秘密值） | <https://article-history-api.onrender.com/api/deployment/readiness> |
| 当前数据库 | Render Postgres `history-db` | <https://dashboard.render.com/d/dpg-d9b5dn3eo5us73dvl3ug-a> |

生产链路：

```text
浏览器
  -> Netlify（React/Vite 静态前端）
  -> Render（FastAPI 内容与认证 API）
  -> Render Postgres
```

不要把 Token、`DATABASE_URL`、`JWT_SECRET` 写入本文或提交到 Git。`VITE_API_BASE_URL` 会进入浏览器构建产物，只能存放公开地址，不能存放秘密。

## 2. 10 分钟日常发布流程

### 2.1 发布前检查

在仓库根目录执行：

```bash
git status --short --branch
git branch --show-current
./start.sh restart
./start.sh status
```

本地默认地址：

- 前端：<http://127.0.0.1:5174>
- 后端：<http://127.0.0.1:8000>
- 本地 Vite 默认使用 `VITE_API_BASE_URL=http://127.0.0.1:8000`

运行测试与生产构建：

```bash
cd app
npm install
npm run lint
npm test
VITE_API_BASE_URL=https://article-history-api.onrender.com npm run build

cd ..
backend/.venv/bin/python -m pytest backend/tests -q
```

如果 Python 虚拟环境尚未创建：

```bash
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
```

### 2.2 先推送 GitHub

正常发布必须先推送代码，再让 Render、Netlify 从同一 Git 提交构建：

```bash
git push origin feature_back
```

推送后在 GitHub 确认远端提交与本地一致：

```bash
git rev-parse HEAD
git rev-parse origin/feature_back
```

### 2.3 发布 Render 后端

Render 当前跟踪 `feature_back`。如果开启 Auto-Deploy，推送后会自动构建；否则在 Dashboard 中选择 **Manual Deploy -> Deploy latest commit**。

关键配置由根目录 `render.yaml` 描述：

```text
Build:
python -m pip install --upgrade pip &&
python -m pip install -r backend/requirements.txt &&
cd app && npm install && BUILD_DATA_FORCE_LEGACY=1 npm run build:data

Start:
PYTHONPATH=backend python -m api.seed --db-url "$DATABASE_URL" --data-dir app/public/data --if-empty &&
PYTHONPATH=backend uvicorn api.app:app --host 0.0.0.0 --port "$PORT"

Health check:
/api/health
```

Render 生产环境变量：

| 变量 | 要求 |
|---|---|
| `DATABASE_URL` | 使用 Render Postgres 的 Internal Database URL；不要写入仓库 |
| `JWT_SECRET` | 强随机值；不要使用本地默认值 |
| `CORS_ORIGINS` | `https://article-history.netlify.app` |
| `PYTHON_VERSION` | 当前配置 `3.13.4` |
| `NODE_VERSION` | 当前配置 `20` |

启动命令包含 `--if-empty`，只会在数据库为空时导入静态种子，不会覆盖已经在后台维护的生产内容。

部署完成后验证：

```bash
curl -fsS https://article-history-api.onrender.com/api/health
curl -fsS https://article-history-api.onrender.com/api/deployment/readiness
curl -fsS https://article-history-api.onrender.com/api/books
```

预期：`/api/health` 中 `status`、`database` 均为 `ok`；`/api/deployment/readiness` 中 `ready` 为 `true`。

### 2.4 发布 Netlify 前端

首次在本机使用 Netlify CLI：

```bash
npm install -g netlify-cli
netlify login
netlify link --id 7bccb12d-f39d-4f1f-a978-83ede3ac7527
netlify status
```

Netlify 必须保持以下设置：

| 设置 | 值 |
|---|---|
| Git 仓库 | `ltj5878/article-history` |
| Production branch | `feature_back` |
| Base directory | 由根目录 `netlify.toml` 设置为 `app` |
| Build command | `npm install && npm run build` |
| Publish directory | `app/dist`（在 `base=app` 语境中为 `dist`） |
| Node | `20` |
| `VITE_API_BASE_URL` | `https://article-history-api.onrender.com`，Production context |

设置或修正生产环境变量：

```bash
netlify env:set VITE_API_BASE_URL https://article-history-api.onrender.com --context production
```

修改环境变量后必须重新构建。推荐使用 Git 持续部署：

1. 打开 Netlify 项目的 **Deploys** 页面。
2. 点击 **Trigger deploy -> Deploy project**。
3. 确认新部署显示 `Production: feature_back @ <commit>`。
4. 确认状态是 **Published**，不能只看某个分支部署的 **Completed**。

正常流程不要使用 `netlify deploy --prod` 上传本地产物，否则容易出现“Git 已连接，但生产内容来自手工上传”的混乱。

### 2.5 最终联调验证

```bash
curl -fsSI https://article-history.netlify.app/

curl -i -X OPTIONS \
  https://article-history-api.onrender.com/api/health \
  -H 'Origin: https://article-history.netlify.app' \
  -H 'Access-Control-Request-Method: GET'
```

预期：

- 前端返回 HTTP 200。
- CORS 响应包含 `access-control-allow-origin: https://article-history.netlify.app`。
- 浏览器 Network 中 `/api/books`、书籍、文章/章节和地图接口均返回 200。

确认线上构建确实注入 Render 地址：

```bash
curl -fsS https://article-history.netlify.app/ \
  | rg -o 'assets/index-[A-Za-z0-9_-]+\.js'

# 将上一步得到的 JS 路径替换到下面命令
curl -fsS https://article-history.netlify.app/assets/index-XXXX.js \
  | rg 'article-history-api\.onrender\.com'
```

## 3. 从零重建

### 3.1 GitHub

```bash
# 仅在 origin 尚不存在时执行第一条
git remote add origin git@github.com:ltj5878/article-history.git
git push -u origin feature_back
```

Render 和 Netlify 都需要完成 GitHub OAuth，并授权访问 `ltj5878/article-history`。

### 3.2 Render：Blueprint 方式

仓库根目录已有 `render.yaml`，因此可从以下地址创建 Blueprint：

<https://dashboard.render.com/blueprint/new?repo=https://github.com/ltj5878/article-history>

注意数据库名称差异：

- 当前线上数据库是手工创建的 `history-db`。
- `render.yaml` 声明的是 `article-history-db`。
- 全新环境可直接让 Blueprint 创建 `article-history-db`。
- 恢复当前生产环境时，应将 Web Service 的 `DATABASE_URL` 指向现有 `history-db`，不要误建第二个生产数据库。

创建后检查 Web Service 分支为 `feature_back`，补齐所有秘密变量，再等待 `/api/health` 通过。

### 3.3 Netlify：Git 方式

1. 在 Netlify 创建或选择项目 `article-history`。
2. 连接 GitHub 仓库 `ltj5878/article-history`。
3. Production branch 设置为 `feature_back`。
4. 保留仓库根目录的 `netlify.toml`。
5. 在 Production context 设置 `VITE_API_BASE_URL`。
6. 触发生产构建，确认生产别名 <https://article-history.netlify.app> 指向新部署。

分支预览地址（例如 `feature-back--article-history.netlify.app`）不是生产别名。验证时必须同时检查部署详情中的 **Published** 标记和正式域名。

## 4. 本次部署踩坑与处理方法

| 现象 | 原因 | 处理 |
|---|---|---|
| 正式域名仍显示旧代码 | 新部署是分支部署，状态为 Completed，但生产别名仍指向旧的 `main` 部署 | 将 Production branch 设为 `feature_back`，重新触发并确认 Published |
| 线上有页面但登录、后台或数据表现不一致 | 生产构建没有 `VITE_API_BASE_URL`，前端回退到 `/data/*.json` | 在 Production context 设置变量并重新构建 |
| Netlify 页面显示的 Base directory 容易误解 | 真正配置来自根目录 `netlify.toml` | 在构建日志确认 Current directory 是 `/opt/build/repo/app`，Config file 是 `/opt/build/repo/netlify.toml` |
| 上传仓库失败或包体很大 | 仓库目录包含 `backend/.venv`、`node_modules` 等本地文件 | 使用 Git 持续部署；不要把整个工作区作为手工部署包上传 |
| 线上首次打开短暂显示“选择一篇章” | Render 免费实例冷启动，文章接口尚未返回 | 等待后端启动；检查 Network，接口返回 200 后页面会正常渲染 |
| 本地与线上配色、书籍、阅读位置不同 | `localhost` 与 Netlify 是不同 origin，各自保存独立 `localStorage` | 对比时使用无痕窗口或清除两端存储；不是部署版本差异 |
| 本地是明亮主题、线上是古风主题 | `jingshi.prefs.v1.theme` 分别保存为 `bright`、`classic` | 点击“主题”切换，或清除 `jingshi.prefs.v1` 后按默认主题测试 |
| 页面请求被 CORS 拦截 | Render 的 `CORS_ORIGINS` 缺少正式 Netlify origin | 设置为 `https://article-history.netlify.app` 后重新部署后端 |
| 代码看似相同但仍怀疑发布错误 | 浏览器状态或缓存造成视觉误判 | 使用相同生产变量本地构建，并对本地与线上 JS 做 SHA-256 比对 |

本项目会按 origin 保存以下浏览器数据：

- `jingshi.prefs.v1`：主题、书籍、分栏比例、时间轴状态。
- `jingshi.reading-progress.v1`：各书阅读位置。
- `jingshi.bookmarks.v1`：书签。
- `jingshi.auth.v1.*`：当前登录会话（`sessionStorage`）。

因此，UI 对比时应先统一主题、书籍、章节、窗口尺寸和浏览器存储状态。

## 5. 发布完成检查清单

- [ ] 工作区无意外改动，测试与生产构建通过。
- [ ] 最新提交已推送到 `origin/feature_back`。
- [ ] Render 最新部署来自同一提交，状态为 Live。
- [ ] Render `/api/health` 返回数据库正常。
- [ ] Render `/api/deployment/readiness` 返回 `ready: true`。
- [ ] Netlify Production branch 是 `feature_back`。
- [ ] Netlify Production 环境存在正确的 `VITE_API_BASE_URL`。
- [ ] Netlify 部署状态为 Published，正式域名指向新部署。
- [ ] 前端、后端、CORS 和关键内容接口均返回 200。
- [ ] 使用无痕窗口完成一次页面、登录和内容加载验证。

## 6. 配置文件索引

- `render.yaml`：Render Web Service、数据库、构建与启动命令。
- `netlify.toml`：Netlify 构建目录、SPA fallback、安全 Header 和缓存策略。
- `start.sh`：本地前后端启动、日志与部署就绪检查。
- `backend/api/deployment.py`：生产环境变量规则。
- `app/src/api/client.js`：API 优先、静态 JSON fallback 数据策略。
- `app/src/App.jsx`：主题、书籍和阅读状态持久化逻辑。
