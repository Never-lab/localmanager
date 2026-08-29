"""Test rendering helpers (fixture mode only)."""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

os.environ["LOCALMANAGER_MAPS_FIXTURE"] = "1"

from render import (
    composite_overlay,
    ensure_vsketch_stub,
    latlon_to_pixel,
    marker_radius_px,
    render_basemap,
)


class RenderTests(unittest.TestCase):
    def test_latlon_to_pixel_center_is_image_center(self) -> None:
        x, y = latlon_to_pixel(42.0, 14.0, {"lat": 42.0, "lon": 14.0}, 1000, 200, 200)
        self.assertEqual((x, y), (100, 100))

    def test_marker_radius_stays_pin_sized_on_hq_basemap(self) -> None:
        # HQ ~1800px: //30 → r=60 (bomba); vogliamo un pin piccolo.
        self.assertEqual(marker_radius_px((1800, 1800)), 9)
        self.assertEqual(marker_radius_px((100, 100)), 3)

    def test_vsketch_stub_avoids_optional_plotter_warning(self) -> None:
        import sys
        import warnings

        sys.modules.pop("vsketch", None)
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            ensure_vsketch_stub()
            try:
                import vsketch  # noqa: F401
            except Exception as error:  # pragma: no cover
                self.fail(f"stub vsketch must import: {error}")
        self.assertEqual(caught, [])
        self.assertIn("vsketch", sys.modules)

    def test_composite_stable_across_calls(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            basemap = Path(directory) / "base.png"
            out_a = Path(directory) / "a.png"
            out_b = Path(directory) / "b.png"
            render_basemap(
                "test",
                {"lat": 42.2167, "lon": 14.45},
                1200,
                str(basemap),
                True,
            )
            slots = [
                {
                    "id": "centro",
                    "lat": 42.2167,
                    "lon": 14.45,
                    "radiusM": 120,
                }
            ]
            center = {"lat": 42.2167, "lon": 14.45}
            composite_overlay(str(basemap), slots, ["centro"], center, 1200, str(out_a))
            composite_overlay(str(basemap), slots, ["centro"], center, 1200, str(out_b))
            self.assertEqual(out_a.read_bytes(), out_b.read_bytes())


if __name__ == "__main__":
    unittest.main()
