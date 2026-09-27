#!/usr/bin/env python3
"""Build a flat illustrated portrait from the committed head-and-shoulders crop.

The mark is derived from the photograph itself: background removal, bilateral
smoothing, then a few luminance bands per material (skin, hair, shirt) plus
separate eye and teeth shapes. Those flat regions are vector-traced with potrace.
No generative image model is used.

Regenerate from the repo root:

    python3 scripts/trace-portrait.py

To recrop from an original square headshot first:

    python3 scripts/trace-portrait.py --from-photo path/to/headshot.jpg
"""

from __future__ import annotations

import argparse
import subprocess
import tempfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CROP_PATH = ROOT / "src" / "portrait" / "niraj-source-crop.jpg"
PUBLIC = ROOT / "public"
ICON_DIR = PUBLIC / "icons"

# Studio backdrop in the source photo is a flat near-black gray.
BG_LEVEL = 16
MASTER = 480


def load_rgb(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB"))


def save_source_crop(photo: Path, dest: Path) -> None:
    """Square head-and-shoulders crop. The attached portrait is already framed;
    this trims a little empty backdrop above the hair and keeps the shoulders."""
    im = Image.open(photo).convert("RGB")
    w, h = im.size
    # Hair begins a little below the top; keep a sliver of backdrop so the
    # circle still reads as a head-and-shoulders badge rather than a tight face.
    top = int(round(h * 0.035))
    side = int(round(w * 0.04))
    bottom = h
    crop = im.crop((side, top, w - side, bottom))
    # Pad to a square so the circle is centred on the head and upper chest.
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


def background_mask(rgb: np.ndarray) -> np.ndarray:
    """True where the pixel is studio backdrop, flood-filled from the edges.

    Hair is dark but warm (or darker than the backdrop), so a chroma/level gate
    plus flood fill keeps the silhouette instead of eating the hair.
    """
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    chroma = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    lum = (r + g + b) / 3
    near = (
        (np.abs(r - BG_LEVEL) <= 7)
        & (np.abs(g - BG_LEVEL) <= 7)
        & (np.abs(b - BG_LEVEL) <= 7)
        & (chroma <= 4)
        & (lum >= 8)
        & (lum <= 30)
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


def resize_nearest(mask: np.ndarray, size: int) -> np.ndarray:
    img = Image.fromarray((mask.astype(np.uint8) * 255), mode="L").resize(
        (size, size), Image.Resampling.NEAREST
    )
    return np.asarray(img) > 127


def smooth_photo(rgb: np.ndarray) -> np.ndarray:
    """Heavy edge-preserving denoise so pores and shirt texture disappear."""
    sm = cv2.bilateralFilter(rgb, 21, 95, 18)
    sm = cv2.bilateralFilter(sm, 15, 75, 14)
    # Mean shift flattens remaining local colour variation without moving edges.
    sm = cv2.pyrMeanShiftFiltering(sm, sp=16, sr=24)
    return sm


def split_bands(mask: np.ndarray, field: np.ndarray, quantiles: list[float]) -> list[np.ndarray]:
    vals = field[mask]
    if vals.size < 40:
        return []
    edges = np.quantile(vals, quantiles)
    bands = []
    for i in range(len(edges) - 1):
        lo, hi = float(edges[i]), float(edges[i + 1])
        if i == 0:
            band = mask & (field <= hi)
        elif i == len(edges) - 2:
            band = mask & (field > lo)
        else:
            band = mask & (field > lo) & (field <= hi)
        bands.append(band)
    return bands


def tidy_mask(mask: np.ndarray, open_px: int, close_px: int) -> np.ndarray:
    m = mask.astype(np.uint8)
    if open_px > 0:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (open_px, open_px))
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, k)
    if close_px > 0:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_px, close_px))
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k)
    return m > 0


def keep_components(mask: np.ndarray, min_area: int, limit: int | None = None) -> np.ndarray:
    n, comp = cv2.connectedComponents(mask.astype(np.uint8))
    areas = [(int((comp == i).sum()), i) for i in range(1, n)]
    areas.sort(reverse=True)
    if limit is not None:
        areas = areas[:limit]
    out = np.zeros(mask.shape, dtype=bool)
    for area, i in areas:
        if area < min_area:
            continue
        out |= comp == i
    return out


def fill_foreground_gaps(labels: np.ndarray, foreground: np.ndarray) -> np.ndarray:
    """Give opened-away pixels the neighbouring flat colour."""
    unknown = foreground & (labels < 0)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    for _ in range(12):
        if not unknown.any():
            break
        claim = np.full(labels.shape, -1, dtype=np.int16)
        for lab in range(int(labels.max()) + 1):
            dil = cv2.dilate((labels == lab).astype(np.uint8), kernel) > 0
            take = unknown & dil & (claim < 0)
            claim[take] = lab
        labels = np.where(claim >= 0, claim, labels)
        unknown = foreground & (labels < 0)
    return labels


def quantize(rgb: np.ndarray, foreground: np.ndarray, _k: int = 0) -> tuple[np.ndarray, np.ndarray]:
    """Flat illustration labels: 3 skin, 2 hair, 3 shirt, plus eyes and teeth.

    Colours are medians of the smoothed photograph, not a generated palette.
    """
    small = cv2.resize(rgb, (MASTER, MASTER), interpolation=cv2.INTER_AREA)
    fg = resize_nearest(foreground, MASTER)
    fg = tidy_mask(fg, open_px=0, close_px=5)
    smooth = smooth_photo(small)

    r = smooth[:, :, 0].astype(np.int16)
    g = smooth[:, :, 1].astype(np.int16)
    b = smooth[:, :, 2].astype(np.int16)
    lum = (r.astype(np.float32) + g + b) / 3.0
    # Broad shading planes. Pores and fabric noise are gone before the bands.
    planes = cv2.GaussianBlur(lum, (0, 0), 11)

    skin = fg & (r > g + 12) & (r > b + 18) & (lum > 42)
    shirt = fg & ~skin & (g + 8 >= r) & (g > b - 18) & (lum > 48) & (r > 60)
    hair = fg & ~skin & ~shirt

    labels = np.full((MASTER, MASTER), -1, dtype=np.int16)
    palette: list[np.ndarray] = []

    def paint(mask: np.ndarray, color: np.ndarray | None = None, open_px: int = 5, close_px: int = 7) -> None:
        mask = tidy_mask(mask, open_px, close_px)
        if int(mask.sum()) < 40:
            return
        if color is None:
            color = np.median(smooth[mask], axis=0)
        palette.append(np.clip(np.rint(color), 0, 255).astype(np.uint8))
        labels[mask] = len(palette) - 1

    for band in split_bands(hair, planes, [0.0, 0.58, 1.0]):
        paint(band, open_px=5, close_px=9)
    for band in split_bands(shirt, planes, [0.0, 0.42, 0.8, 1.0]):
        paint(band, open_px=7, close_px=11)
    for band in split_bands(skin, planes, [0.0, 0.34, 0.8, 1.0]):
        paint(band, open_px=7, close_px=11)

    labels = fill_foreground_gaps(labels, fg)
    labels = mode_filter_labels(labels, radius=3)
    labels = drop_specks(labels, min_area=280)
    labels = fill_foreground_gaps(labels, fg)

    if not skin.any():
        raise SystemExit("could not find the face in the source crop")
    ys, xs = np.where(skin)
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    face_h, face_w = max(1, y1 - y0), max(1, x1 - x0)

    eye_band = np.zeros((MASTER, MASTER), dtype=bool)
    eye_band[
        y0 + int(0.12 * face_h) : y0 + int(0.30 * face_h),
        x0 + int(0.14 * face_w) : x1 - int(0.12 * face_w),
    ] = True
    eyes = eye_band & fg & (lum < 58)
    eyes = tidy_mask(eyes, open_px=0, close_px=5)
    eyes = keep_components(eyes, min_area=50)
    if eyes.any():
        eye_color = np.median(smooth[eyes], axis=0) * 0.7
        palette.append(np.clip(np.rint(eye_color), 0, 255).astype(np.uint8))
        labels[eyes] = len(palette) - 1

    mouth = np.zeros((MASTER, MASTER), dtype=bool)
    mouth[
        y0 + int(0.40 * face_h) : y0 + int(0.50 * face_h),
        x0 + int(0.36 * face_w) : x1 - int(0.30 * face_w),
    ] = True
    chroma = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    teeth = mouth & (lum > 158) & (chroma < 80)
    teeth = tidy_mask(teeth, open_px=0, close_px=0)
    # Join the teeth into one smile, wide enough to read at favicon size.
    smile_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 7))
    teeth = cv2.morphologyEx(teeth.astype(np.uint8), cv2.MORPH_CLOSE, smile_kernel) > 0
    teeth = keep_components(teeth, min_area=40, limit=1)
    if teeth.any():
        tooth_src = teeth & (lum > 158)
        measured = np.median(smooth[tooth_src], axis=0) if tooth_src.any() else np.median(smooth[teeth], axis=0)
        # Lift the measured tooth colour toward ivory so the smile separates
        # from the cheek highlight, without inventing a new hue.
        tooth_color = measured + (255.0 - measured) * 0.22
        palette.append(np.clip(np.rint(tooth_color), 0, 255).astype(np.uint8))
        labels[teeth] = len(palette) - 1

    labels = np.where(fg, labels, -1)
    return labels, np.stack(palette, axis=0)


def mode_filter_labels(labels: np.ndarray, radius: int) -> np.ndarray:
    """Majority filter so posterized regions become flat illustration shapes."""
    h, w = labels.shape
    padded = np.pad(labels, radius, mode="edge")
    k = radius * 2 + 1
    bands = []
    for dy in range(k):
        for dx in range(k):
            bands.append(padded[dy : dy + h, dx : dx + w])
    stacked = np.stack(bands, axis=0)  # (k*k, h, w)
    # Mode. Background (-1) can win on edges; that's ok inside the circle fill.
    # Count votes for labels  -1..k-1. Shift by +1 so index 0 is background.
    shifted = stacked + 1
    n_labels = int(shifted.max()) + 1
    # bincount along axis 0 per pixel would be heavy; use a loop over labels.
    counts = np.zeros((n_labels, h, w), dtype=np.uint8)
    for lab in range(n_labels):
        counts[lab] = np.sum(shifted == lab, axis=0).astype(np.uint8)
    winner = np.argmax(counts, axis=0).astype(np.int16) - 1
    # Do not let the filter punch holes through the face: if the centre pixel
    # is foreground and the winner is background, keep the centre when the
    # foreground still has a plurality of non-background votes.
    fg_votes = counts[1:].sum(axis=0)
    bg_votes = counts[0]
    keep_fg = (labels >= 0) & (winner < 0) & (fg_votes >= bg_votes)
    winner = np.where(keep_fg, labels, winner)
    out = winner
    return out


def drop_specks(labels: np.ndarray, min_area: int) -> np.ndarray:
    """Merge tiny islands into the neighbouring colour so traces stay clean."""
    h, w = labels.shape
    out = labels.copy()
    seen = np.zeros((h, w), dtype=bool)
    # Background is not a speck we remove.
    ys, xs = np.where(out >= 0)
    for y0, x0 in zip(ys.tolist(), xs.tolist()):
        if seen[y0, x0]:
            continue
        lab = out[y0, x0]
        stack = [(y0, x0)]
        seen[y0, x0] = True
        cells = [(y0, x0)]
        while stack:
            y, x = stack.pop()
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if ny < 0 or ny >= h or nx < 0 or nx >= w or seen[ny, nx]:
                    continue
                if out[ny, nx] != lab:
                    continue
                seen[ny, nx] = True
                stack.append((ny, nx))
                cells.append((ny, nx))
        if len(cells) >= min_area:
            continue
        # Neighbour histogram.
        votes: dict[int, int] = {}
        for y, x in cells:
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if ny < 0 or ny >= h or nx < 0 or nx >= w:
                    continue
                other = int(out[ny, nx])
                if other == lab or other < 0:
                    continue
                votes[other] = votes.get(other, 0) + 1
        if not votes:
            continue
        repl = max(votes, key=votes.get)
        for y, x in cells:
            out[y, x] = repl
    return out


def trace_mask(mask: np.ndarray, tmp: Path) -> str:
    """Return an SVG group (shared potrace transform) for the black ink mask."""
    ink = Image.fromarray(np.where(mask, 0, 255).astype(np.uint8), mode="L")
    bmp = tmp / "mask.bmp"
    svg = tmp / "mask.svg"
    ink.save(bmp)
    subprocess.check_call(
        [
            "potrace",
            "-s",
            "-o",
            str(svg),
            "-t",
            "48",
            "-a",
            "1.3",
            "-O",
            "1.0",
            "--flat",
            str(bmp),
        ],
        stdout=subprocess.DEVNULL,
    )
    text = svg.read_text()
    # potrace 1.16 may ignore --flat; keep the <g> wrapper either way.
    start = text.find("<g")
    end = text.rfind("</g>")
    if start < 0 or end < 0:
        raise SystemExit("potrace did not emit a group")
    return text[start : end + 4]


def hex_color(rgb: np.ndarray) -> str:
    return "#{:02x}{:02x}{:02x}".format(int(rgb[0]), int(rgb[1]), int(rgb[2]))


def build_svg(labels: np.ndarray, palette: np.ndarray) -> str:
    h, w = labels.shape
    # Larger areas first so hair and shirt sit under smaller facial accents
    # when paths antialias over each other.
    areas = [(int((labels == i).sum()), i) for i in range(len(palette))]
    areas.sort(reverse=True)
    layers = []
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        for _, i in areas:
            mask = labels == i
            if int(mask.sum()) < 12:
                continue
            group = trace_mask(mask, tmp)
            # Force this layer's fill. Potrace paints black.
            group = group.replace('fill="#000000"', f'fill="{hex_color(palette[i])}"', 1)
            if "fill=" not in group:
                group = group.replace("<g", f'<g fill="{hex_color(palette[i])}"', 1)
            layers.append(group)
    cx = w / 2
    cy = h / 2
    r = w / 2
    body = "\n".join(layers)
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="Illustrated portrait of Niraj Bhusal">
  <circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="#07090f"/>
  <g clip-path="url(#mark-clip)">
{body}
  </g>
  <circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r - 3:.1f}" fill="none" stroke="#3b9eff" stroke-width="5" opacity="0.9"/>
  <defs>
    <clipPath id="mark-clip">
      <circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}"/>
    </clipPath>
  </defs>
</svg>
'''


def posterized_rgba(labels: np.ndarray, palette: np.ndarray) -> Image.Image:
    h, w = labels.shape
    rgb = np.zeros((h, w, 3), dtype=np.uint8)
    rgb[:] = (7, 9, 15)
    for i, color in enumerate(palette):
        rgb[labels == i] = color
    im = Image.fromarray(rgb, mode="RGB")
    # Circular alpha so the PNG fallback matches the SVG badge.
    alpha = Image.new("L", (w, h), 0)
    yy, xx = np.ogrid[:h, :w]
    cy = (h - 1) / 2
    cx = (w - 1) / 2
    r = min(cx, cy)
    disk = (xx - cx) ** 2 + (yy - cy) ** 2 <= (r - 0.5) ** 2
    alpha_arr = np.where(disk, 255, 0).astype(np.uint8)
    alpha = Image.fromarray(alpha_arr, mode="L")
    im.putalpha(alpha)
    return im


def ring_png(src: Image.Image, size: int) -> Image.Image:
    im = src.resize((size, size), Image.Resampling.LANCZOS)
    # Paint a 1–2px accent ring so the badge stays legible on light UI chrome.
    arr = np.asarray(im).copy()
    yy, xx = np.ogrid[:size, :size]
    cy = (size - 1) / 2
    cx = (size - 1) / 2
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    r = size / 2
    ring = (dist <= r - 0.4) & (dist >= r - max(1.6, size * 0.035))
    arr[ring, 0] = 59
    arr[ring, 1] = 158
    arr[ring, 2] = 255
    arr[ring, 3] = 255
    outer = dist > r - 0.4
    arr[outer, 3] = 0
    return Image.fromarray(arr, mode="RGBA")


def write_outputs(svg: str, poster: Image.Image) -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    svg_path = ICON_DIR / "niraj-mark.svg"
    svg_path.write_text(svg)
    (PUBLIC / "favicon.svg").write_text(svg)
    png = ICON_DIR / "niraj-mark.png"
    poster.save(png)
    ring_png(poster, 32).save(PUBLIC / "favicon-32.png")
    ring_png(poster, 180).save(PUBLIC / "apple-touch-icon.png")
    ring_png(poster, 512).save(PUBLIC / "og-image.png")
    # Also keep a large PNG next to the SVG as the explicit fallback.
    ring_png(poster, 512).save(ICON_DIR / "niraj-mark-512.png")
    print(f"wrote {svg_path} ({svg_path.stat().st_size} bytes)")
    print(f"wrote {png}")
    print(f"wrote {PUBLIC / 'favicon.svg'}")
    print(f"wrote {PUBLIC / 'favicon-32.png'}")
    print(f"wrote {PUBLIC / 'apple-touch-icon.png'}")
    print(f"wrote {PUBLIC / 'og-image.png'}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--from-photo", type=Path, help="original headshot to crop before tracing")
    args = parser.parse_args()
    if args.from_photo:
        save_source_crop(args.from_photo, CROP_PATH)
        print(f"wrote crop {CROP_PATH}")
    if not CROP_PATH.exists():
        raise SystemExit(f"missing source crop: {CROP_PATH}")
    rgb = load_rgb(CROP_PATH)
    bg = background_mask(rgb)
    labels, palette = quantize(rgb, ~bg)
    svg = build_svg(labels, palette)
    poster = posterized_rgba(labels, palette)
    write_outputs(svg, poster)
    counts = [(i, hex_color(palette[i]), int((labels == i).sum())) for i in range(len(palette))]
    print("regions", counts)


if __name__ == "__main__":
    main()
