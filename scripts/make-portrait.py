#!/usr/bin/env python3
"""Duotone portrait mark from the committed headshot.

The badge is the photograph itself, not a drawing. The studio backdrop is
lifted off with a soft edge, the tones are mapped onto the site's navy and
accent blue (read from src/style.css), and the head and shoulders sit on a
navy circle with the accent ring.

Regenerate from the repo root:

    python3 scripts/make-portrait.py

To recrop from an original square headshot first:

    python3 scripts/make-portrait.py --from-photo path/to/headshot.jpg
"""

from __future__ import annotations

import argparse
import base64
import io
import re
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CROP_PATH = ROOT / "src" / "portrait" / "niraj-source-crop.jpg"
CSS_PATH = ROOT / "src" / "style.css"
PUBLIC = ROOT / "public"
ICON_DIR = PUBLIC / "icons"

# Studio backdrop in the source photo is a flat near-black gray.
BG_LEVEL = 16
# Feather the cutout over a few pixels. Wide enough to avoid a hard jag,
# narrow enough that a gray fringe cannot survive the defringe step.
FEATHER_PX = 2.4

# Levels on the photo's luminance, before the navy → light-blue map.
# Black stays on the hair; white is pulled in so teeth and the cheek
# highlight reach the light blue. Gamma below 1 lifts the face.
LEVEL_BLACK = 0.05
LEVEL_WHITE = 0.78
LEVEL_GAMMA = 0.62


def load_rgb(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB"))


def save_source_crop(photo: Path, dest: Path) -> None:
    """Square head-and-shoulders crop. The attached portrait is already framed;
    this trims a little empty backdrop above the hair and keeps the shoulders."""
    im = Image.open(photo).convert("RGB")
    w, h = im.size
    top = int(round(h * 0.035))
    side = int(round(w * 0.04))
    crop = im.crop((side, top, w - side, h))
    cw, ch = crop.size
    side_pad = max(0, ch - cw) // 2
    top_pad = max(0, cw - ch) // 2
    canvas = Image.new("RGB", (cw + side_pad * 2, ch + top_pad * 2), (BG_LEVEL, BG_LEVEL, BG_LEVEL))
    canvas.paste(crop, (side_pad, top_pad))
    if canvas.size[0] != canvas.size[1]:
        m = min(canvas.size)
        left = (canvas.size[0] - m) // 2
        top_i = (canvas.size[1] - m) // 2
        canvas = canvas.crop((left, top_i, left + m, top_i + m))
    dest.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dest, quality=92, subsampling=0, optimize=True)


def parse_root_colors(css_path: Path) -> dict[str, tuple[int, int, int]]:
    """Read the dark-theme custom properties. Light mode overrides them later
    in the file; the portrait uses the primary navy and accent pair."""
    text = css_path.read_text()
    root = text.split("[data-theme", 1)[0]
    found: dict[str, tuple[int, int, int]] = {}
    for name, raw in re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", root):
        raw = raw.strip()
        if re.fullmatch(r"#[0-9a-fA-F]{6}", raw):
            found[name] = tuple(int(raw[i : i + 2], 16) for i in (1, 3, 5))  # type: ignore[assignment]
    needed = ("--bg", "--bg-elevated", "--accent", "--accent-bright")
    missing = [name for name in needed if name not in found]
    if missing:
        raise SystemExit(f"missing theme colours in {css_path}: {', '.join(missing)}")
    return found


def background_mask(rgb: np.ndarray) -> np.ndarray:
    """True on the studio backdrop, flood-filled from the edges.

    Hair is dark but warm, so a neutral-gray gate keeps the silhouette.
    """
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    chroma = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    lum = (r + g + b) / 3
    near = (
        (np.abs(r - BG_LEVEL) <= 8)
        & (np.abs(g - BG_LEVEL) <= 8)
        & (np.abs(b - BG_LEVEL) <= 8)
        & (chroma <= 6)
        & (lum >= 6)
        & (lum <= 34)
    )
    h, w = near.shape
    bg = np.zeros((h, w), dtype=bool)
    stack = []
    for x in range(w):
        stack.append((0, x))
        stack.append((h - 1, x))
    for y in range(h):
        stack.append((y, 0))
        stack.append((y, w - 1))
    while stack:
        y, x = stack.pop()
        if y < 0 or y >= h or x < 0 or x >= w or bg[y, x] or not near[y, x]:
            continue
        bg[y, x] = True
        stack.append((y - 1, x))
        stack.append((y + 1, x))
        stack.append((y, x - 1))
        stack.append((y, x + 1))
    return bg


def cutout(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Return defringed RGB and a soft alpha. Backdrop gray is not left on the edge."""
    bg = background_mask(rgb)
    fg = ~bg
    # Confident interior, a couple of pixels in from the silhouette.
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    interior = cv2.erode(fg.astype(np.uint8), kernel, iterations=1) > 0
    # Edge pixels still carry a mix of backdrop gray. Paint them with the
    # nearest interior colour so the feather cannot leave a halo.
    fringe = (fg & ~interior).astype(np.uint8) * 255
    if int(fringe.sum()) > 0 and interior.any():
        clean = cv2.inpaint(rgb, fringe, 3, cv2.INPAINT_TELEA)
    else:
        clean = rgb.copy()
    clean[~fg] = rgb[~fg]

    dist = cv2.distanceTransform(fg.astype(np.uint8), cv2.DIST_L2, 5)
    alpha = np.clip(dist / FEATHER_PX, 0.0, 1.0).astype(np.float32)
    # Smoothstep so the rim eases out instead of ending in a ramp.
    alpha = alpha * alpha * (3.0 - 2.0 * alpha)
    alpha[interior] = 1.0
    alpha[bg] = 0.0
    return clean, alpha


def srgb_to_linear(c: np.ndarray) -> np.ndarray:
    x = c.astype(np.float32) / 255.0
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c: np.ndarray) -> np.ndarray:
    x = np.clip(c, 0.0, 1.0)
    y = np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1.0 / 2.4) - 0.055)
    return np.clip(np.rint(y * 255.0), 0, 255).astype(np.uint8)


def duotone(rgb: np.ndarray, shadow: tuple[int, int, int], highlight: tuple[int, int, int]) -> np.ndarray:
    """Map perceptual luminance onto the theme pair, in linear light."""
    y = (
        0.2126 * rgb[:, :, 0].astype(np.float32)
        + 0.7152 * rgb[:, :, 1].astype(np.float32)
        + 0.0722 * rgb[:, :, 2].astype(np.float32)
    ) / 255.0
    t = np.clip((y - LEVEL_BLACK) / (LEVEL_WHITE - LEVEL_BLACK), 0.0, 1.0)
    t = np.power(t, LEVEL_GAMMA)
    shadow_l = srgb_to_linear(np.array(shadow, dtype=np.float32))
    highlight_l = srgb_to_linear(np.array(highlight, dtype=np.float32))
    mixed = shadow_l * (1.0 - t[..., None]) + highlight_l * t[..., None]
    return linear_to_srgb(mixed)


def skin_mask(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Warm lit pixels of the face and neck, used only to frame the favicon."""
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    lum = (r.astype(np.int16) + g + b) / 3
    return (alpha > 0.6) & (r > g + 8) & (r > b + 12) & (lum > 70) & (lum < 230)


def face_square(rgb: np.ndarray, alpha: np.ndarray) -> tuple[int, int, int]:
    """A tighter square around the head for favicon sizes.

    The warm pixels run down the chest, so the square is taken from the upper
    half of that region (the face) plus the hair above it, not the whole torso.
    """
    h, w = alpha.shape
    ys, xs = np.where(alpha > 0.5)
    if len(ys) == 0:
        raise SystemExit("cutout is empty")
    skin = skin_mask(rgb, alpha)
    sy, sx = np.where(skin)
    if len(sy) < 50:
        cx = int((xs.min() + xs.max()) / 2)
        top = int(ys.min())
        side = int((ys.max() - ys.min()) * 0.62)
    else:
        cut = float(np.percentile(sy, 48))
        upper = sy < cut
        ux = sx[upper]
        cx = int(np.median(ux))
        face_w = float(np.percentile(ux, 96) - np.percentile(ux, 4))
        side = int(np.clip(face_w * 1.62, face_w + 48, min(h, w) * 0.74))
        top = int(ys.min())
    side = int(np.clip(side, 32, min(h, w)))
    half = side / 2.0
    left = int(np.clip(cx - half, 0, w - side))
    top = int(np.clip(top - side * 0.03, 0, h - side))
    return left, top, side


def compose(rgb: np.ndarray, alpha: np.ndarray, shadow, highlight, ring, size: int, crop=None) -> Image.Image:
    """Place the cutout on a navy circle and stroke the accent ring."""
    if crop is not None:
        x, y, side = crop
        rgb = rgb[y : y + side, x : x + side]
        alpha = alpha[y : y + side, x : x + side]
    tone = duotone(rgb, shadow, highlight)
    # Fit the subject in the circle with a small margin so the ring does not clip the hair.
    src_h, src_w = tone.shape[:2]
    margin = 0.04
    scale = (size * (1.0 - margin * 2)) / max(src_h, src_w)
    new_w = max(1, int(round(src_w * scale)))
    new_h = max(1, int(round(src_h * scale)))
    tone_im = Image.fromarray(tone, mode="RGB").resize((new_w, new_h), Image.Resampling.LANCZOS)
    alpha_im = Image.fromarray(np.clip(alpha * 255, 0, 255).astype(np.uint8), mode="L").resize(
        (new_w, new_h), Image.Resampling.LANCZOS
    )
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    # Navy disc first, then the portrait, then the ring on top.
    yy, xx = np.ogrid[:size, :size]
    cx = (size - 1) / 2.0
    cy = (size - 1) / 2.0
    radius = size / 2.0
    disc = (xx - cx) ** 2 + (yy - cy) ** 2 <= (radius - 0.5) ** 2
    base = np.zeros((size, size, 4), dtype=np.uint8)
    base[disc, 0] = shadow[0]
    base[disc, 1] = shadow[1]
    base[disc, 2] = shadow[2]
    base[disc, 3] = 255
    canvas = Image.fromarray(base, mode="RGBA")
    ox = (size - new_w) // 2
    oy = (size - new_h) // 2
    portrait = tone_im.convert("RGBA")
    portrait.putalpha(alpha_im)
    canvas.alpha_composite(portrait, (ox, oy))
    arr = np.array(canvas)
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    ring_w = max(1.5, size * 0.028)
    ring_band = (dist <= radius - 0.4) & (dist >= radius - ring_w)
    arr[ring_band, 0] = ring[0]
    arr[ring_band, 1] = ring[1]
    arr[ring_band, 2] = ring[2]
    arr[ring_band, 3] = 255
    outside = dist > radius - 0.4
    arr[outside, 3] = 0
    return Image.fromarray(arr, mode="RGBA")


def svg_wrapper(png: Image.Image, label: str) -> str:
    """Self-contained SVG so the header and favicon do not depend on a second file."""
    buf = io.BytesIO()
    png.save(buf, format="PNG", optimize=True)
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    w, h = png.size
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="{label}">
  <image width="{w}" height="{h}" href="data:image/png;base64,{encoded}" xlink:href="data:image/png;base64,{encoded}"/>
</svg>
'''


def write_outputs(badge: Image.Image, favicon: Image.Image) -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    # The header shows the mark at about 42px, so the SVG embeds a 256px
    # render. The Open Graph image keeps the full 512px frame.
    badge_svg = svg_wrapper(badge.resize((256, 256), Image.Resampling.LANCZOS), "Duotone portrait of Niraj Bhusal")
    (ICON_DIR / "niraj-mark.svg").write_text(badge_svg)
    badge.resize((256, 256), Image.Resampling.LANCZOS).save(ICON_DIR / "niraj-mark.png", optimize=True)
    badge.save(ICON_DIR / "niraj-mark-512.png", optimize=True)
    badge.save(PUBLIC / "og-image.png", optimize=True)
    badge.resize((180, 180), Image.Resampling.LANCZOS).save(PUBLIC / "apple-touch-icon.png", optimize=True)

    fav_svg = svg_wrapper(favicon.resize((128, 128), Image.Resampling.LANCZOS), "Duotone portrait of Niraj Bhusal")
    (PUBLIC / "favicon.svg").write_text(fav_svg)
    favicon.resize((32, 32), Image.Resampling.LANCZOS).save(PUBLIC / "favicon-32.png", optimize=True)
    print(f"wrote {ICON_DIR / 'niraj-mark.svg'}")
    print(f"wrote {PUBLIC / 'favicon.svg'}")
    print(f"wrote {PUBLIC / 'favicon-32.png'}")
    print(f"wrote {PUBLIC / 'apple-touch-icon.png'}")
    print(f"wrote {PUBLIC / 'og-image.png'}")


def save_review(photo: np.ndarray, badge: Image.Image, favicon: Image.Image, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    badge.save(out_dir / "duotone-512.png")
    photo_im = Image.fromarray(photo, mode="RGB").resize((512, 512), Image.Resampling.LANCZOS)
    sheet = Image.new("RGB", (512 * 2 + 24, 512 + 36), (12, 14, 20))
    sheet.paste(photo_im, (8, 28))
    sheet.paste(badge.convert("RGB"), (512 + 16, 28), badge)
    from PIL import ImageDraw

    draw = ImageDraw.Draw(sheet)
    draw.text((12, 6), "photo", fill=(220, 224, 230))
    draw.text((528, 6), "duotone", fill=(220, 224, 230))
    sheet.save(out_dir / "compare-512.png")

    def cell(im: Image.Image, size: int) -> Image.Image:
        small = im.resize((size, size), Image.Resampling.LANCZOS)
        return small.resize((size * 8, size * 8), Image.Resampling.NEAREST)

    sizes = (16, 32, 48)
    cells = [cell(favicon, s) for s in sizes]
    width = sum(c.width for c in cells) + 16 * (len(cells) + 1)
    height = max(c.height for c in cells) + 36
    row = Image.new("RGB", (width, height), (12, 14, 20))
    d2 = ImageDraw.Draw(row)
    x = 12
    for s, c in zip(sizes, cells):
        d2.text((x, 6), f"{s}px", fill=(220, 224, 230))
        row.paste(c.convert("RGB"), (x, 28), c)
        x += c.width + 16
    row.save(out_dir / "favicon-sizes.png")
    # Edge check: hair against white, where a gray halo would show.
    edge = badge.resize((180, 180), Image.Resampling.LANCZOS)
    white = Image.new("RGB", edge.size, (255, 255, 255))
    white.paste(edge.convert("RGB"), mask=edge.split()[-1])
    white.crop((0, 0, 90, 90)).resize((360, 360), Image.Resampling.NEAREST).save(out_dir / "edge-white.png")
    print(f"review images in {out_dir}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--from-photo", type=Path, help="original headshot to crop before the duotone")
    parser.add_argument("--review", type=Path, default=Path("/tmp/portrait-review"))
    args = parser.parse_args()
    if args.from_photo:
        save_source_crop(args.from_photo, CROP_PATH)
        print(f"wrote crop {CROP_PATH}")
    if not CROP_PATH.exists():
        raise SystemExit(f"missing source crop: {CROP_PATH}")
    colors = parse_root_colors(CSS_PATH)
    shadow = colors["--bg"]
    highlight = colors["--accent-bright"]
    ring = colors["--accent"]
    print(
        "shadow", "#{:02x}{:02x}{:02x}".format(*shadow),
        "highlight", "#{:02x}{:02x}{:02x}".format(*highlight),
        "ring", "#{:02x}{:02x}{:02x}".format(*ring),
    )
    rgb = load_rgb(CROP_PATH)
    clean, alpha = cutout(rgb)
    covered = alpha > 0.5
    y = (
        0.2126 * rgb[:, :, 0].astype(np.float32)
        + 0.7152 * rgb[:, :, 1].astype(np.float32)
        + 0.0722 * rgb[:, :, 2].astype(np.float32)
    ) / 255.0
    print(
        "luminance p10/p50/p90",
        np.round(np.percentile(y[covered], [10, 50, 90]), 3).tolist(),
        "coverage", round(float(covered.mean()), 3),
    )
    badge = compose(clean, alpha, shadow, highlight, ring, 512)
    favicon = compose(clean, alpha, shadow, highlight, ring, 256, crop=face_square(rgb, alpha))
    write_outputs(badge, favicon)
    save_review(rgb, badge, favicon, args.review)


if __name__ == "__main__":
    main()
