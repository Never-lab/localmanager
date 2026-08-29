"""Poll the LocalManager API for map rendering jobs."""

from __future__ import annotations

import os
import re
import time
from pathlib import Path
from typing import Any

import requests

from render import render_map


POLL_SECONDS = 3
API_URL = os.getenv("LOCALMANAGER_API_URL", "http://api:3001").rstrip("/")
DATA_DIR = Path(os.getenv("LOCALMANAGER_MAPS_DATA_DIR", "/data/maps"))


def _safe_name(value: object) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]", "_", str(value))


def _headers(worker_key: str) -> dict[str, str]:
    return {"x-maps-worker-key": worker_key}


def claim_job(session: requests.Session, worker_key: str) -> dict[str, Any] | None:
    response = session.get(
        f"{API_URL}/api/internal/map-jobs/next",
        headers=_headers(worker_key),
        timeout=30,
    )
    if response.status_code == 204:
        return None
    response.raise_for_status()
    return response.json()


def complete_job(
    session: requests.Session,
    worker_key: str,
    job_id: object,
    png_path: Path,
) -> int:
    response = session.post(
        f"{API_URL}/api/internal/map-jobs/{job_id}/complete",
        headers={**_headers(worker_key), "content-type": "image/png"},
        data=png_path.read_bytes(),
        timeout=60,
    )
    response.raise_for_status()
    return int(response.json()["mapVersion"])


def fail_job(
    session: requests.Session, worker_key: str, job_id: object, error: Exception
) -> None:
    response = session.post(
        f"{API_URL}/api/internal/map-jobs/{job_id}/complete",
        headers=_headers(worker_key),
        json={"error": str(error)[:1000]},
        timeout=30,
    )
    response.raise_for_status()


def process_job(
    session: requests.Session, worker_key: str, job: dict[str, Any]
) -> None:
    job_id = job["id"]
    job_input = job["input"]
    run_dir = DATA_DIR / _safe_name(job["runId"])
    temporary_path = run_dir / f".{_safe_name(job_id)}.png"
    slots = [{"name": slot} for slot in job_input.get("overlaySlots", [])]

    try:
        render_map("Atessa, Chieti, Italy", slots, str(temporary_path))
        version = complete_job(session, worker_key, job_id, temporary_path)
        temporary_path.replace(run_dir / f"v{version}.png")
    except Exception as error:
        temporary_path.unlink(missing_ok=True)
        fail_job(session, worker_key, job_id, error)


def main() -> None:
    worker_key = os.environ.get("MAPS_WORKER_KEY")
    if not worker_key:
        raise RuntimeError("MAPS_WORKER_KEY is required")

    with requests.Session() as session:
        while True:
            job = claim_job(session, worker_key)
            if job is None:
                time.sleep(POLL_SECONDS)
                continue
            process_job(session, worker_key, job)


if __name__ == "__main__":
    main()
