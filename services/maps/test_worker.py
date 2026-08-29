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
render.render_map = MagicMock()
sys.modules.setdefault("render", render)
import worker


class WorkerTests(unittest.TestCase):
    def test_process_job_uses_santa_maria_imbaro_query(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            with (
                patch.object(worker, "DATA_DIR", Path(directory)),
                patch.object(worker, "render_map") as render_map,
                patch.object(worker, "complete_job", return_value=1),
                patch.object(Path, "replace"),
            ):
                worker.process_job(
                    MagicMock(),
                    "key",
                    {"id": 1, "runId": "run", "input": {"overlaySlots": []}},
                )

        self.assertEqual(
            render_map.call_args.args[0], "Santa Maria Imbaro, Abruzzo, Italy"
        )

    def test_rename_failure_after_completion_does_not_fail_ready_job(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            with (
                patch.object(worker, "DATA_DIR", Path(directory)),
                patch.object(worker, "render_map"),
                patch.object(worker, "complete_job", return_value=2),
                patch.object(Path, "replace", side_effect=OSError("rename failed")),
                patch.object(worker, "fail_job") as fail_job,
                self.assertLogs(level="WARNING"),
            ):
                worker.process_job(
                    MagicMock(),
                    "key",
                    {"id": 1, "runId": "run", "input": {"overlaySlots": []}},
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
