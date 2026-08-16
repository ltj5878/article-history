import json

from .deployment import deployment_is_ready, deployment_report


def main() -> int:
    report = deployment_report()
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if deployment_is_ready(report) else 1


if __name__ == "__main__":
    raise SystemExit(main())
