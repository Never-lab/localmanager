"""Render LocalManager map images."""

from __future__ import annotations

import argparse
import os
import tempfile
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent
FIXTURE_PATH = ROOT / "fixtures" / "basemap_stub.png"
COLORS = ("#e63946", "#457b9d", "#f4a261", "#2a9d8f", "#9b5de5")


def _position(slot: dict[str, Any], index: int) -> tuple[float, float]:
    return (
        float(slot.get("x", 0.2 + (index % 4) * 0.2)),
        float(slot.get("y", 0.3 + (index // 4) * 0.2)),
    )


def _draw_fixture_slots(image: Image.Image, slots: list[dict[str, Any]]) -> None:
    draw = ImageDraw.Draw(image)
    radius = max(5, min(image.size) // 30)
    for index, slot in enumerate(slots):
        x, y = _position(slot, index)
        cx, cy = int(x * image.width), int(y * image.height)
        color = str(slot.get("color", COLORS[index % len(COLORS)]))
        draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=color)


def render_map(
    osm_query: str,
    slots: list[dict[str, Any]],
    out_path: str,
    fixture_mode: bool = False,
) -> None:
    """Render a basemap and colored slot markers to a PNG."""
    output = Path(out_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    use_fixture = fixture_mode or os.getenv("LOCALMANAGER_MAPS_FIXTURE", "0") == "1"

    if use_fixture:
        with Image.open(FIXTURE_PATH) as source:
            image = source.convert("RGB").copy()
        _draw_fixture_slots(image, slots)
        image.save(output, format="PNG")
        return

    import matplotlib.pyplot as plt
    import prettymaps

    prettymaps.plot(osm_query)
    axes = plt.gca()
    for index, slot in enumerate(slots):
        x, y = _position(slot, index)
        axes.scatter(
            [x],
            [y],
            color=str(slot.get("color", COLORS[index % len(COLORS)])),
            s=80,
            transform=axes.transAxes,
            zorder=100,
        )
    plt.savefig(output, format="png", bbox_inches="tight", pad_inches=0)
    plt.close()


def _self_test() -> None:
    with tempfile.TemporaryDirectory() as directory:
        output = Path(directory) / "map.png"
        render_map(
            "Santa Maria Imbaro, Abruzzo, Italy",
            [{"x": 0.5, "y": 0.5}],
            str(output),
            True,
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
