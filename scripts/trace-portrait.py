#!/usr/bin/env python3
"""Build a flat illustrated portrait from the committed head-and-shoulders crop.

The mark is derived from the photograph itself: background removal, edge-preserving
smoothing, colour quantization, then potrace vectorization of each flat colour.
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

import numpy as np
from PIL import Image, ImageFilter
from sklearn.cluster import MiniBatchKMeans

ROOT = Path(__file__).resolve().parents[1]
CROP_PATH = ROOT / "src" / "portrait" / "niraj-source-crop.jpg"
PUBLIC = ROOT / "public"
ICON_DIR = PUBLIC / "icons"

# Studio backdrop in the source photo is a flat near-black gray.
BG_LEVEL = 16
MASTER = 640
COLORS = 14


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


def quantize(rgb: np.ndarray, foreground: np.ndarray, k: int) -> tuple[np.ndarray, np.ndarray]:
    """Return a label map (-1 = background) and a (k, 3) palette."""
    h, w, _ = rgb.shape
    small = Image.fromarray(rgb).resize((MASTER, MASTER), Image.Resampling.LANCZOS)
    small_rgb = np.asarray(small)
    fg_img = Image.fromarray((foreground.astype(np.uint8) * 255), mode="L").resize(
        (MASTER, MASTER), Image.Resampling.NEAREST
    )
    fg = np.asarray(fg_img) > 127

    # Edge-preserving flatten: median removes photo grain before clustering.
    flat = np.asarray(Image.fromarray(small_rgb).filter(ImageFilter.MedianFilter(size=5)))
    # A second, lighter pass keeps facial planes without smearing the eyes.
    flat = np.asarray(Image.fromarray(flat).filter(ImageFilter.MedianFilter(size=3)))

    samples = flat[fg]
    if len(samples) < k:
        raise SystemExit("foreground is too small to quantize")
    model = MiniBatchKMeans(n_clusters=k, random_state=7, n_init=4, batch_size=4096)
    model.fit(samples.astype(np.float32))
    palette = np.clip(np.rint(model.cluster_centers_), 0, 255).astype(np.uint8)

    labels = np.full(flat.shape[:2], -1, dtype=np.int16)
    pred = model.predict(flat[fg].astype(np.float32))
    labels[fg] = pred.astype(np.int16)

    labels = mode_filter_labels(labels, radius=2)
    labels = drop_specks(labels, min_area=36)
    return labels, palette


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
            "8",
            "-a",
            "1.15",
            "-O",
            "0.25",
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
            if int(mask.sum()) < 24:
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
    parser.add_argument("--colors", type=int, default=COLORS)
    args = parser.parse_args()
    if args.from_photo:
        save_source_crop(args.from_photo, CROP_PATH)
        print(f"wrote crop {CROP_PATH}")
    if not CROP_PATH.exists():
        raise SystemExit(f"missing source crop: {CROP_PATH}")
    rgb = load_rgb(CROP_PATH)
    bg = background_mask(rgb)
    labels, palette = quantize(rgb, ~bg, args.colors)
    svg = build_svg(labels, palette)
    poster = posterized_rgba(labels, palette)
    write_outputs(svg, poster)
    # Contact sheet for visual QA at header size and a larger badge.
    sheet = Image.new("RGB", (48 + 180 + 48, 200), (5, 6, 10))
    sheet.paste(ring_png(poster, 48), (16, 76), ring_png(poster, 48))
    big = ring_png(poster, 180)
    sheet.paste(big, (80, 10), big)
    preview = ROOT / "src" / "portrait" / "preview-sheet.png"
    sheet.save(preview)
    print(f"wrote {preview}")


if __name__ == "__main__":
    main()
