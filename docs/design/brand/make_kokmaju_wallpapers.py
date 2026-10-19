"""Wallpaper desktop/login Gerobak KoMa (2560x1440): doodle ayam jago, bulu
ekor, telur, bintang, dan roda gerobak kuning di atas merah-oranye (atau
sebaliknya). Tengah dibiarkan lega untuk jam desktop & form login.

Pakai:  python3 make_kokmaju_wallpapers.py <dir-output>
Render: node -e "require('sharp')('kokmaju-merah.svg').webp({quality:82}).toFile('bg-kokmaju.webp')"
"""
import math
import random
import sys
from pathlib import Path

from make_kokmaju_brand import CHICKEN_BEAK, CHICKEN_HEAD, CHICKEN_WATTLE, TAIL_FEATHERS

W, H = 2560, 1440

THEMES = {
    "merah": dict(bg="#fd4835", bg2="#d9301f", glow="#ff6347", ink=["#f9e04f", "#ffd23a", "#fff1a8"], eye="#fd4835"),
    "kuning": dict(bg="#f9e04f", bg2="#f2c92c", glow="#fff3a6", ink=["#fd4835", "#e0341f", "#ff8a5c"], eye="#f9e04f"),
}


def head(x, y, s, rot, fill, eye):
    return (
        f'<g transform="translate({x:.0f} {y:.0f}) rotate({rot:.0f}) scale({s:.2f}) translate(-120 -100)" fill="{fill}">'
        f'<path d="{CHICKEN_HEAD}"/><path d="{CHICKEN_BEAK}"/><path d="{CHICKEN_WATTLE}"/>'
        f'<circle cx="118" cy="62" r="9" fill="{eye}"/></g>'
    )


def tail(x, y, s, rot, fill):
    paths = "".join(f'<path d="{d}"/>' for d in TAIL_FEATHERS)
    return f'<g transform="translate({x:.0f} {y:.0f}) rotate({rot:.0f}) scale({s:.2f}) translate(-110 -100)" fill="{fill}">{paths}</g>'


def egg(x, y, s, rot, fill):
    return (
        f'<g transform="translate({x:.0f} {y:.0f}) rotate({rot:.0f}) scale({s:.2f})">'
        f'<path d="M0 -60 C34 -60 52 -6 52 22 C52 52 28 70 0 70 C-28 70 -52 52 -52 22 C-52 -6 -34 -60 0 -60 Z" '
        f'fill="none" stroke="{fill}" stroke-width="12"/></g>'
    )


def star(x, y, r, rot, fill):
    pts = []
    for i in range(10):
        rr = r if i % 2 == 0 else r * 0.45
        a = math.radians(rot + i * 36 - 90)
        pts.append(f"{x + rr * math.cos(a):.1f},{y + rr * math.sin(a):.1f}")
    return f'<polygon points="{" ".join(pts)}" fill="{fill}" stroke="{fill}" stroke-width="6" stroke-linejoin="round"/>'


def wheel(x, y, r, rot, fill):
    spokes = "".join(
        f'<line x1="0" y1="0" x2="{r * math.cos(math.radians(a)):.1f}" y2="{r * math.sin(math.radians(a)):.1f}"/>'
        for a in range(0, 360, 45)
    )
    return (
        f'<g transform="translate({x:.0f} {y:.0f}) rotate({rot:.0f})" stroke="{fill}" stroke-width="10" fill="none" stroke-linecap="round">'
        f'<circle r="{r}"/><circle r="{r * 0.18:.1f}" fill="{fill}"/>{spokes}</g>'
    )


def build(theme, seed=7):
    t = THEMES[theme]
    rnd = random.Random(seed)
    items = []
    placed = []
    attempts = 0
    while len(placed) < 70 and attempts < 6000:
        attempts += 1
        x, y = rnd.uniform(60, W - 60), rnd.uniform(60, H - 60)
        # Zona tengah (jam + form login) dibiarkan lega.
        if abs(x - W / 2) < 560 and abs(y - H / 2) < 470:
            continue
        r = rnd.uniform(70, 120)
        if any(math.hypot(x - px, y - py) < (r + pr) * 1.05 for px, py, pr in placed):
            continue
        placed.append((x, y, r))
        fill = rnd.choice(t["ink"])
        rot = rnd.uniform(-25, 25)
        kind = rnd.choices(["head", "tail", "egg", "star", "wheel"], [4, 3, 2, 3, 2])[0]
        op = rnd.uniform(0.55, 0.95)
        if kind == "head":
            g = head(x, y, r / 95, rot, fill, t["eye"])
        elif kind == "tail":
            g = tail(x, y, r / 100, rot, fill)
        elif kind == "egg":
            g = egg(x, y, r / 75, rot, fill)
        elif kind == "star":
            g = star(x, y, r * 0.55, rot, fill)
        else:
            g = wheel(x, y, r * 0.6, rot, fill)
        items.append(f'<g opacity="{op:.2f}">{g}</g>')
    dots = "".join(
        f'<circle cx="{rnd.uniform(0, W):.0f}" cy="{rnd.uniform(0, H):.0f}" r="{rnd.uniform(4, 10):.0f}" '
        f'fill="{rnd.choice(t["ink"])}" opacity="0.5"/>'
        for _ in range(160)
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">'
        f'<defs><radialGradient id="g" cx="50%" cy="50%" r="70%">'
        f'<stop offset="0" stop-color="{t["glow"]}"/><stop offset="0.55" stop-color="{t["bg"]}"/>'
        f'<stop offset="1" stop-color="{t["bg2"]}"/></radialGradient></defs>'
        f'<rect width="{W}" height="{H}" fill="url(#g)"/>{dots}{"".join(items)}</svg>\n'
    )


def main(out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    for theme in THEMES:
        (out / f"kokmaju-{theme}.svg").write_text(build(theme))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
