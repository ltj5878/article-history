# QQ / 微信登录配置

项目已接入 QQ 互联和微信开放平台的网站 OAuth 登录。前端不会接触 `AppSecret` 或第三方 `access_token`；授权码交换、用户身份映射和本站 JWT 签发都在 Python 后端完成。

## 1. 在开放平台注册网站应用

- QQ：在 [QQ 互联](https://connect.qq.com/) 创建网站应用，取得 `App ID` 和 `App Key`。
- 微信：在 [微信开放平台](https://open.weixin.qq.com/) 创建并审核网站应用，开通“微信登录”，取得 `AppID` 和 `AppSecret`。

平台登记的回调地址必须与后端环境变量完全一致，包括协议、域名、路径和端口：

```text
QQ_REDIRECT_URI=https://你的后端域名/api/auth/oauth/qq/callback
WECHAT_REDIRECT_URI=https://你的后端域名/api/auth/oauth/wechat/callback
```

本地调试可使用：

```text
QQ_REDIRECT_URI=http://127.0.0.1:8000/api/auth/oauth/qq/callback
WECHAT_REDIRECT_URI=http://127.0.0.1:8000/api/auth/oauth/wechat/callback
```

开放平台通常要求已审核的网站域名，因而真实扫码/授权流程可能无法直接使用 `127.0.0.1`。可为测试应用配置 HTTPS 测试域名或隧道地址。

## 2. 配置后端环境变量

| 变量 | 说明 |
|---|---|
| `QQ_APP_ID` | QQ 互联网站应用 App ID |
| `QQ_APP_KEY` | QQ 互联网站应用 App Key，只能保存在后端 |
| `QQ_REDIRECT_URI` | QQ 回调的后端完整 URL |
| `WECHAT_APP_ID` | 微信开放平台网站应用 AppID |
| `WECHAT_APP_SECRET` | 微信开放平台 AppSecret，只能保存在后端 |
| `WECHAT_REDIRECT_URI` | 微信回调的后端完整 URL |
| `OAUTH_FRONTEND_URL` | 登录成功后返回的前端 URL，例如 `https://article-history.netlify.app/` |
| `OAUTH_COOKIE_SECURE` | 可选；默认根据回调 URL 是否为 HTTPS 自动决定。线上不要设为 `false` |

原有 `JWT_SECRET` 仍然必须配置，它同时用于本站访问令牌和短期 OAuth `state` 签名。缺少某个渠道的任一必要变量时，前端会显示对应按钮但禁用，并提示“服务端尚未配置”。

本地启动示例：

```bash
export QQ_APP_ID='你的 App ID'
export QQ_APP_KEY='你的 App Key'
export QQ_REDIRECT_URI='http://127.0.0.1:8000/api/auth/oauth/qq/callback'
export WECHAT_APP_ID='你的 AppID'
export WECHAT_APP_SECRET='你的 AppSecret'
export WECHAT_REDIRECT_URI='http://127.0.0.1:8000/api/auth/oauth/wechat/callback'
export OAUTH_FRONTEND_URL='http://127.0.0.1:5174/'
./start.sh start
```

不要把真实密钥写入 `.env` 后提交到 Git，也不要把它们放进 `VITE_*` 变量；`VITE_*` 会进入浏览器构建产物。

## 3. 验证

1. 打开登录面板，确认已配置渠道的按钮可点击。
2. 完成 QQ 授权或微信扫码。
3. 回到站点后，顶部应显示昵称及“QQ”或“微信”标识。
4. 刷新页面，当前标签页内仍保持登录；关闭标签页后会话按现有 `sessionStorage` 策略结束。

配置探测接口：

```text
GET /api/auth/oauth/providers
```

该接口只返回渠道是否启用，不会返回任何密钥。
