import json
import os
import subprocess
import sys

from fastapi.testclient import TestClient

from api.app import create_app
from api.deployment import deployment_is_ready, deployment_report


def test_default_local_environment_is_not_deployment_ready():
    report = deployment_report({})

    assert not deployment_is_ready(report)
    failures = {check["id"]: check for check in report["checks"] if not check["ok"]}
    assert "database_url" in failures
    assert "jwt_secret" in failures
    assert "cors_origins" in failures


def test_postgres_secret_and_cors_environment_is_deployment_ready():
    report = deployment_report(
        {
            "DATABASE_URL": "postgresql+psycopg://user:pass@db.example.com:5432/jingshi",
            "JWT_SECRET": "a-production-secret-with-enough-length",
            "CORS_ORIGINS": "https://example.netlify.app",
        }
    )

    assert deployment_is_ready(report)
    assert all(check["ok"] for check in report["checks"])


def test_readiness_route_returns_structured_report(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'local.db'}")
    monkeypatch.setenv("JWT_SECRET", "dev-only-change-me")
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    client = TestClient(create_app(db_url=f"sqlite:///{tmp_path / 'local.db'}", jwt_secret="dev-only-change-me"))

    response = client.get("/api/deployment/readiness")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ready"] is False
    assert {check["id"] for check in payload["checks"]} == {"database_url", "jwt_secret", "cors_origins"}


def test_deploy_check_cli_exit_codes():
    failing = run_deploy_check({})
    assert failing.returncode == 1
    assert json.loads(failing.stdout)["ready"] is False

    passing = run_deploy_check(
        {
            "DATABASE_URL": "postgresql+psycopg://user:pass@db.example.com:5432/jingshi",
            "JWT_SECRET": "a-production-secret-with-enough-length",
            "CORS_ORIGINS": "https://example.netlify.app",
        }
    )
    assert passing.returncode == 0
    assert json.loads(passing.stdout)["ready"] is True


def run_deploy_check(env):
    clean_env = {
        "PATH": os.environ.get("PATH", ""),
        "PYTHONPATH": "backend",
        "PYTHONIOENCODING": "utf-8",
    }
    clean_env.update(env)
    return subprocess.run(
        [sys.executable, "-m", "api.deploy_check"],
        cwd=os.getcwd(),
        env=clean_env,
        text=True,
        capture_output=True,
        check=False,
    )
