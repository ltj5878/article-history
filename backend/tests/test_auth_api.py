from urllib.parse import parse_qs, urlsplit

import httpx

from fastapi.testclient import TestClient
from sqlalchemy import select

from api.app import create_app
from api.database import init_db, session_scope
from api.models import OAuthIdentity, User
from api.oauth import OAuthProfile, _response_payload, oauth_cookie_secure, provider_config


def test_user_table_initializes_empty(tmp_path):
    db_url = f"sqlite:///{tmp_path / 'auth.db'}"

    init_db(db_url)

    with session_scope(db_url) as session:
        assert session.scalars(select(User)).all() == []


def test_register_creates_user_without_leaking_password_hash(tmp_path):
    client, db_url = auth_client(tmp_path)

    response = client.post("/api/auth/register", json={"email": "USER@Example.COM", "password": "correct horse battery staple"})

    assert response.status_code == 201
    body = response.json()
    assert body == {
        "id": body["id"],
        "email": "user@example.com",
        "displayName": None,
        "avatarUrl": None,
        "provider": None,
        "role": "user",
        "isActive": True,
    }
    assert "password_hash" not in body
    assert "passwordHash" not in body

    with session_scope(db_url) as session:
        user = session.scalar(select(User).where(User.email == "user@example.com"))
        assert user is not None
        assert user.password_hash != "correct horse battery staple"
        assert user.password_hash.startswith("$argon2")


def test_register_rejects_duplicate_email(tmp_path):
    client, _ = auth_client(tmp_path)
    payload = {"email": "user@example.com", "password": "correct horse battery staple"}

    assert client.post("/api/auth/register", json=payload).status_code == 201
    duplicate = client.post("/api/auth/register", json={"email": "USER@example.com", "password": "correct horse battery staple"})

    assert duplicate.status_code == 409


def test_login_returns_bearer_token_for_valid_credentials(tmp_path):
    client, _ = auth_client(tmp_path)
    register(client, "reader@example.com", "correct horse battery staple")

    response = client.post("/api/auth/login", json={"email": "reader@example.com", "password": "correct horse battery staple"})

    assert response.status_code == 200
    body = response.json()
    assert body["tokenType"] == "bearer"
    assert body["accessToken"]
    assert body["user"]["email"] == "reader@example.com"
    assert "password_hash" not in body["user"]


def test_login_rejects_bad_password(tmp_path):
    client, _ = auth_client(tmp_path)
    register(client, "reader@example.com", "correct horse battery staple")

    response = client.post("/api/auth/login", json={"email": "reader@example.com", "password": "wrong password"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_me_returns_authenticated_user(tmp_path):
    client, _ = auth_client(tmp_path)
    register(client, "reader@example.com", "correct horse battery staple")
    token = login(client, "reader@example.com", "correct horse battery staple")

    response = client.get("/api/auth/me", headers=auth_header(token))

    assert response.status_code == 200
    assert response.json()["email"] == "reader@example.com"
    assert response.json()["role"] == "user"


def test_me_rejects_missing_token(tmp_path):
    client, _ = auth_client(tmp_path)

    response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_admin_ping_rejects_regular_user(tmp_path):
    client, _ = auth_client(tmp_path)
    register(client, "reader@example.com", "correct horse battery staple")
    token = login(client, "reader@example.com", "correct horse battery staple")

    response = client.get("/api/admin/ping", headers=auth_header(token))

    assert response.status_code == 403


def test_admin_ping_accepts_admin_user(tmp_path):
    client, db_url = auth_client(tmp_path)
    register(client, "admin@example.com", "correct horse battery staple")
    with session_scope(db_url) as session:
        user = session.scalar(select(User).where(User.email == "admin@example.com"))
        user.role = "admin"
    token = login(client, "admin@example.com", "correct horse battery staple")

    response = client.get("/api/admin/ping", headers=auth_header(token))

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "role": "admin"}


def test_oauth_providers_only_enable_complete_configuration(tmp_path, monkeypatch):
    monkeypatch.setenv("QQ_APP_ID", "qq-app-id")
    monkeypatch.setenv("QQ_APP_KEY", "qq-app-key")
    monkeypatch.setenv("QQ_REDIRECT_URI", "https://api.example.com/api/auth/oauth/qq/callback")
    monkeypatch.setenv("WECHAT_APP_ID", "wechat-app-id")
    monkeypatch.delenv("WECHAT_APP_SECRET", raising=False)
    monkeypatch.delenv("WECHAT_REDIRECT_URI", raising=False)
    client, _ = auth_client(tmp_path)

    response = client.get("/api/auth/oauth/providers")

    assert response.status_code == 200
    assert response.json() == {
        "providers": [
            {"id": "qq", "label": "QQ", "enabled": True},
            {"id": "wechat", "label": "微信", "enabled": False},
        ]
    }


def test_oauth_start_rejects_incomplete_provider_configuration(tmp_path, monkeypatch):
    monkeypatch.setenv("QQ_APP_ID", "qq-app-id")
    monkeypatch.delenv("QQ_APP_KEY", raising=False)
    monkeypatch.delenv("QQ_REDIRECT_URI", raising=False)
    client, _ = auth_client(tmp_path)

    response = client.get("/api/auth/oauth/qq/start", follow_redirects=False)

    assert response.status_code == 503
    assert response.json()["detail"] == "QQ 登录尚未配置"


def test_oauth_start_redirects_with_state_and_http_only_cookie(tmp_path, monkeypatch):
    configure_qq(monkeypatch)
    client, _ = auth_client(tmp_path)

    response = client.get("/api/auth/oauth/qq/start", follow_redirects=False)

    assert response.status_code == 302
    location = urlsplit(response.headers["location"])
    params = parse_qs(location.query)
    assert f"{location.scheme}://{location.netloc}{location.path}" == "https://graph.qq.com/oauth2.0/authorize"
    assert params["client_id"] == ["qq-app-id"]
    assert params["redirect_uri"] == ["http://testserver/api/auth/oauth/qq/callback"]
    assert params["state"][0]
    cookie = response.headers["set-cookie"]
    assert "history_oauth_state=" in cookie
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie


def test_wechat_oauth_start_uses_qr_login_scope(tmp_path, monkeypatch):
    monkeypatch.setenv("WECHAT_APP_ID", "wechat-app-id")
    monkeypatch.setenv("WECHAT_APP_SECRET", "wechat-app-secret")
    monkeypatch.setenv("WECHAT_REDIRECT_URI", "http://testserver/api/auth/oauth/wechat/callback")
    monkeypatch.setenv("OAUTH_COOKIE_SECURE", "false")
    client, _ = auth_client(tmp_path)

    response = client.get("/api/auth/oauth/wechat/start", follow_redirects=False)

    assert response.status_code == 302
    location = urlsplit(response.headers["location"])
    params = parse_qs(location.query)
    assert f"{location.scheme}://{location.netloc}{location.path}" == "https://open.weixin.qq.com/connect/qrconnect"
    assert params["appid"] == ["wechat-app-id"]
    assert params["scope"] == ["snsapi_login"]
    assert location.fragment == "wechat_redirect"


def test_oauth_callback_maps_identity_and_issues_local_token(tmp_path, monkeypatch):
    configure_qq(monkeypatch)

    async def fake_exchange(config, code):
        assert config.provider == "qq"
        assert code == "provider-code"
        return OAuthProfile(
            provider="qq",
            subject="qq-openid-123",
            display_name="司马读者",
            avatar_url="https://q.qlogo.cn/avatar.jpg",
        )

    monkeypatch.setattr("api.app.exchange_oauth_code", fake_exchange)
    client, db_url = auth_client(tmp_path)
    start = client.get("/api/auth/oauth/qq/start", follow_redirects=False)
    state = parse_qs(urlsplit(start.headers["location"]).query)["state"][0]

    callback = client.get(
        "/api/auth/oauth/qq/callback",
        params={"code": "provider-code", "state": state},
        follow_redirects=False,
    )

    assert callback.status_code == 302
    redirect = urlsplit(callback.headers["location"])
    assert f"{redirect.scheme}://{redirect.netloc}{redirect.path}" == "http://frontend.test/"
    fragment = parse_qs(redirect.fragment)
    assert fragment["oauth_provider"] == ["qq"]
    token = fragment["oauth_access_token"][0]
    me = client.get("/api/auth/me", headers=auth_header(token))
    assert me.status_code == 200
    assert me.json() == {
        "id": me.json()["id"],
        "email": None,
        "displayName": "司马读者",
        "avatarUrl": "https://q.qlogo.cn/avatar.jpg",
        "provider": "qq",
        "role": "user",
        "isActive": True,
    }

    second_start = client.get("/api/auth/oauth/qq/start", follow_redirects=False)
    second_state = parse_qs(urlsplit(second_start.headers["location"]).query)["state"][0]
    second_callback = client.get(
        "/api/auth/oauth/qq/callback",
        params={"code": "provider-code", "state": second_state},
        follow_redirects=False,
    )
    second_token = parse_qs(urlsplit(second_callback.headers["location"]).fragment)["oauth_access_token"][0]
    second_me = client.get("/api/auth/me", headers=auth_header(second_token))
    assert second_me.json()["id"] == me.json()["id"]

    with session_scope(db_url) as session:
        identities = session.scalars(select(OAuthIdentity)).all()
        users = session.scalars(select(User)).all()
        assert len(identities) == 1
        assert len(users) == 1
        assert identities[0].subject == "qq-openid-123"
        assert users[0].email.endswith("@qq.oauth.invalid")


def test_oauth_callback_rejects_deactivated_oauth_user(tmp_path, monkeypatch):
    configure_qq(monkeypatch)

    async def fake_exchange(config, code):
        return OAuthProfile(provider="qq", subject="qq-openid-deactivated", display_name="停用读者")

    monkeypatch.setattr("api.app.exchange_oauth_code", fake_exchange)
    client, db_url = auth_client(tmp_path)
    start = client.get("/api/auth/oauth/qq/start", follow_redirects=False)
    state = parse_qs(urlsplit(start.headers["location"]).query)["state"][0]

    first = client.get(
        "/api/auth/oauth/qq/callback",
        params={"code": "provider-code", "state": state},
        follow_redirects=False,
    )
    assert first.status_code == 302
    first_token = parse_qs(urlsplit(first.headers["location"]).fragment)["oauth_access_token"][0]
    with session_scope(db_url) as session:
        user = session.scalar(select(User).where(User.email.endswith("@qq.oauth.invalid")))
        user.is_active = False

    second_start = client.get("/api/auth/oauth/qq/start", follow_redirects=False)
    second_state = parse_qs(urlsplit(second_start.headers["location"]).query)["state"][0]
    second = client.get(
        "/api/auth/oauth/qq/callback",
        params={"code": "provider-code", "state": second_state},
        follow_redirects=False,
    )
    assert second.status_code == 302
    fragment = parse_qs(urlsplit(second.headers["location"]).fragment)
    assert "oauth_access_token" not in fragment
    assert "账号已停用" in fragment["oauth_error"][0]
    assert first_token


def test_oauth_callback_rejects_mismatched_state_before_exchange(tmp_path, monkeypatch):
    configure_qq(monkeypatch)
    client, _ = auth_client(tmp_path)
    client.get("/api/auth/oauth/qq/start", follow_redirects=False)

    response = client.get(
        "/api/auth/oauth/qq/callback",
        params={"code": "provider-code", "state": "tampered"},
        follow_redirects=False,
    )

    assert response.status_code == 400
    assert "重新发起登录" in response.json()["detail"]


def test_qq_jsonp_payload_without_trailing_semicolon_is_parsed():
    response = httpx.Response(
        200,
        request=httpx.Request("GET", "https://graph.qq.com/oauth2.0/me"),
        text='callback( {"openid":"qq-openid-123"} )',
    )

    assert _response_payload(response) == {"openid": "qq-openid-123"}


def test_oauth_cookie_secure_empty_value_falls_back_to_redirect_scheme(monkeypatch):
    configure_qq(monkeypatch)
    monkeypatch.setenv("OAUTH_COOKIE_SECURE", "")

    assert oauth_cookie_secure(provider_config("qq")) is False

    monkeypatch.setenv("QQ_REDIRECT_URI", "https://api.example.com/api/auth/oauth/qq/callback")
    assert oauth_cookie_secure(provider_config("qq")) is True


def auth_client(tmp_path):
    db_url = f"sqlite:///{tmp_path / 'auth.db'}"
    init_db(db_url)
    return TestClient(create_app(db_url=db_url, jwt_secret="test-secret")), db_url


def register(client, email, password):
    response = client.post("/api/auth/register", json={"email": email, "password": password})
    assert response.status_code == 201
    return response.json()


def login(client, email, password):
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["accessToken"]


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


def configure_qq(monkeypatch):
    monkeypatch.setenv("QQ_APP_ID", "qq-app-id")
    monkeypatch.setenv("QQ_APP_KEY", "qq-app-key")
    monkeypatch.setenv("QQ_REDIRECT_URI", "http://testserver/api/auth/oauth/qq/callback")
    monkeypatch.setenv("OAUTH_FRONTEND_URL", "http://frontend.test/")
    monkeypatch.setenv("OAUTH_COOKIE_SECURE", "false")
