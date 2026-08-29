"""Poll the LocalManager API for map rendering jobs."""

from __future__ import annotations

import logging
import os
import re
import time
from pathlib import Path
from typing import Any

import requests

from render import composite_overlay, render_basemap


POLL_SECONDS = 3
DATA_DIR = Path(os.getenv("LOCALMANAGER_MAPS_DATA_DIR", "/data/maps"))
STUB_BASEMAP = Path(__file__).resolve().parent / "fixtures" / "basemap_stub.png"


def normalize_api_url(value: str) -> str:
    url = value.strip().rstrip("/")
    if url and "://" not in url:
        url = f"https://{url}"
    return url


API_URL = normalize_api_url(os.getenv("LOCALMANAGER_API_URL", "http://api:3001"))


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


def _require_geo(job_input: dict[str, Any]) -> tuple[str, dict[str, float], float, str]:
    """Estrae geo obbligatorio dal job (niente hardcode sul comune)."""
    osm_query = job_input.get("osmQuery")
    center = job_input.get("center")
    radius_m = job_input.get("radiusM")
    revision = job_input.get("basemapRevision")
    if not isinstance(osm_query, str) or not osm_query:
        raise ValueError("job input missing osmQuery")
    if not isinstance(center, dict) or "lat" not in center or "lon" not in center:
        raise ValueError("job input missing center")
    if not isinstance(radius_m, (int, float)) or float(radius_m) <= 0:
        raise ValueError("job input missing radiusM")
    if not isinstance(revision, str) or not revision:
        raise ValueError("job input missing basemapRevision")
    return (
        osm_query,
        {"lat": float(center["lat"]), "lon": float(center["lon"])},
        float(radius_m),
        revision,
    )


def _basemap_cache_usable(cache_path: Path) -> bool:
    """True se la cache è riusabile. In live mode scarta lo stub fixture residuo."""
    if not cache_path.is_file():
        return False
    if os.getenv("LOCALMANAGER_MAPS_FIXTURE", "0") == "1":
        return True
    if STUB_BASEMAP.is_file() and cache_path.read_bytes() == STUB_BASEMAP.read_bytes():
        return False
    return True


def process_job(
    session: requests.Session, worker_key: str, job: dict[str, Any]
) -> None:
    job_id = job["id"]
    job_input = job["input"]
    run_dir = DATA_DIR / _safe_name(job["runId"])
    run_dir.mkdir(parents=True, exist_ok=True)
    temporary_path = run_dir / f".{_safe_name(job_id)}.png"

    try:
        osm_query, center, radius_m, revision = _require_geo(job_input)
        map_slots = list(job_input.get("mapSlots") or [])
        overlay_slots = [str(s) for s in (job_input.get("overlaySlots") or [])]
        cache_path = run_dir / f"basemap_{_safe_name(revision)}.png"

        # Cache basemap per revisione: overlay successivo = solo composite.
        if not _basemap_cache_usable(cache_path):
            logging.info(
                "Rendering basemap run=%s revision=%s query=%s",
                job.get("runId"),
                revision,
                osm_query,
            )
            render_basemap(osm_query, center, radius_m, str(cache_path))
        composite_overlay(
            str(cache_path),
            map_slots,
            overlay_slots,
            center,
            radius_m,
            str(temporary_path),
        )
        version = complete_job(session, worker_key, job_id, temporary_path)
    except Exception as error:
        temporary_path.unlink(missing_ok=True)
        fail_job(session, worker_key, job_id, error)
        return

    try:
        temporary_path.replace(run_dir / f"v{version}.png")
    except OSError as error:
        logging.warning(
            "Map job %s completed, but local file rename failed: %s", job_id, error
        )


def main() -> None:
    worker_key = os.environ.get("MAPS_WORKER_KEY")
    if not worker_key:
        raise RuntimeError("MAPS_WORKER_KEY is required")

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    logging.info(
        "Maps worker ready (fixture=%s) polling %s",
        os.getenv("LOCALMANAGER_MAPS_FIXTURE", "0"),
        API_URL,
    )

    with requests.Session() as session:
        while True:
            try:
                job = claim_job(session, worker_key)
            except requests.RequestException as error:
                logging.warning("Map job poll failed: %s", error)
                time.sleep(POLL_SECONDS)
                continue
            if job is None:
                time.sleep(POLL_SECONDS)
                continue
            process_job(session, worker_key, job)


if __name__ == "__main__":
    main()
