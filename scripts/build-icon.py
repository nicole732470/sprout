#!/usr/bin/env python3
"""Render Super Mario desktop widget icon PNG + ICNS."""

from __future__ import annotations

import os
import subprocess
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "build")
ASSETS = os.path.join(ROOT, "assets")
SIZE = 1024


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def sky_pixel(x: int, y: int) -> tuple[int, int, int]:
    t = y / SIZE
    r = int(lerp(74, 168, t))
    g = int(lerp(158, 220, t))
    b = int(lerp(255, 255, t))
    return r, g, b


def draw_cloud(draw: ImageDraw.ImageDraw, cx: int, cy: int, scale: float, fill: tuple[int, int, int, int]) -> None:
    for ox, oy, rx, ry in [
        (0, 0, 72, 34),
        (-60, 10, 50, 28),
        (60, 8, 54, 30),
    ]:
        draw.ellipse(
            (cx + ox - rx * scale, cy + oy - ry * scale, cx + ox + rx * scale, cy + oy + ry * scale),
            fill=fill,
        )


def paste_sprite(base: Image.Image, path: str, x: int, y: int, scale: float) -> None:
    sprite = Image.open(path).convert("RGBA")
    w = int(sprite.width * scale)
    h = int(sprite.height * scale)
    sprite = sprite.resize((w, h), Image.Resampling.NEAREST)
    base.paste(sprite, (x, y), sprite)


def render_icon() -> Image.Image:
    img = Image.new("RGBA", (SIZE, SIZE))
    px = img.load()
    for y in range(SIZE):
        for x in range(SIZE):
            r, g, b = sky_pixel(x, y)
            px[x, y] = (r, g, b, 255)

    draw = ImageDraw.Draw(img, "RGBA")
    draw_cloud(draw, 260, 210, 1.0, (255, 255, 255, 230))
    draw_cloud(draw, 760, 260, 0.9, (255, 255, 255, 200))
    draw_cloud(draw, 520, 150, 0.75, (255, 255, 255, 180))

    ground_y = 690
    for i in range(10):
        gx = 120 + i * 82
        draw.rectangle((gx, ground_y, gx + 74, ground_y + 30), fill=(194, 65, 12))
        draw.rectangle((gx + 2, ground_y + 2, gx + 36, ground_y + 28), fill=(217, 119, 6))
        draw.rectangle((gx + 38, ground_y + 2, gx + 72, ground_y + 28), fill=(180, 83, 9))

    draw.rounded_rectangle((110, ground_y + 30, 914, ground_y + 48), radius=10, fill=(0, 0, 0, 40))

    paste_sprite(img, os.path.join(ASSETS, "luigi.png"), 250, ground_y - 150, 4.2)
    paste_sprite(img, os.path.join(ASSETS, "mario.png"), 560, ground_y - 150, 4.2)

    draw_flag(draw, 860, ground_y - 170)
    return img


def draw_flag(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    draw.rectangle((x, y, x + 10, y + 110), fill=(220, 220, 220))
    draw.rectangle((x + 10, y + 8, x + 72, y + 48), fill=(34, 197, 94))
    draw.rectangle((x + 10, y + 8, x + 72, y + 24), fill=(74, 222, 128))


def write_icns(png_path: str, icns_path: str) -> None:
    iconset = os.path.join(BUILD, "icon.iconset")
    os.makedirs(iconset, exist_ok=True)
    sizes = [16, 32, 64, 128, 256, 512, 1024]
    src = Image.open(png_path).convert("RGBA")
    for size in sizes:
        resized = src.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(os.path.join(iconset, f"icon_{size}x{size}.png"))
        if size <= 512:
            dsize = size * 2
            dresized = src.resize((dsize, dsize), Image.Resampling.LANCZOS)
            dresized.save(os.path.join(iconset, f"icon_{size}x{size}@2x.png"))
    subprocess.run(["iconutil", "-c", "icns", iconset, "-o", icns_path], check=True)


def main() -> int:
    os.makedirs(BUILD, exist_ok=True)
    png_path = os.path.join(BUILD, "icon.png")
    icns_path = os.path.join(BUILD, "icon.icns")
    render_icon().save(png_path)
    write_icns(png_path, icns_path)
    print(f"Wrote {png_path}")
    print(f"Wrote {icns_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
