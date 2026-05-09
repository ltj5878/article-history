# server/data — 历史 seed 模块

这些 JS 模块是数据库化之前的内容正源，现已退役。它们的作用降格为：

- **首次启动的兜底种子**：当 SQLite 数据库尚未创建时，`./start.sh` 会通过 `BUILD_DATA_FORCE_LEGACY=1 npm run build:data` 把这些模块导出为 `app/public/data/*.json`，再由 `backend/api/seed.py` 灌入数据库。
- **纯静态部署兜底**：`./start.sh start-static` 会用同一路径生成静态资源，便于无后端环境（例如 Netlify）部署演示。

正常开发流程下，**数据库才是内容正源**，由 `backend/api/admin_content.py` 维护；要导出 JSON 兜底产物请运行 `./start.sh export-static`。

新内容应直接通过管理端写入数据库，**不要再修改这里的 JS 模块**。
