#!/usr/bin/env python3
"""
Regenerate the iOS apple-touch-startup-image splash screens
(frontend/public/brand/splash/*.png) from the real logo mark.

Run from anywhere — paths are resolved relative to this file, i.e. the
repo root two directories up. Requires Pillow (`pip install Pillow`).

Background: #0A0C10 — matches frontend/public/manifest.json's
background_color/theme_color and MobileFrame's actual inner background
(what the app looks like once painted, not white, not a placeholder).

Device list must stay in sync with
frontend/src/lib/appleSplashScreens.ts's DEVICES array — if you add/remove
a device here, update that file's media queries to match (and vice versa).
"""
import os
from PIL import Image

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
LOGO_PATH = os.path.join(REPO_ROOT, "frontend/public/brand/logo-mark-1024.png")
OUT_DIR = os.path.join(REPO_ROOT, "frontend/public/brand/splash")

BG_COLOR = (0x0A, 0x0C, 0x10, 255)  # #0A0C10

# (slug, css_width, css_height, dpr) — portrait. px = css * dpr.
# Keep in sync with frontend/src/lib/appleSplashScreens.ts.
DEVICES = [
    ("iphone-se", 320, 568, 2),  # SE 2nd/3rd gen, 6/6s/7/8
    ("iphone-xr-11", 414, 896, 2),  # XR, 11
    ("iphone-x-11pro-mini", 375, 812, 3),  # X/XS/11 Pro, 12 mini/13 mini
    ("iphone-xsmax-11promax", 414, 896, 3),  # XS Max, 11 Pro Max
    ("iphone-12-13-14", 390, 844, 3),  # 12/12 Pro/13/13 Pro/14
    ("iphone-promax-plus-1", 428, 926, 3),  # 12 Pro Max/13 Pro Max/14 Plus
    ("iphone-14pro-15-16", 393, 852, 3),  # 14 Pro/15/15 Pro/16
    ("iphone-promax-plus-2", 430, 932, 3),  # 14 Pro Max/15 Pro Max/15 Plus/16 Plus
    ("ipad-10-2", 768, 1024, 2),  # iPad 9.7"/10.2"
    ("ipad-air-10-9", 820, 1180, 2),  # iPad Air 10.9"
    ("ipad-pro-11", 834, 1194, 2),  # iPad Pro 11"
    ("ipad-pro-12-9", 1024, 1366, 2),  # iPad Pro 12.9"
]


def make_splash(logo: Image.Image, css_w: int, css_h: int, dpr: int) -> Image.Image:
    px_w, px_h = css_w * dpr, css_h * dpr
    canvas = Image.new("RGBA", (px_w, px_h), BG_COLOR)

    target = int(min(px_w, px_h) * 0.34)
    lw, lh = logo.size
    scale = target / max(lw, lh)
    resized = logo.resize((max(1, round(lw * scale)), max(1, round(lh * scale))), Image.LANCZOS)

    x = (px_w - resized.width) // 2
    y = (px_h - resized.height) // 2
    canvas.alpha_composite(resized, (x, y))
    return canvas.convert("RGB")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    logo = Image.open(LOGO_PATH).convert("RGBA")

    for slug, css_w, css_h, dpr in DEVICES:
        img = make_splash(logo, css_w, css_h, dpr)
        out_path = os.path.join(OUT_DIR, f"{slug}.png")
        img.save(out_path, "PNG", optimize=True)
        print(f"{slug}.png: {img.size[0]}x{img.size[1]} (css {css_w}x{css_h} @{dpr}x)")


if __name__ == "__main__":
    main()
