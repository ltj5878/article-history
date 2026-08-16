from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
import json
import os
import secrets
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit

import httpx
import jwt


OAUTH_STATE_COOKIE = "history_oauth_state"
OAUTH_STATE_MINUTES = 10
SUPPORTED_PROVIDERS = ("qq", "wechat")


class OAuthConfigurationError(RuntimeError):
    pass


class OAuthProviderError(RuntimeError):
    pass


@dataclass(frozen=True)
class OAuthProviderConfig:
    provider: str
    label: str
    client_id: str
    client_secret: str
    redirect_uri: str

    @property
    def enabled(self) -> bool:
        return bool(self.client_id and self.client_secret and self.redirect_uri)


@dataclass(frozen=True)
class OAuthProfile:
    provider: str
    subject: str
    display_name: str | None = None
    avatar_url: str | None = None


def provider_config(provider: str) -> OAuthProviderConfig:
    if provider == "qq":
        return OAuthProviderConfig(
            provider="qq",
            label="QQ",
            client_id=os.environ.get("QQ_APP_ID", "").strip(),
            client_secret=os.environ.get("QQ_APP_KEY", "").strip(),
            redirect_uri=os.environ.get("QQ_REDIRECT_URI", "").strip(),
        )
    if provider == "wechat":
        return OAuthProviderConfig(
            provider="wechat",
            label="微信",
            client_id=os.environ.get("WECHAT_APP_ID", "").strip(),
            client_secret=os.environ.get("WECHAT_APP_SECRET", "").strip(),
            redirect_uri=os.environ.get("WECHAT_REDIRECT_URI", "").strip(),
        )
    raise OAuthConfigurationError("Unsupported OAuth provider")


def provider_statuses() -> list[dict]:
    statuses = []
    for provider in SUPPORTED_PROVIDERS:
        config = provider_config(provider)
        statuses.append({"id": provider, "label": config.label, "enabled": config.enabled})
    return statuses


def authorization_url(config: OAuthProviderConfig, state: str) -> str:
    if not config.enabled:
        raise OAuthConfigurationError(f"{config.label} 登录尚未配置")

    if config.provider == "qq":
        params = {
            "response_type": "code",
            "client_id": config.client_id,
            "redirect_uri": config.redirect_uri,
            "state": state,
            "scope": "get_user_info",
        }
        return f"https://graph.qq.com/oauth2.0/authorize?{urlencode(params)}"

    if config.provider == "wechat":
        params = {
            "appid": config.client_id,
            "redirect_uri": config.redirect_uri,
            "response_type": "code",
            "scope": "snsapi_login",
            "state": state,
        }
        return f"https://open.weixin.qq.com/connect/qrconnect?{urlencode(params)}#wechat_redirect"

    raise OAuthConfigurationError("Unsupported OAuth provider")


def create_oauth_state(provider: str, jwt_secret: str) -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "kind": "oauth_state",
            "provider": provider,
            "nonce": secrets.token_urlsafe(24),
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=OAUTH_STATE_MINUTES)).timestamp()),
        },
        jwt_secret,
        algorithm="HS256",
    )


def validate_oauth_state(state: str, cookie_state: str | None, provider: str, jwt_secret: str) -> None:
    if not cookie_state or not secrets.compare_digest(state, cookie_state):
        raise OAuthProviderError("登录请求已失效，请重新发起登录")
    try:
        payload = jwt.decode(state, jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise OAuthProviderError("登录请求已失效，请重新发起登录") from exc
    if payload.get("kind") != "oauth_state" or payload.get("provider") != provider:
        raise OAuthProviderError("登录请求校验失败，请重新发起登录")


async def exchange_oauth_code(config: OAuthProviderConfig, code: str) -> OAuthProfile:
    if not config.enabled:
        raise OAuthConfigurationError(f"{config.label} 登录尚未配置")
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
            if config.provider == "qq":
                return await _exchange_qq(client, config, code)
            if config.provider == "wechat":
                return await _exchange_wechat(client, config, code)
    except httpx.HTTPError as exc:
        raise OAuthProviderError("第三方登录服务暂时不可用，请稍后重试") from exc
    raise OAuthConfigurationError("Unsupported OAuth provider")


async def _exchange_qq(client: httpx.AsyncClient, config: OAuthProviderConfig, code: str) -> OAuthProfile:
    token_response = await client.get(
        "https://graph.qq.com/oauth2.0/token",
        params={
            "grant_type": "authorization_code",
            "client_id": config.client_id,
            "client_secret": config.client_secret,
            "code": code,
            "redirect_uri": config.redirect_uri,
            "fmt": "json",
        },
    )
    token_response.raise_for_status()
    token_payload = _response_payload(token_response)
    access_token = token_payload.get("access_token")
    if not access_token:
        raise OAuthProviderError("QQ 授权失败，请重新登录")

    identity_response = await client.get(
        "https://graph.qq.com/oauth2.0/me",
        params={"access_token": access_token, "fmt": "json"},
    )
    identity_response.raise_for_status()
    identity_payload = _response_payload(identity_response)
    openid = identity_payload.get("openid")
    if not openid:
        raise OAuthProviderError("QQ 未返回有效用户标识")

    profile_response = await client.get(
        "https://graph.qq.com/user/get_user_info",
        params={
            "access_token": access_token,
            "oauth_consumer_key": config.client_id,
            "openid": openid,
            "fmt": "json",
        },
    )
    profile_response.raise_for_status()
    profile_payload = _response_payload(profile_response)
    if profile_payload.get("ret") not in (None, 0, "0"):
        raise OAuthProviderError("无法读取 QQ 用户信息")
    return OAuthProfile(
        provider="qq",
        subject=str(openid),
        display_name=_optional_text(profile_payload.get("nickname")),
        avatar_url=_optional_text(profile_payload.get("figureurl_qq_2") or profile_payload.get("figureurl_qq_1")),
    )


async def _exchange_wechat(client: httpx.AsyncClient, config: OAuthProviderConfig, code: str) -> OAuthProfile:
    token_response = await client.get(
        "https://api.weixin.qq.com/sns/oauth2/access_token",
        params={
            "appid": config.client_id,
            "secret": config.client_secret,
            "code": code,
            "grant_type": "authorization_code",
        },
    )
    token_response.raise_for_status()
    token_payload = _response_payload(token_response)
    access_token = token_payload.get("access_token")
    openid = token_payload.get("openid")
    if not access_token or not openid:
        raise OAuthProviderError("微信授权失败，请重新登录")

    profile_response = await client.get(
        "https://api.weixin.qq.com/sns/userinfo",
        params={"access_token": access_token, "openid": openid, "lang": "zh_CN"},
    )
    profile_response.raise_for_status()
    profile_payload = _response_payload(profile_response)
    if profile_payload.get("errcode") not in (None, 0, "0"):
        raise OAuthProviderError("无法读取微信用户信息")
    return OAuthProfile(
        provider="wechat",
        subject=str(openid),
        display_name=_optional_text(profile_payload.get("nickname")),
        avatar_url=_optional_text(profile_payload.get("headimgurl")),
    )


def frontend_url() -> str:
    value = os.environ.get("OAUTH_FRONTEND_URL", "").strip()
    if not value:
        cors_origins = os.environ.get("CORS_ORIGINS", "http://127.0.0.1:5174")
        value = next((origin.strip() for origin in cors_origins.split(",") if origin.strip()), "")
    parts = urlsplit(value)
    if parts.scheme not in {"http", "https"} or not parts.netloc:
        raise OAuthConfigurationError("OAUTH_FRONTEND_URL must be an absolute http(s) URL")
    return urlunsplit((parts.scheme, parts.netloc, parts.path or "/", parts.query, ""))


def frontend_callback_url(**fragment: str) -> str:
    base = urlsplit(frontend_url())
    return urlunsplit((base.scheme, base.netloc, base.path, base.query, urlencode(fragment)))


def oauth_cookie_secure(config: OAuthProviderConfig) -> bool:
    explicit = os.environ.get("OAUTH_COOKIE_SECURE")
    if explicit is not None and explicit.strip():
        return explicit.strip().lower() not in {"0", "false", "no", "off"}
    return urlsplit(config.redirect_uri).scheme == "https"


def _response_payload(response: httpx.Response) -> dict:
    try:
        payload = response.json()
        if isinstance(payload, dict):
            return payload
    except ValueError:
        pass

    text = response.text.strip()
    if text.startswith("callback("):
        end = text.rfind(")")
        if end > len("callback("):
            try:
                payload = json.loads(text[len("callback(") : end].strip())
                if isinstance(payload, dict):
                    return payload
            except ValueError:
                return {}
    return {key: values[-1] for key, values in parse_qs(text).items() if values}


def _optional_text(value) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
