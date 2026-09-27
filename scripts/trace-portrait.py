#!/usr/bin/env python3
"""Landmark-guided portrait mark for the site icon.

The illustration is derived from the committed head-and-shoulders crop:

* MediaPipe Face Landmarker places the jaw, ears, eyes, brows, nose, and smile.
* Hair and the sage polo come from the photograph (silhouette plus a bilateral
  smooth so the shirt breaks into a few flat tones).
* Eyes, brows, nose, and the open smile are drawn as clean vector shapes on
  top of three skin tones sampled from the lit face. Skin is not darkened.

No generative image model is used.

Regenerate from the repo root:

    python3 scripts/trace-portrait.py

To recrop from an original square headshot first:

    python3 scripts/trace-portrait.py --from-photo path/to/headshot.jpg
"""

from __future__ import annotations

import argparse
import os
import subprocess
import tempfile
import urllib.request
from pathlib import Path

# Quiet MediaPipe / TFLite before import.
os.environ.setdefault("GLOG_minloglevel", "2")

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
CROP_PATH = ROOT / "src" / "portrait" / "niraj-source-crop.jpg"
PUBLIC = ROOT / "public"
ICON_DIR = PUBLIC / "icons"
MODEL_PATH = Path("/tmp/portrait-models/face_landmarker.task")
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
    "face_landmarker/float16/1/face_landmarker.task"
)

# Studio backdrop in the source photo is a flat near-black gray.
BG_LEVEL = 16

# MediaPipe face-mesh indices. "Left" here is the viewer's left.
FACE_OVAL = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365,
    379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93,
    234, 127, 162, 21, 54, 103, 67, 109,
]
JAW = [
    234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378,
    379, 365, 397, 288, 361, 323, 454,
]
LEFT_EYE = [
    33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
]
RIGHT_EYE = [
    362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398,
]
LEFT_BROW = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46]
RIGHT_BROW = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276]
LIPS_OUTER = [
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0,
    37, 39, 40, 185,
]
LIPS_INNER = [
    78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13,
    82, 81, 80, 191,
]
LEFT_EYE_OUTER, LEFT_EYE_INNER = 33, 133
RIGHT_EYE_OUTER, RIGHT_EYE_INNER = 263, 362
LEFT_IRIS, RIGHT_IRIS = 468, 473
LEFT_IRIS_RIM = [469, 470, 471, 472]
RIGHT_IRIS_RIM = [474, 475, 476, 477]


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


def background_mask(rgb: np.ndarray) -> np.ndarray:
    """True where the pixel is studio backdrop, flood-filled from the edges."""
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


def hex_color(rgb) -> str:
    rgb = np.clip(np.rint(rgb), 0, 255).astype(int)
    return "#{:02x}{:02x}{:02x}".format(int(rgb[0]), int(rgb[1]), int(rgb[2]))


def ensure_model() -> Path:
    if MODEL_PATH.exists() and MODEL_PATH.stat().st_size > 1_000_000:
        return MODEL_PATH
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(f"downloading face landmarker → {MODEL_PATH}")
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    return MODEL_PATH


def detect_landmarks(rgb: np.ndarray) -> np.ndarray:
    from mediapipe.tasks.python.core import base_options as base_options_lib
    from mediapipe.tasks.python.vision import FaceLandmarker, FaceLandmarkerOptions
    from mediapipe.tasks.python.vision.core import image as image_lib

    h, w = rgb.shape[:2]
    mp_img = image_lib.Image(image_format=image_lib.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))
    opts = FaceLandmarkerOptions(
        base_options=base_options_lib.BaseOptions(model_asset_path=str(ensure_model())),
        num_faces=1,
    )
    landmarker = FaceLandmarker.create_from_options(opts)
    try:
        res = landmarker.detect(mp_img)
    finally:
        landmarker.close()
    if not res.face_landmarks:
        raise SystemExit("no face found in the source crop")
    lm = res.face_landmarks[0]
    pts = np.array([[p.x * w, p.y * h] for p in lm], dtype=np.float64)
    if len(pts) < 468:
        raise SystemExit(f"expected a face mesh, got {len(pts)} landmarks")
    return pts


def poly(pts: np.ndarray, idxs) -> np.ndarray:
    return pts[list(idxs)].astype(np.float64)


def catmull_rom_path(points, closed: bool = True) -> str:
    pts = np.asarray(points, dtype=float)
    if len(pts) < 2:
        return ""
    if len(pts) == 2:
        return f"M {pts[0,0]:.2f} {pts[0,1]:.2f} L {pts[1,0]:.2f} {pts[1,1]:.2f}"
    if closed:
        seq = np.vstack([pts[-1], pts, pts[0], pts[1]])
    else:
        seq = np.vstack([pts[0], pts, pts[-1]])
    parts = [f"M {seq[1, 0]:.2f} {seq[1, 1]:.2f}"]
    last = len(seq) - 2
    for i in range(1, last):
        p0, p1, p2, p3 = seq[i - 1], seq[i], seq[i + 1], seq[i + 2]
        c1 = p1 + (p2 - p0) / 6.0
        c2 = p2 - (p3 - p1) / 6.0
        parts.append(
            f"C {c1[0]:.2f} {c1[1]:.2f} {c2[0]:.2f} {c2[1]:.2f} {p2[0]:.2f} {p2[1]:.2f}"
        )
    if closed:
        parts.append("Z")
    return " ".join(parts)


def scale_along_axis(points, origin, axis_a, axis_b, sx: float, sy: float) -> np.ndarray:
    """Scale perpendicular to the axis through axis_a → axis_b."""
    pts = np.asarray(points, dtype=float)
    axis = np.asarray(axis_b, dtype=float) - np.asarray(axis_a, dtype=float)
    norm = np.linalg.norm(axis)
    if norm < 1e-3:
        c = pts.mean(axis=0)
        return (pts - c) * np.array([sx, sy]) + c
    ang = np.arctan2(axis[1], axis[0])
    cos, sin = np.cos(ang), np.sin(ang)
    rot = np.array([[cos, sin], [-sin, cos]])
    origin = np.asarray(origin, dtype=float)
    local = (pts - origin) @ rot.T
    local *= np.array([sx, sy])
    return local @ rot + origin


def fill_small_holes(mask: np.ndarray, max_area: int) -> np.ndarray:
    inv = (~mask).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(inv, 8)
    out = mask.copy()
    h, w = mask.shape
    for i in range(1, n):
        x, y, ww, hh, area = stats[i]
        if area > max_area or area < 1:
            continue
        if x == 0 or y == 0 or x + ww >= w or y + hh >= h:
            continue
        out[labels == i] = True
    return out


def keep_large(mask: np.ndarray, min_area: int) -> np.ndarray:
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    out = np.zeros(mask.shape, dtype=bool)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= min_area:
            out[labels == i] = True
    return out


def tidy(mask: np.ndarray, open_px: int, close_px: int, min_area: int, hole_area: int) -> np.ndarray:
    m = mask.astype(np.uint8)
    if open_px >= 3:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (open_px, open_px))
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, k)
    if close_px >= 3:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_px, close_px))
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k)
    out = keep_large(m > 0, min_area)
    return fill_small_holes(out, hole_area)


def trace_mask(mask: np.ndarray, tmp: Path, fill: str, stroke: str | None = None, stroke_px: float = 0) -> str:
    """Potrace a boolean mask into an SVG group aligned to the bitmap."""
    if int(mask.sum()) < 30:
        return ""
    ink = Image.fromarray(np.where(mask, 0, 255).astype(np.uint8), mode="L")
    bmp = tmp / "mask.bmp"
    svg = tmp / "mask.svg"
    ink.save(bmp)
    subprocess.check_call(
        ["potrace", "-s", "-o", str(svg), "-t", "12", "-a", "1.15", "-O", "0.9", "--flat", str(bmp)],
        stdout=subprocess.DEVNULL,
    )
    text = svg.read_text()
    start = text.find("<g")
    end = text.rfind("</g>")
    if start < 0 or end < 0:
        return ""
    group = text[start : end + 4]
    # Potrace scales by 0.1, so a stroke of N bitmap px is 10N in group space.
    extra = ""
    if stroke and stroke_px > 0:
        extra = (
            f' stroke="{stroke}" stroke-width="{stroke_px * 10:.1f}"'
            f' stroke-linejoin="round" stroke-linecap="round"'
        )
    group = group.replace('fill="#000000"', f'fill="{fill}"{extra}', 1)
    if 'fill=' not in group.split(">", 1)[0]:
        group = group.replace("<g", f'<g fill="{fill}"{extra}', 1)
    return group


def polygon_mask(shape, points) -> np.ndarray:
    m = np.zeros(shape, dtype=np.uint8)
    p = np.round(np.asarray(points)).astype(np.int32)
    if len(p) >= 3:
        cv2.fillPoly(m, [p], 255)
    return m > 0


def median_color(rgb: np.ndarray, mask: np.ndarray, fallback) -> np.ndarray:
    if int(mask.sum()) < 20:
        return np.asarray(fallback, dtype=float)
    return np.median(rgb[mask], axis=0).astype(float)


def percentile_color(rgb: np.ndarray, mask: np.ndarray, q: float, fallback) -> np.ndarray:
    if int(mask.sum()) < 20:
        return np.asarray(fallback, dtype=float)
    return np.percentile(rgb[mask], q, axis=0).astype(float)


def shift(rgb, dv: float = 0, ds: float = 0) -> np.ndarray:
    """Move brightness (value) and saturation a little, staying in the same hue."""
    arr = np.clip(np.rint(rgb), 0, 255).astype(np.uint8).reshape(1, 1, 3)
    hsv = cv2.cvtColor(arr, cv2.COLOR_RGB2HSV).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] + ds, 0, 255)
    hsv[..., 2] = np.clip(hsv[..., 2] + dv, 0, 255)
    out = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)[0, 0]
    return out.astype(float)


def hair_strand_paths(hair: np.ndarray, lum: np.ndarray) -> list[np.ndarray]:
    """Two or three polylines along the brighter ridges of the hair."""
    ys, xs = np.where(hair)
    if len(ys) < 50:
        return []
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    span = max(1, x1 - x0)
    bands = [
        (x0 + int(span * 0.08), x0 + int(span * 0.42), 0.08, 0.58),
        (x0 + int(span * 0.48), x0 + int(span * 0.78), 0.04, 0.42),
        (x0 + int(span * 0.70), x0 + int(span * 0.95), 0.18, 0.50),
    ]
    strands = []
    for xa, xb, y_from, y_to in bands:
        if xb - xa < 12:
            continue
        pts = []
        ya = y0 + int((y1 - y0) * y_from)
        yb = y0 + int((y1 - y0) * y_to)
        for y in range(ya, yb, 5):
            seg = lum[y, xa:xb]
            m = hair[y, xa:xb]
            if int(m.sum()) < 4:
                continue
            vals = np.where(m, seg, -1.0)
            x = xa + int(np.argmax(vals))
            pts.append((x, y))
        if len(pts) < 5:
            continue
        arr = np.asarray(pts, dtype=float)
        # Smooth the ridge so the strand is a clean stroke, not a jitter.
        kernel = np.array([1, 2, 3, 2, 1], dtype=float)
        kernel /= kernel.sum()
        pad = 2
        xsmooth = np.convolve(np.pad(arr[:, 0], pad, mode="edge"), kernel, mode="valid")
        arr[:, 0] = xsmooth
        # Drop points that wandered out of the hair.
        keep = []
        h, w = hair.shape
        for x, y in arr[::2]:
            xi, yi = int(round(x)), int(round(y))
            if 0 <= yi < h and 0 <= xi < w and hair[yi, xi]:
                keep.append((x, y))
        if len(keep) >= 4:
            strands.append(np.asarray(keep, dtype=float))
    return strands[:3]


def _median_1d(values: np.ndarray, width: int) -> np.ndarray:
    pad = width // 2
    padded = np.pad(values, pad, mode="edge")
    out = np.empty_like(values)
    for i in range(len(values)):
        out[i] = np.median(padded[i : i + width])
    return out


def collar_and_shirt(rgb: np.ndarray, fg: np.ndarray, face: np.ndarray, chin_y: float):
    """Polo from the photo: sage pixels below the jaw, smoothed into a collar line.

    The shirt is everything in the foreground under that line, so a shadowed
    fold stays inside the polo instead of punching a hole. The neck is only the
    gap between the chin and the collar.
    """
    h, w = rgb.shape[:2]
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    lum = rgb.astype(np.float32).mean(axis=2)
    sage = (
        (np.arange(h)[:, None] > chin_y - 110)
        & fg
        & (g > r + 1)
        & (g + 3 >= b)
        & (lum > 48)
        & (g > 68)
    )
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    sage = cv2.morphologyEx(sage.astype(np.uint8), cv2.MORPH_OPEN, k) > 0
    top = np.full(w, np.nan)
    for x in range(w):
        col = np.where(sage[:, x])[0]
        if len(col) > 25:
            top[x] = float(col.min())
    xs = np.arange(w)
    good = np.isfinite(top)
    if int(good.sum()) < 40:
        raise SystemExit("could not find the sage polo in the source crop")
    filled = np.interp(xs, xs[good], top[good])
    # Median removes single-pixel spikes; a light blur keeps the collar V.
    med = _median_1d(filled, 27)
    blurred = cv2.GaussianBlur(filled.astype(np.float32).reshape(1, -1), (0, 0), 5).ravel()
    collar = 0.72 * med + 0.28 * blurred

    shirt = np.zeros((h, w), dtype=bool)
    neck = np.zeros((h, w), dtype=bool)
    for x in range(w):
        y_col = int(round(collar[x]))
        if y_col < 0 or y_col >= h:
            continue
        face_ys = np.where(face[:, x])[0]
        y_jaw = int(face_ys.max()) if len(face_ys) else y_col
        if y_col > y_jaw + 2:
            neck[y_jaw:y_col, x] = True
        for y in range(max(y_col, 0), h):
            if not fg[y, x]:
                break
            shirt[y, x] = True
    shirt = shirt & ~face
    neck = neck & ~face & fg
    neck = tidy(neck, open_px=3, close_px=9, min_area=200, hole_area=1500)
    return collar, shirt, neck


def build_materials(rgb: np.ndarray, pts: np.ndarray):
    h, w = rgb.shape[:2]
    bg = background_mask(rgb)
    fg = ~bg
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    lum = rgb.astype(np.float32).mean(axis=2)

    face = polygon_mask((h, w), poly(pts, FACE_OVAL))
    mouth = polygon_mask((h, w), poly(pts, LIPS_OUTER))
    eyes = polygon_mask((h, w), poly(pts, LEFT_EYE)) | polygon_mask((h, w), poly(pts, RIGHT_EYE))
    brows = polygon_mask((h, w), poly(pts, LEFT_BROW)) | polygon_mask((h, w), poly(pts, RIGHT_BROW))

    chin = pts[152]
    collar, shirt, neck = collar_and_shirt(rgb, fg, face, float(chin[1]))

    skin_color = (r > g + 8) & (r > b + 12) & (lum > 48)
    ys = np.where(face)[0]
    y_cut = int(ys.min() + 0.16 * (ys.max() - ys.min())) if len(ys) else 0
    lit = face & ~eyes & ~mouth & ~brows & (np.arange(h)[:, None] > y_cut) & (lum > 70) & skin_color

    hair_raw = fg & ~shirt & ~neck & (lum < 78) & ~skin_color
    bangs_y = int(min(pts[107][1], pts[336][1]))
    bangs = face & (lum < 58) & (np.arange(h)[:, None] < bangs_y) & ~eyes & ~brows
    hair_raw = hair_raw | bangs
    hair = tidy(hair_raw, open_px=3, close_px=7, min_area=400, hole_area=1800)
    hair = hair & ~neck & ~shirt

    # Bilateral smooth is only for splitting the polo into a few flat tones.
    smooth = cv2.bilateralFilter(rgb, 21, 70, 14)
    smooth = cv2.bilateralFilter(smooth, 13, 50, 10)
    sl = smooth.astype(np.float32).mean(axis=2)
    bands = []
    if shirt.any():
        qs = np.quantile(sl[shirt], [0.34, 0.67])
        raw_bands = [
            shirt & (sl <= qs[0]),
            shirt & (sl > qs[0]) & (sl <= qs[1]),
            shirt & (sl > qs[1]),
        ]
        for band in raw_bands:
            cleaned = tidy(band, open_px=9, close_px=15, min_area=900, hole_area=3500)
            bands.append(cleaned)
        assigned = bands[0] | bands[1] | bands[2]
        bands[1] = bands[1] | (shirt & ~assigned)

    return {
        "bg": bg,
        "face": face,
        "neck": neck,
        "hair": hair,
        "shirt": shirt,
        "shirt_bands": bands,
        "lit": lit,
        "mouth": mouth,
        "collar": collar,
        "lum": lum,
        "smooth": smooth,
    }


def svg_ellipse(cx, cy, rx, ry, fill, rotate=0.0, stroke=None, sw=0) -> str:
    extra = ""
    if stroke and sw:
        extra = f' stroke="{stroke}" stroke-width="{sw:.1f}"'
    rot = ""
    if abs(rotate) > 0.2:
        rot = f' transform="rotate({rotate:.2f} {cx:.2f} {cy:.2f})"'
    return (
        f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="{rx:.2f}" ry="{ry:.2f}"'
        f' fill="{fill}"{extra}{rot}/>'
    )


def feature_group(pts, rgb, materials, colors) -> str:
    """Eyes, brows, nose, and smile as crisp vector shapes on the landmarks."""
    parts: list[str] = []
    ink = colors["ink"]
    h, w = rgb.shape[:2]

    # --- brows (filled mesh, slightly thickened) ---
    for idxs in (LEFT_BROW, RIGHT_BROW):
        brow = poly(pts, idxs)
        c = brow.mean(axis=0)
        thick = (brow - c) * np.array([1.08, 1.75]) + c
        parts.append(
            f'<path d="{catmull_rom_path(thick)}" fill="{colors["brow"]}"'
            f' stroke="{ink}" stroke-width="3.5" stroke-linejoin="round"/>'
        )

    # --- eyes ---
    eye_specs = [
        (LEFT_EYE, LEFT_EYE_OUTER, LEFT_EYE_INNER, LEFT_IRIS, LEFT_IRIS_RIM, "eyeL"),
        (RIGHT_EYE, RIGHT_EYE_OUTER, RIGHT_EYE_INNER, RIGHT_IRIS, RIGHT_IRIS_RIM, "eyeR"),
    ]
    for idxs, outer_i, inner_i, iris_i, rim, clip_id in eye_specs:
        eye = poly(pts, idxs)
        outer, inner = pts[outer_i], pts[inner_i]
        width = float(np.linalg.norm(outer - inner))
        measured_h = float(eye[:, 1].max() - eye[:, 1].min())
        # Open the squint just enough that sclera, iris, and a catchlight exist,
        # without turning the smile into a stare.
        # Keep the smiling squint: open only enough for sclera at the corners.
        target_h = float(np.clip(max(measured_h * 1.12, width * 0.34), width * 0.32, width * 0.44))
        sy = target_h / max(measured_h, 1.0)
        origin = eye.mean(axis=0)
        eye_s = scale_along_axis(eye, origin, outer, inner, 1.06, sy)
        iris_c = scale_along_axis(pts[iris_i][None, :], origin, outer, inner, 1.06, sy)[0]
        rim_pts = scale_along_axis(pts[rim], origin, outer, inner, 1.06, sy)
        iris_r = float(np.linalg.norm(rim_pts - iris_c, axis=1).mean())
        iris_r = float(np.clip(iris_r * 1.08, width * 0.20, target_h * 0.62))
        d = catmull_rom_path(eye_s)
        parts.append(f'<clipPath id="{clip_id}"><path d="{d}"/></clipPath>')
        parts.append(
            f'<path d="{d}" fill="{colors["sclera"]}" stroke="{ink}"'
            f' stroke-width="7" stroke-linejoin="round"/>'
        )
        parts.append(f'<g clip-path="url(#{clip_id})">')
        parts.append(svg_ellipse(iris_c[0], iris_c[1], iris_r, iris_r * 0.96, colors["iris"]))
        pup = iris_r * 0.50
        parts.append(svg_ellipse(iris_c[0], iris_c[1] + iris_r * 0.04, pup, pup, colors["pupil"]))
        cl = iris_r * 0.30
        parts.append(
            svg_ellipse(
                iris_c[0] - iris_r * 0.32,
                iris_c[1] - iris_r * 0.30,
                cl,
                cl * 0.85,
                colors["catch"],
            )
        )
        parts.append("</g>")
        # Upper lid line sits on the landmark lid so the smile squint stays.
        lid_idx = {
            "eyeL": [33, 246, 161, 160, 159, 158, 157, 173, 133],
            "eyeR": [263, 466, 388, 387, 386, 385, 384, 398, 362],
        }[clip_id]
        lid = scale_along_axis(pts[lid_idx], origin, outer, inner, 1.06, sy)
        parts.append(
            f'<path d="{catmull_rom_path(lid, closed=False)}" fill="none"'
            f' stroke="{ink}" stroke-width="8.5" stroke-linecap="round"/>'
        )

    # Nose: nostril curve and a short side shadow. No line down the bridge.
    side = pts[[195, 5, 51, 45, 98]]
    parts.append(
        f'<path d="{catmull_rom_path(side, closed=False)}" fill="none"'
        f' stroke="{colors["shadow"]}" stroke-width="7" stroke-linecap="round"/>'
    )
    nostril = pts[[98, 97, 2, 326, 327]]
    parts.append(
        f'<path d="{catmull_rom_path(nostril, closed=False)}" fill="none"'
        f' stroke="{ink}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>'
    )
    tip = pts[4]
    top = pts[6]
    nx, ny = (tip * 0.45 + top * 0.55)
    parts.append(svg_ellipse(nx, ny, 8, 20, colors["highlight"], rotate=-6))

    # --- smile ---
    # Open the lips vertically around the corner axis so teeth read at icon size.
    outer = poly(pts, LIPS_OUTER)
    inner = poly(pts, LIPS_INNER)
    corner_l, corner_r = pts[61], pts[291]
    mouth_origin = (corner_l + corner_r) / 2
    open_y = 1.55
    outer_s = scale_along_axis(outer, mouth_origin, corner_l, corner_r, 1.0, open_y)
    inner_s = scale_along_axis(inner, mouth_origin, corner_l, corner_r, 1.0, open_y)
    lip_d = catmull_rom_path(outer_s) + " " + catmull_rom_path(inner_s)
    parts.append(
        f'<path d="{lip_d}" fill="{colors["lip"]}" fill-rule="evenodd"'
        f' stroke="{ink}" stroke-width="6" stroke-linejoin="round"/>'
    )
    parts.append(
        f'<path d="{catmull_rom_path(inner_s)}" fill="{colors["teeth"]}"/>'
    )
    # Shadow under the upper teeth, following the lower inner lip.
    lower_inner = inner_s[inner_s[:, 1] >= np.median(inner_s[:, 1]) - 1]
    if len(lower_inner) >= 4:
        lower_inner = lower_inner[np.argsort(lower_inner[:, 0])]
        # Raise a copy of the lower lip to form the top of the oral shadow.
        lift = lower_inner.copy()
        span = float(inner_s[:, 1].max() - inner_s[:, 1].min())
        lift[:, 1] -= span * 0.42
        shadow_pts = np.vstack([lift, lower_inner[::-1]])
        parts.append(f'<path d="{catmull_rom_path(shadow_pts)}" fill="{colors["mouth"]}"/>')
        # A few tooth divisions, low contrast, so the smile is not one pill.
        x0, x1 = float(inner_s[:, 0].min()), float(inner_s[:, 0].max())
        y_top = float(inner_s[:, 1].min())
        y_bot = y_top + span * 0.62
        gaps = []
        for t in (0.30, 0.46, 0.62, 0.76):
            x = x0 + (x1 - x0) * t
            gaps.append(
                f'M {x:.2f} {y_top + span * 0.08:.2f} L {x:.2f} {y_bot:.2f}'
            )
        parts.append(
            f'<path d="{" ".join(gaps)}" fill="none" stroke="{colors["tooth_line"]}"'
            f' stroke-width="2.4" stroke-linecap="round"/>'
        )

    # Jaw ink, ears get their own shapes earlier. Hairline is the hair outline.
    jaw = poly(pts, JAW)
    parts.append(
        f'<path d="{catmull_rom_path(jaw, closed=False)}" fill="none"'
        f' stroke="{ink}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>'
    )
    return "\n".join(parts)


def ear_shapes(pts, colors) -> str:
    parts = []
    chin_y = pts[152][1]
    brow_y = min(pts[105][1], pts[334][1])
    face_h = max(40.0, chin_y - brow_y)
    ry = face_h * 0.16
    rx = ry * 0.48
    ink = colors["ink"]
    for anchor, sign in ((234, -1), (454, 1)):
        c = pts[anchor] + np.array([sign * rx * 0.35, ry * 0.05])
        parts.append(svg_ellipse(c[0], c[1], rx, ry, colors["skin"], stroke=ink, sw=6))
        parts.append(
            svg_ellipse(c[0] + sign * rx * 0.08, c[1] + ry * 0.05, rx * 0.45, ry * 0.62, colors["shadow"])
        )
    return "\n".join(parts)


def skin_shapes(pts, colors) -> str:
    """Three flat skin tones sampled from the photo: base, highlight, a small shadow."""
    face = poly(pts, FACE_OVAL)
    parts = [f'<path d="{catmull_rom_path(face)}" fill="{colors["skin"]}"/>']
    brow_c = (pts[107] + pts[336]) / 2
    hairline = pts[10]
    fhc = hairline * 0.28 + brow_c * 0.72
    parts.append(svg_ellipse(fhc[0], fhc[1], 70, 26, colors["highlight"]))
    # Light falls on the viewer's-left cheek in the photo; the other cheek is the shadow tone.
    lit = pts[50]
    shade = pts[280]
    parts.append(svg_ellipse(lit[0], lit[1], 48, 32, colors["highlight"], rotate=-16))
    parts.append(svg_ellipse(shade[0] + 8, shade[1] + 6, 40, 28, colors["shadow"], rotate=18))
    # Short shadow under the lower lip. Kept inside the chin so it cannot melt the jaw.
    lip_b = pts[17]
    chin = pts[152]
    mid = (lip_b + chin) / 2
    parts.append(svg_ellipse(mid[0], mid[1], 52, 16, colors["shadow"]))
    return "\n".join(parts)


def collar_stroke(materials, colors) -> str:
    collar = materials["collar"]
    present = np.where(materials["shirt"].any(axis=0))[0]
    if len(present) < 8:
        return ""
    xs = np.arange(int(present.min()) + 4, int(present.max()) - 4, 4)
    pts = np.stack([xs.astype(float), collar[xs]], axis=1)
    # Drop the flat backdrop beyond the shoulders: keep the span that actually dips and rises.
    if len(pts) < 8:
        return ""
    return (
        f'<path d="{catmull_rom_path(pts, closed=False)}" fill="none"'
        f' stroke="{colors["shirt_ink"]}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>'
    )


def build_svg(rgb: np.ndarray, pts: np.ndarray, materials, colors) -> str:
    h, w = rgb.shape[:2]
    layers: list[str] = []
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        # Shirt, dark to light, then a crisp outline band.
        shirt_colors = [colors["shirt_dark"], colors["shirt_mid"], colors["shirt_light"]]
        for band, col in zip(materials["shirt_bands"], shirt_colors):
            layers.append(trace_mask(band, tmp, col))
        if materials["shirt"].any():
            k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
            shirt_u8 = materials["shirt"].astype(np.uint8)
            outline = (cv2.dilate(shirt_u8, k) > 0) & ~materials["shirt"]
            outline = keep_large(outline, 80)
            layers.append(trace_mask(outline, tmp, colors["shirt_ink"]))
        if materials["neck"].any():
            layers.append(trace_mask(materials["neck"], tmp, colors["neck"]))
        layers.append(ear_shapes(pts, colors))
        layers.append(skin_shapes(pts, colors))
        layers.append(collar_stroke(materials, colors))
        # Hair silhouette from the photo, then a couple of highlight strokes.
        layers.append(trace_mask(materials["hair"], tmp, colors["hair"]))
        # A lighter rim where the photo actually has mid-tone hair, kept large only.
        hair_lum = materials["lum"]
        if materials["hair"].any():
            thresh = np.quantile(hair_lum[materials["hair"]], 0.72)
            rim = tidy(
                materials["hair"] & (hair_lum >= thresh) & (hair_lum < 110),
                open_px=3,
                close_px=9,
                min_area=700,
                hole_area=600,
            )
            layers.append(trace_mask(rim, tmp, colors["hair_mid"]))
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        hair_u8 = materials["hair"].astype(np.uint8)
        hair_edge = (cv2.dilate(hair_u8, k) > 0) & ~materials["hair"] & ~materials["face"]
        hair_edge = keep_large(hair_edge, 60)
        layers.append(trace_mask(hair_edge, tmp, colors["ink"]))
        for strand in hair_strand_paths(materials["hair"], hair_lum):
            layers.append(
                f'<path d="{catmull_rom_path(strand, closed=False)}" fill="none"'
                f' stroke="{colors["hair_hi"]}" stroke-width="10" stroke-linecap="round"/>'
            )
        layers.append(feature_group(pts, rgb, materials, colors))

    cx, cy = w / 2, h / 2
    radius = w / 2
    ring = max(8.0, w * 0.018)
    body = "\n".join(p for p in layers if p)
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="Illustrated portrait of Niraj Bhusal">
  <circle cx="{cx:.1f}" cy="{cy:.1f}" r="{radius:.1f}" fill="#07090f"/>
  <g clip-path="url(#mark-clip)">
{body}
  </g>
  <circle cx="{cx:.1f}" cy="{cy:.1f}" r="{radius - ring * 0.6:.1f}" fill="none" stroke="#3b9eff" stroke-width="{ring:.1f}" opacity="0.95"/>
  <defs>
    <clipPath id="mark-clip">
      <circle cx="{cx:.1f}" cy="{cy:.1f}" r="{radius:.1f}"/>
    </clipPath>
  </defs>
</svg>
'''


def disk_mask(shape, center, radius: float) -> np.ndarray:
    h, w = shape
    yy, xx = np.ogrid[:h, :w]
    return (xx - center[0]) ** 2 + (yy - center[1]) ** 2 <= radius ** 2


def choose_colors(rgb: np.ndarray, materials, pts: np.ndarray) -> dict:
    h, w = rgb.shape[:2]
    # Skin tones come from the cheeks and the nose highlight in the photograph.
    # The base follows the lit cheek, not the shadowed jaw, so the face stays warm.
    lit_cheek = disk_mask((h, w), pts[50], 26)
    shade_cheek = disk_mask((h, w), pts[280], 26)
    forehead = disk_mask((h, w), (pts[10] * 0.25 + (pts[107] + pts[336]) / 2 * 0.75), 22)
    nose = disk_mask((h, w), pts[4], 14)
    lit_c = percentile_color(rgb, lit_cheek, 50, (218, 162, 130))
    fore_c = percentile_color(rgb, forehead, 55, (190, 133, 103))
    base = lit_c * 0.62 + fore_c * 0.38
    highlight = percentile_color(rgb, nose, 60, (232, 180, 148))
    shadow = percentile_color(rgb, shade_cheek, 45, (193, 131, 95))
    # Never darker than the shaded cheek itself.
    shadow = np.maximum(shadow, percentile_color(rgb, shade_cheek, 30, (180, 120, 88)))

    hair = median_color(rgb, materials["hair"], (28, 18, 12))
    hair = np.minimum(hair, (42, 28, 20))  # keep the mass dark
    hair_mid = percentile_color(rgb, materials["hair"], 90, (78, 56, 40))
    hair_mid = np.clip(hair_mid, (68, 48, 34), (120, 88, 64))
    hair_hi = np.clip(hair_mid + np.array([36, 28, 18]), 0, 190)

    bands = materials["shirt_bands"]
    shirt_samples = []
    for band, fb in zip(bands, ((129, 143, 115), (157, 173, 145), (189, 206, 181))):
        shirt_samples.append(median_color(rgb, band, fb))
    while len(shirt_samples) < 3:
        shirt_samples.append(np.array([157, 173, 145], dtype=float))

    # Lip colour from the lip ring itself (the outer polygon also covers the teeth).
    lip = colors_lip(rgb, pts)
    lip = shift(lip, dv=-4, ds=16)
    # Teeth: bright pixels inside the inner lip, kept warm ivory.
    inner = None  # filled by caller via materials if present
    teeth = np.array([214, 180, 152], dtype=float)

    return {
        "skin": hex_color(base),
        "highlight": hex_color(highlight),
        "shadow": hex_color(shadow),
        "hair": hex_color(hair),
        "hair_mid": hex_color(hair_mid),
        "hair_hi": hex_color(hair_hi),
        "shirt_dark": hex_color(shirt_samples[0]),
        "shirt_mid": hex_color(shirt_samples[1]),
        "shirt_light": hex_color(shirt_samples[2]),
        "shirt_ink": hex_color(np.clip(shirt_samples[0] * 0.62, 40, 120)),
        "ink": "#2a1810",
        "brow": "#1c120c",
        "sclera": "#f3eadf",
        "iris": "#3a2418",
        "pupil": "#140c08",
        "catch": "#fffaf3",
        "lip": hex_color(np.clip(lip, 0, 230)),
        "neck": hex_color(neck_tone(rgb, materials, shadow)),
        "teeth": hex_color(teeth),
        "tooth_line": "#e7d0b8",
        "mouth": "#6e4034",
        "_base": base,
        "_highlight": highlight,
        "_shadow": shadow,
    }


def colors_lip(rgb: np.ndarray, pts: np.ndarray) -> np.ndarray:
    h, w = rgb.shape[:2]
    outer = polygon_mask((h, w), poly(pts, LIPS_OUTER))
    inner = polygon_mask((h, w), poly(pts, LIPS_INNER))
    ring = outer & ~inner
    return median_color(rgb, ring, (176, 104, 88))


def neck_tone(rgb: np.ndarray, materials, shadow: np.ndarray) -> np.ndarray:
    """Shadowed neck inside the collar. Darker than the face, not crushed to black."""
    sampled = median_color(rgb, materials["neck"], shadow)
    floor = np.array([128, 84, 60], dtype=float)
    return np.minimum(np.maximum(sampled, floor), np.asarray(shadow, dtype=float))


def sample_teeth(rgb, pts) -> np.ndarray:
    h, w = rgb.shape[:2]
    m = polygon_mask((h, w), poly(pts, LIPS_INNER))
    pix = rgb[m]
    if len(pix) < 10:
        return np.array([214, 180, 152], dtype=float)
    lum = pix.astype(float).mean(1)
    bright = pix[lum >= np.percentile(lum, 55)]
    color = np.median(bright, axis=0).astype(float)
    # A small lift toward ivory so the teeth separate from the lip, same hue.
    return np.clip(color + (255.0 - color) * 0.16, 0, 245)


def rasterize(svg_path: Path, size: int, dest: Path) -> Image.Image:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        ["rsvg-convert", "-w", str(size), "-h", str(size), "-o", str(dest), str(svg_path)],
    )
    return Image.open(dest).convert("RGBA")


def write_outputs(svg: str) -> Path:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    svg_path = ICON_DIR / "niraj-mark.svg"
    svg_path.write_text(svg)
    (PUBLIC / "favicon.svg").write_text(svg)
    # Rasterise from the SVG so the PNG assets match the vectors.
    master = rasterize(svg_path, 512, ICON_DIR / "niraj-mark-512.png")
    master.save(ICON_DIR / "niraj-mark.png")
    rasterize(svg_path, 32, PUBLIC / "favicon-32.png")
    rasterize(svg_path, 180, PUBLIC / "apple-touch-icon.png")
    rasterize(svg_path, 512, PUBLIC / "og-image.png")
    print(f"wrote {svg_path} ({svg_path.stat().st_size} bytes)")
    for name in ("favicon.svg", "favicon-32.png", "apple-touch-icon.png", "og-image.png"):
        print(f"wrote {PUBLIC / name}")
    return svg_path


def save_review(svg_path: Path, rgb: np.ndarray, pts: np.ndarray, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    ill = rasterize(svg_path, 512, out_dir / "avatar-512.png")
    photo = Image.fromarray(rgb, mode="RGB").resize((512, 512), Image.Resampling.LANCZOS)
    # Side by side.
    sheet = Image.new("RGB", (512 * 2 + 24, 512 + 36), (12, 14, 20))
    sheet.paste(photo, (8, 28))
    sheet.paste(ill.convert("RGB"), (512 + 16, 28), ill)
    draw = ImageDraw.Draw(sheet)
    draw.text((12, 6), "photo", fill=(220, 224, 230))
    draw.text((528, 6), "illustration", fill=(220, 224, 230))
    sheet.save(out_dir / "compare-512.png")

    def icon40(im: Image.Image) -> Image.Image:
        small = im.resize((40, 40), Image.Resampling.LANCZOS)
        return small.resize((320, 320), Image.Resampling.NEAREST)

    photo_c = photo.copy()
    # Circle-crop the photo so the 40px test matches the badge.
    arr = np.array(photo_c.convert("RGBA"))
    yy, xx = np.ogrid[:512, :512]
    disk = (xx - 255.5) ** 2 + (yy - 255.5) ** 2 <= 255 ** 2
    arr[..., 3] = np.where(disk, 255, 0)
    photo_badge = Image.fromarray(arr, mode="RGBA")
    row = Image.new("RGB", (320 * 2 + 24, 320 + 36), (12, 14, 20))
    a = icon40(photo_badge)
    b = icon40(ill)
    row.paste(a.convert("RGB"), (8, 28))
    row.paste(b.convert("RGB"), (320 + 16, 28), b)
    d2 = ImageDraw.Draw(row)
    d2.text((12, 6), "photo at 40px", fill=(220, 224, 230))
    d2.text((336, 6), "illustration at 40px", fill=(220, 224, 230))
    row.save(out_dir / "compare-40.png")

    # Alignment check: illustration over the photo.
    blend = Image.blend(photo.convert("RGBA"), ill.resize((512, 512)), 0.55)
    blend.convert("RGB").save(out_dir / "overlay.png")

    # Zooms of eyes and mouth on the 512 illustration, next to the photo.
    def zoom(box, name):
        x0, y0, x1, y1 = box
        z = Image.new("RGB", ((x1 - x0) * 2 + 12, y1 - y0), (12, 14, 20))
        z.paste(photo.crop(box), (0, 0))
        z.paste(ill.crop(box).convert("RGB"), (x1 - x0 + 12, 0), ill.crop(box))
        z.save(out_dir / name)

    # Map landmark boxes from source pixels into the 512 render.
    scale = 512 / rgb.shape[0]
    def box_of(idxs, pad):
        p = pts[list(idxs)] * scale
        x0 = int(max(0, p[:, 0].min() - pad))
        y0 = int(max(0, p[:, 1].min() - pad))
        x1 = int(min(511, p[:, 0].max() + pad))
        y1 = int(min(511, p[:, 1].max() + pad))
        return (x0, y0, x1, y1)

    zoom(box_of(LEFT_EYE + RIGHT_EYE + LEFT_BROW + RIGHT_BROW, 18), "zoom-eyes.png")
    zoom(box_of(LIPS_OUTER, 16), "zoom-mouth.png")
    print(f"review images in {out_dir}")


def critique(rgb: np.ndarray, svg_path: Path, pts: np.ndarray) -> None:
    """Print plain measurements so a dark or melted face cannot hide in a description."""
    ill = rasterize(svg_path, rgb.shape[0], Path("/tmp/portrait-critique.png"))
    arr = np.array(ill.convert("RGB"))
    h, w = rgb.shape[:2]

    def mean_in(mask, image):
        if int(mask.sum()) < 10:
            return None
        return image[mask].mean(axis=0)

    face = polygon_mask((h, w), poly(pts, FACE_OVAL))
    eyes = polygon_mask((h, w), poly(pts, LEFT_EYE)) | polygon_mask((h, w), poly(pts, RIGHT_EYE))
    mouth = polygon_mask((h, w), poly(pts, LIPS_INNER))
    photo_face = mean_in(face & (rgb.mean(2) > 70), rgb)
    ill_face = mean_in(face, arr)
    print("photo lit-face mean", None if photo_face is None else np.round(photo_face, 1))
    print("illustration face mean", None if ill_face is None else np.round(ill_face, 1))
    if photo_face is not None and ill_face is not None:
        print("face luminance photo/ill", round(float(photo_face.mean()), 1), round(float(ill_face.mean()), 1))
    # At 40px, eye boxes should contain both a light and a dark pixel.
    small = np.array(ill.resize((40, 40), Image.Resampling.LANCZOS).convert("RGB"))
    s = 40 / h
    for name, idxs in ("eyes", LEFT_EYE + RIGHT_EYE), ("mouth", LIPS_INNER):
        p = pts[list(idxs)] * s
        x0, y0 = np.floor(p.min(0)).astype(int) - 1
        x1, y1 = np.ceil(p.max(0)).astype(int) + 1
        x0, y0 = max(0, x0), max(0, y0)
        x1, y1 = min(39, x1), min(39, y1)
        crop = small[y0 : y1 + 1, x0 : x1 + 1]
        lum = crop.mean(2)
        print(
            f"40px {name} box {crop.shape[1]}x{crop.shape[0]}"
            f" lum {lum.min():.0f}-{lum.max():.0f} mean {lum.mean():.0f}"
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--from-photo", type=Path, help="original headshot to crop before tracing")
    parser.add_argument(
        "--review",
        type=Path,
        default=Path("/tmp/portrait-review"),
        help="directory for side-by-side review renders",
    )
    args = parser.parse_args()
    if args.from_photo:
        save_source_crop(args.from_photo, CROP_PATH)
        print(f"wrote crop {CROP_PATH}")
    if not CROP_PATH.exists():
        raise SystemExit(f"missing source crop: {CROP_PATH}")
    rgb = load_rgb(CROP_PATH)
    pts = detect_landmarks(rgb)
    materials = build_materials(rgb, pts)
    colors = choose_colors(rgb, materials, pts)
    colors["teeth"] = hex_color(sample_teeth(rgb, pts))
    print("chin", np.round(pts[152], 1), "collar mid", round(float(materials["collar"][int(pts[152][0])]), 1))
    print(
        "colors",
        {k: v for k, v in colors.items() if not k.startswith("_")},
    )
    svg = build_svg(rgb, pts, materials, colors)
    svg_path = write_outputs(svg)
    save_review(svg_path, rgb, pts, args.review)
    critique(rgb, svg_path, pts)


if __name__ == "__main__":
    main()
