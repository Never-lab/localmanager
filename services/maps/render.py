"""Render LocalManager map images (basemap + overlay compositing)."""

from __future__ import annotations

import argparse
import math
import os
import tempfile
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent
FIXTURE_PATH = ROOT / "fixtures" / "basemap_stub.png"
COLORS = ("#e63946", "#457b9d", "#f4a261", "#2a9d8f", "#9b5de5")


def latlon_to_pixel(
    lat: float,
    lon: float,
    center: dict[str, float],
    radius_m: float,
    width: int,
    height: int,
) -> tuple[int, int]:
    """Converte lat/lon in pixel nel frame centrato (nord in alto)."""
    m_per_deg_lat = 111_320.0
    m_per_deg_lon = 111_320.0 * math.cos(math.radians(center["lat"]))
    dx = (lon - center["lon"]) * m_per_deg_lon
    dy = (lat - center["lat"]) * m_per_deg_lat
    x = (dx / (2 * radius_m) + 0.5) * width
    y = (0.5 - dy / (2 * radius_m)) * height
    return int(x), int(y)


def render_basemap(
    osm_query: str,
    center: dict[str, float],
    radius_m: float,
    out_path: str,
    fixture_mode: bool = False,
) -> None:
    """Genera il basemap HQ (o stub fixture) con inquadramento fisso."""
    output = Path(out_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    use_fixture = fixture_mode or os.getenv("LOCALMANAGER_MAPS_FIXTURE", "0") == "1"

    if use_fixture:
        with Image.open(FIXTURE_PATH) as source:
            source.convert("RGB").copy().save(output, format="PNG")
        return

    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import prettymaps

    # Inquadramento esplicito: stesso radius/center a ogni regen.
    # Niente bbox_inches="tight": taglia il frame e rompe latlon→pixel.
    prettymaps.plot(
        (center["lat"], center["lon"]),
        radius=radius_m,
        credit=False,
    )
    fig = plt.gcf()
    fig.set_size_inches(10, 10)
    plt.savefig(output, format="png", dpi=180, pad_inches=0)
    plt.close()
    # osm_query resta nel job per audit / fallback futuri
    _ = osm_query


def composite_overlay(
    basemap_path: str,
    map_slots: list[dict[str, Any]],
    active_ids: list[str],
    center: dict[str, float],
    radius_m: float,
    out_path: str,
) -> None:
    """Disegna i marker attivi sul basemap senza rifare lo zoom OSM."""
    output = Path(out_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(basemap_path) as source:
        image = source.convert("RGB").copy()
    draw = ImageDraw.Draw(image)
    active = set(active_ids)
    slots_by_id = {str(slot.get("id")): slot for slot in map_slots}
    radius_px = max(5, min(image.size) // 30)
    for index, slot_id in enumerate(active_ids):
        slot = slots_by_id.get(slot_id)
        if not slot:
            continue
        if slot_id not in active:
            continue
        lat = float(slot["lat"])
        lon = float(slot["lon"])
        cx, cy = latlon_to_pixel(
            lat, lon, center, radius_m, image.width, image.height
        )
        color = str(slot.get("color", COLORS[index % len(COLORS)]))
        draw.ellipse(
            (cx - radius_px, cy - radius_px, cx + radius_px, cy + radius_px),
            fill=color,
        )
    image.save(output, format="PNG")


def render_map(
    osm_query: str,
    slots: list[dict[str, Any]],
    out_path: str,
    fixture_mode: bool = False,
    center: dict[str, float] | None = None,
    radius_m: float = 1200,
    active_ids: list[str] | None = None,
) -> None:
    """Wrapper: basemap + composite (compatibilità self-test / vecchi caller)."""
    resolved_center = center or {"lat": 42.2167, "lon": 14.45}
    with tempfile.TemporaryDirectory() as directory:
        basemap = Path(directory) / "basemap.png"
        render_basemap(
            osm_query, resolved_center, radius_m, str(basemap), fixture_mode
        )
        ids = active_ids
        if ids is None:
            ids = [str(slot.get("id", f"slot_{i}")) for i, slot in enumerate(slots)]
            for i, slot in enumerate(slots):
                slot.setdefault("id", ids[i])
                if "lat" not in slot or "lon" not in slot:
                    # Legacy x/y normalizzati → lat/lon finti intorno al centro
                    x = float(slot.get("x", 0.5))
                    y = float(slot.get("y", 0.5))
                    slot["lon"] = resolved_center["lon"] + (x - 0.5) * (
                        2 * radius_m / 111_320.0
                    )
                    slot["lat"] = resolved_center["lat"] + (0.5 - y) * (
                        2 * radius_m / 111_320.0
                    )
        composite_overlay(
            str(basemap), slots, ids, resolved_center, radius_m, out_path
        )


def _self_test() -> None:
    with tempfile.TemporaryDirectory() as directory:
        output = Path(directory) / "map.png"
        render_map(
            "Santa Maria Imbaro, Abruzzo, Italy",
            [{"id": "centro", "lat": 42.2167, "lon": 14.45}],
            str(output),
            True,
            center={"lat": 42.2167, "lon": 14.45},
            active_ids=["centro"],
        )
        with Image.open(output) as image:
            image.verify()
        if output.read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
            raise RuntimeError("self-test did not produce a PNG")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        _self_test()
