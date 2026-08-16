from pathlib import Path
import os

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse

from .admin_content import (
    AdminContentRepository,
    BookCreate,
    BookUpdate,
    ChapterCreate,
    DuplicateContentError,
    InvalidReadingDocumentError,
    ReadingDocumentUpdate,
)
from .auth import (
    AuthRepository,
    DuplicateUserError,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    auth_dependencies,
    create_access_token,
    resolve_jwt_secret,
    to_user_response,
)
from .content_import import ContentImportError, ContentImportPackage, ContentPackageImporter
from .database import get_database_url, init_db, session_scope
from .deployment import deployment_report
from .oauth import (
    OAUTH_STATE_COOKIE,
    OAUTH_STATE_MINUTES,
    OAuthConfigurationError,
    OAuthProviderError,
    authorization_url,
    create_oauth_state,
    exchange_oauth_code,
    frontend_callback_url,
    oauth_cookie_secure,
    provider_config,
    provider_statuses,
    validate_oauth_state,
)
from .repository import ContentNotFoundError, ContentRepository

ALLOWED_GEO_LAYERS = {
    "ne_coastline_china",
    "ne_rivers_china",
    "ne_lakes_china",
    "ne_land_china",
    "china_provinces",
}
DEFAULT_GEO_DIR = Path(__file__).resolve().parents[1] / "data" / "geo"


def create_app(
    db_url: str | None = None,
    geo_dir: str | Path | None = None,
    jwt_secret: str | None = None,
) -> FastAPI:
    resolved_db_url = get_database_url(db_url)
    resolved_geo_dir = Path(geo_dir) if geo_dir else DEFAULT_GEO_DIR
    init_db(resolved_db_url)
    app = FastAPI(title="经史舆图 Content API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_origins(),
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
    get_current_user, require_admin = auth_dependencies(resolved_db_url, jwt_secret)

    @app.get("/api/health")
    def health():
        with session_scope(resolved_db_url) as session:
            return ContentRepository(session).health()

    @app.get("/api/deployment/readiness")
    def deployment_readiness():
        return deployment_report()

    @app.get("/api/books")
    def list_books():
        with session_scope(resolved_db_url) as session:
            return ContentRepository(session).list_books()

    @app.get("/api/books/{book_id}")
    def get_book(book_id: str):
        with session_scope(resolved_db_url) as session:
            return _or_404(lambda: ContentRepository(session).get_book(book_id))

    @app.get("/api/books/{book_id}/chapters/{chapter_id}")
    def get_chapter(book_id: str, chapter_id: str):
        with session_scope(resolved_db_url) as session:
            return _or_404(lambda: ContentRepository(session).get_chapter(book_id, chapter_id))

    @app.get("/api/books/{book_id}/articles/{article_id}")
    def get_article(book_id: str, article_id: str):
        with session_scope(resolved_db_url) as session:
            return _or_404(lambda: ContentRepository(session).get_article(book_id, article_id))

    @app.get("/api/maps/period/{period_id}")
    def get_period(period_id: str):
        with session_scope(resolved_db_url) as session:
            return _or_404(lambda: ContentRepository(session).get_period(period_id))

    @app.get("/api/geo/{layer}")
    def get_geo_layer(layer: str):
        if layer not in ALLOWED_GEO_LAYERS:
            raise HTTPException(status_code=404, detail=f"Geo layer not found: {layer}")
        path = resolved_geo_dir / f"{layer}.geojson"
        if not path.exists():
            raise HTTPException(status_code=404, detail=f"Geo layer not found: {layer}")
        return FileResponse(path, media_type="application/geo+json")

    @app.post("/api/auth/register", status_code=201)
    def register(payload: RegisterRequest):
        with session_scope(resolved_db_url) as session:
            try:
                user = AuthRepository(session).create_user(payload.email, payload.password)
            except DuplicateUserError as exc:
                raise HTTPException(status_code=409, detail="Email already registered") from exc
            return to_user_response(user)

    @app.post("/api/auth/login")
    def login(payload: LoginRequest):
        with session_scope(resolved_db_url) as session:
            user = AuthRepository(session).authenticate(payload.email, payload.password)
            if not user:
                raise HTTPException(status_code=401, detail="Invalid email or password")
            token = create_access_token(user, resolve_jwt_secret(jwt_secret))
            return TokenResponse(
                accessToken=token,
                expiresIn=30 * 60,
                user=to_user_response(user),
            )

    @app.get("/api/auth/oauth/providers")
    def oauth_providers():
        return {"providers": provider_statuses()}

    @app.get("/api/auth/oauth/{provider}/start")
    def oauth_start(provider: str):
        try:
            config = provider_config(provider)
            if not config.enabled:
                raise OAuthConfigurationError(f"{config.label} 登录尚未配置")
            state = create_oauth_state(provider, resolve_jwt_secret(jwt_secret))
            location = authorization_url(config, state)
        except OAuthConfigurationError as exc:
            status_code = 404 if str(exc) == "Unsupported OAuth provider" else 503
            raise HTTPException(status_code=status_code, detail=str(exc)) from exc

        response = RedirectResponse(location, status_code=302)
        response.set_cookie(
            OAUTH_STATE_COOKIE,
            state,
            max_age=OAUTH_STATE_MINUTES * 60,
            httponly=True,
            secure=oauth_cookie_secure(config),
            samesite="lax",
            path=f"/api/auth/oauth/{provider}/callback",
        )
        return response

    @app.get("/api/auth/oauth/{provider}/callback")
    async def oauth_callback(
        provider: str,
        request: Request,
        code: str | None = None,
        state: str | None = None,
        error: str | None = None,
    ):
        try:
            config = provider_config(provider)
        except OAuthConfigurationError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        cookie_path = f"/api/auth/oauth/{provider}/callback"
        try:
            validate_oauth_state(
                state or "",
                request.cookies.get(OAUTH_STATE_COOKIE),
                provider,
                resolve_jwt_secret(jwt_secret),
            )
        except OAuthProviderError as exc:
            response = JSONResponse({"detail": str(exc)}, status_code=400)
            response.delete_cookie(OAUTH_STATE_COOKIE, path=cookie_path, secure=oauth_cookie_secure(config))
            return response

        if error or not code:
            response = RedirectResponse(
                frontend_callback_url(oauth_error="用户取消了第三方登录", oauth_provider=provider),
                status_code=302,
            )
            response.delete_cookie(OAUTH_STATE_COOKIE, path=cookie_path, secure=oauth_cookie_secure(config))
            return response

        try:
            profile = await exchange_oauth_code(config, code)
            if profile.provider != provider:
                raise OAuthProviderError("第三方登录身份来源不匹配")
            with session_scope(resolved_db_url) as session:
                user, _ = AuthRepository(session).get_or_create_oauth_user(
                    profile.provider,
                    profile.subject,
                    profile.display_name,
                    profile.avatar_url,
                )
                if not user.is_active:
                    raise OAuthProviderError("账号已停用，请联系管理员")
                token = create_access_token(user, resolve_jwt_secret(jwt_secret))
            location = frontend_callback_url(
                oauth_access_token=token,
                oauth_provider=provider,
            )
        except (OAuthProviderError, OAuthConfigurationError) as exc:
            location = frontend_callback_url(oauth_error=str(exc), oauth_provider=provider)

        response = RedirectResponse(location, status_code=302)
        response.delete_cookie(OAUTH_STATE_COOKIE, path=cookie_path, secure=oauth_cookie_secure(config))
        return response

    @app.get("/api/auth/me")
    def me(user=Depends(get_current_user)):
        with session_scope(resolved_db_url) as session:
            identity = AuthRepository(session).get_oauth_identity(user.id)
            return to_user_response(user, identity)

    @app.get("/api/admin/ping")
    def admin_ping(user=Depends(require_admin)):
        return {"status": "ok", "role": user.role}

    @app.get("/api/admin/books")
    def admin_list_books(user=Depends(require_admin)):
        with session_scope(resolved_db_url) as session:
            return AdminContentRepository(session).list_books()

    @app.post("/api/admin/books", status_code=201)
    def admin_create_book(payload: BookCreate, user=Depends(require_admin)):
        with session_scope(resolved_db_url) as session:
            try:
                return AdminContentRepository(session).create_book(payload)
            except DuplicateContentError as exc:
                raise HTTPException(status_code=409, detail=str(exc)) from exc

    @app.patch("/api/admin/books/{book_id}")
    def admin_update_book(book_id: str, payload: BookUpdate, user=Depends(require_admin)):
        with session_scope(resolved_db_url) as session:
            return _or_404(lambda: AdminContentRepository(session).update_book(book_id, payload))

    @app.delete("/api/admin/books/{book_id}", status_code=204)
    def admin_delete_book(book_id: str, user=Depends(require_admin)):
        with session_scope(resolved_db_url) as session:
            _or_404(lambda: AdminContentRepository(session).delete_book(book_id))
        return None

    @app.post("/api/admin/books/{book_id}/chapters", status_code=201)
    def admin_add_chapter(book_id: str, payload: ChapterCreate, user=Depends(require_admin)):
        with session_scope(resolved_db_url) as session:
            try:
                return _or_404(lambda: AdminContentRepository(session).add_chapter(book_id, payload))
            except DuplicateContentError as exc:
                raise HTTPException(status_code=409, detail=str(exc)) from exc

    @app.get("/api/admin/books/{book_id}/units")
    def admin_list_reading_units(book_id: str, user=Depends(require_admin)):
        with session_scope(resolved_db_url) as session:
            return _or_404(lambda: AdminContentRepository(session).list_reading_units(book_id))

    @app.get("/api/admin/books/{book_id}/units/{kind}/{unit_id}")
    def admin_get_reading_document(book_id: str, kind: str, unit_id: str, user=Depends(require_admin)):
        with session_scope(resolved_db_url) as session:
            return _or_404(lambda: AdminContentRepository(session).get_reading_document(book_id, kind, unit_id))

    @app.put("/api/admin/books/{book_id}/units/{kind}/{unit_id}")
    def admin_update_reading_document(
        book_id: str,
        kind: str,
        unit_id: str,
        payload: ReadingDocumentUpdate,
        user=Depends(require_admin),
    ):
        with session_scope(resolved_db_url) as session:
            try:
                return _or_404(lambda: AdminContentRepository(session).update_reading_document(book_id, kind, unit_id, payload))
            except InvalidReadingDocumentError as exc:
                raise HTTPException(status_code=409, detail=str(exc)) from exc

    @app.post("/api/admin/import", status_code=201)
    def admin_import_content(payload: ContentImportPackage, user=Depends(require_admin)):
        with session_scope(resolved_db_url) as session:
            try:
                return ContentPackageImporter(session).import_package(payload)
            except ContentImportError as exc:
                raise HTTPException(status_code=409, detail=str(exc)) from exc

    return app


def _or_404(fn):
    try:
        return fn()
    except ContentNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


def get_cors_origins() -> list[str]:
    raw = os.environ.get("CORS_ORIGINS", "http://127.0.0.1:5174,http://localhost:5174")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app = create_app()
