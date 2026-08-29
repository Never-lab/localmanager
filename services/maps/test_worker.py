"""Regression tests for the maps worker."""

from __future__ import annotations

import tempfile
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

requests = types.ModuleType("requests")
requests.RequestException = type("RequestException", (Exception,), {})
requests.ConnectionError = type("ConnectionError", (requests.RequestException,), {})
requests.Session = MagicMock
sys.modules.setdefault("requests", requests)

render = types.ModuleType("render")
render.render_basemap = MagicMock()
render.composite_overlay = MagicMock()
sys.modules.setdefault("render", render)
import worker


SAMPLE_INPUT = {
    "overlaySlots": ["centro"],
    "osmQuery": "Pescara, Abruzzo, Italy",
    "center": {"lat": 42.46, "lon": 14.21},
    "radiusM": 1500,
    "basemapRevision": "2026-08-29",
    "mapSlots": [
        {
            "id": "centro",
            "labelIt": "Centro",
            "lat": 42.46,
            "lon": 14.21,
            "radiusM": 120,
        }
    ],
}


class WorkerTests(unittest.TestCase):
    def test_normalize_api_url_adds_https_when_scheme_missing(self) -> None:
        self.assertEqual(
            worker.normalize_api_url("web-api.up.railway.app"),
            "https://web-api.up.railway.app",
        )
        self.assertEqual(
            worker.normalize_api_url("https://web-api.up.railway.app/"),
            "https://web-api.up.railway.app",
        )
        self.assertEqual(
            worker.normalize_api_url("http://api:3001"),
            "http://api:3001",
        )

    def test_process_job_uses_input_osm_query_and_cache(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            with (
                patch.object(worker, "DATA_DIR", Path(directory)),
                patch.object(worker, "render_basemap") as render_basemap,
                patch.object(worker, "composite_overlay") as composite_overlay,
                patch.object(worker, "complete_job", return_value=1),
                patch.object(Path, "replace"),
            ):
                job = {"id": 1, "runId": "run", "input": SAMPLE_INPUT}
                worker.process_job(MagicMock(), "key", job)
                self.assertEqual(
                    render_basemap.call_args.args[0], "Pescara, Abruzzo, Italy"
                )
                # Second job same revision: cache hit, no new basemap.
                render_basemap.reset_mock()
                Path(directory, "run", "basemap_2026-08-29.png").write_bytes(b"png")
                worker.process_job(MagicMock(), "key", job)
                render_basemap.assert_not_called()
                self.assertEqual(composite_overlay.call_count, 2)

    def test_rename_failure_after_completion_does_not_fail_ready_job(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            with (
                patch.object(worker, "DATA_DIR", Path(directory)),
                patch.object(worker, "render_basemap"),
                patch.object(worker, "composite_overlay"),
                patch.object(worker, "complete_job", return_value=2),
                patch.object(Path, "replace", side_effect=OSError("rename failed")),
                patch.object(worker, "fail_job") as fail_job,
                self.assertLogs(level="WARNING"),
            ):
                worker.process_job(
                    MagicMock(),
                    "key",
                    {"id": 1, "runId": "run", "input": SAMPLE_INPUT},
                )

        fail_job.assert_not_called()

    def test_main_retries_poll_network_errors(self) -> None:
        session = MagicMock()
        session.__enter__.return_value = session
        with (
            patch.dict("os.environ", {"MAPS_WORKER_KEY": "key"}),
            patch.object(worker.requests, "Session", return_value=session),
            patch.object(
                worker,
                "claim_job",
                side_effect=[requests.ConnectionError("offline"), KeyboardInterrupt],
            ),
            patch.object(worker.time, "sleep") as sleep,
            self.assertRaises(KeyboardInterrupt),
        ):
            worker.main()

        sleep.assert_called_once_with(3)


if __name__ == "__main__":
    unittest.main()
