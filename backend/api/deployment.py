from collections.abc import Mapping
import os


DEFAULT_JWT_SECRET = "dev-only-change-me"


def deployment_report(env: Mapping[str, str] | None = None) -> dict:
    values = os.environ if env is None else env
    checks = [
        _database_url_check(values.get("DATABASE_URL", "")),
        _jwt_secret_check(values.get("JWT_SECRET", "")),
        _cors_origins_check(values.get("CORS_ORIGINS", "")),
    ]
    return {"ready": deployment_is_ready({"checks": checks}), "checks": checks}


def deployment_is_ready(report: dict) -> bool:
    return all(check.get("ok") for check in report.get("checks", []))


def _database_url_check(value: str) -> dict:
    if not value:
        return _check("database_url", False, "DATABASE_URL must be set")
    if value.startswith("sqlite"):
        return _check("database_url", False, "DATABASE_URL must point to Postgres for deployment")
    if value.startswith(("postgresql://", "postgresql+psycopg://", "postgres://")):
        return _check("database_url", True, "DATABASE_URL points to Postgres")
    return _check("database_url", False, "DATABASE_URL must use a supported Postgres URL")


def _jwt_secret_check(value: str) -> dict:
    if not value:
        return _check("jwt_secret", False, "JWT_SECRET must be set")
    if value == DEFAULT_JWT_SECRET:
        return _check("jwt_secret", False, "JWT_SECRET must not use the local development default")
    if len(value) < 24:
        return _check("jwt_secret", False, "JWT_SECRET must be at least 24 characters")
    return _check("jwt_secret", True, "JWT_SECRET is configured")


def _cors_origins_check(value: str) -> dict:
    origins = [origin.strip() for origin in value.split(",") if origin.strip()]
    if not origins:
        return _check("cors_origins", False, "CORS_ORIGINS must list deployed frontend origins")
    invalid = [origin for origin in origins if not origin.startswith(("https://", "http://localhost", "http://127.0.0.1"))]
    if invalid:
        return _check("cors_origins", False, "CORS_ORIGINS must use explicit http(s) origins")
    return _check("cors_origins", True, "CORS_ORIGINS is configured")


def _check(check_id: str, ok: bool, message: str) -> dict:
    return {"id": check_id, "ok": ok, "message": message}
