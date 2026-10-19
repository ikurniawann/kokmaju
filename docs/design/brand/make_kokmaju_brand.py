"""Aset brand Gerobak KoMa (IG @kokmaju) — digambar ulang sebagai vektor dari
foto profil Instagram (merah-oranye #fd4835, lettering kuning #f9e04f, siluet
ayam jago mengapit tulisan "KoMA").

Pakai:  python3 make_kokmaju_brand.py <dir-output>
Hasil:  kokmaju-mark.svg (logo di atas latar merah, persegi)
        kokmaju-wordmark.svg (logo transparan untuk latar terang)
        kokmaju-wordmark-dark.svg (logo transparan untuk latar gelap/merah)
        kokmaju-maskable.svg (ikon PWA maskable)
Render PNG lewat headless Chromium (font Google: Lilita One + Fredoka), lihat
render_brand.sh di folder ini.
"""
import sys
from pathlib import Path

RED = "#fd4835"
RED_DARK = "#c42a1b"
YELLOW = "#f9e04f"
INK = "#7a1a10"

FONTS = (
    "@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@700"
    "&family=Lilita+One&display=block');"
)

# Kepala ayam menghadap kiri (jengger 3 lekuk, paruh, pial) — koordinat lokal 0..200
CHICKEN_HEAD = (
    "M150 190 C120 175 96 150 92 122 C88 100 92 86 100 76 "
    "C92 72 86 64 88 56 C78 54 72 46 76 36 C68 30 70 18 80 14 "
    "C88 8 98 12 102 20 C106 10 118 6 126 14 C134 8 146 12 146 24 "
    "C156 26 160 38 152 46 C160 56 162 70 158 84 C176 100 188 128 186 160 Z"
)
CHICKEN_BEAK = "M96 84 L58 96 L94 104 Z"
CHICKEN_WATTLE = "M100 104 C92 118 96 134 108 134 C116 126 112 112 104 104 Z"

# Ekor ayam jago (bulu melengkung mengipas ke kanan-atas)
TAIL_FEATHERS = [
    "M20 190 C40 120 90 60 170 30 C140 70 110 120 70 190 Z",
    "M30 190 C70 140 130 100 200 90 C160 120 120 150 90 190 Z",
    "M20 180 C40 100 70 40 120 0 C110 50 90 110 60 185 Z",
    "M40 190 C90 160 150 150 205 160 C160 170 120 185 100 195 Z",
]


def chicken_head(x, y, s, fill):
    return (
        f'<g transform="translate({x} {y}) scale({s})" fill="{fill}">'
        f'<path d="{CHICKEN_HEAD}"/><path d="{CHICKEN_BEAK}"/><path d="{CHICKEN_WATTLE}"/>'
        f'<circle cx="118" cy="62" r="9" fill="{RED}"/></g>'
    )


def tail(x, y, s, fill):
    paths = "".join(f'<path d="{d}"/>' for d in TAIL_FEATHERS)
    return f'<g transform="translate({x} {y}) scale({s})" fill="{fill}">{paths}</g>'


def logo_group(cx, cy, scale, *, gerobak_fill, outline_extra=None):
    """Logo utuh berpusat di (cx, cy); lebar dasar ~1000 unit sebelum di-scale."""
    koma = (
        '<text x="0" y="110" text-anchor="middle" '
        'font-family="Lilita One" font-size="300" letter-spacing="6">'
        '<tspan>K</tspan><tspan font-size="210" dy="-4">o</tspan><tspan dy="4">MA</tspan></text>'
    )
    parts = []
    # Siluet ayam di belakang blok kuning
    parts.append(chicken_head(-650, -215, 1.5, YELLOW))
    parts.append(tail(330, -150, 1.25, YELLOW))
    if outline_extra:
        parts.append(
            f'<g fill="{outline_extra}" stroke="{outline_extra}" stroke-width="86" '
            f'stroke-linejoin="round">{koma}</g>'
        )
        parts.insert(0, chicken_head(-657, -222, 1.57, outline_extra))
        parts.insert(1, tail(324, -156, 1.29, outline_extra))
    parts.append(
        f'<g fill="{YELLOW}" stroke="{YELLOW}" stroke-width="64" stroke-linejoin="round">{koma}</g>'
    )
    parts.append(f'<g fill="{RED}">{koma}</g>')
    parts.append(
        f'<text x="0" y="-150" text-anchor="middle" font-family="Fredoka" font-weight="700" '
        f'font-size="92" letter-spacing="10" fill="{gerobak_fill}">GEROBAK</text>'
    )
    return f'<g transform="translate({cx} {cy}) scale({scale})">{"".join(parts)}</g>'


def svg(w, h, body, bg=None):
    rect = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
        f"<style>{FONTS}</style>{rect}{body}</svg>\n"
    )


def main(out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "kokmaju-mark.svg").write_text(
        svg(1024, 1024, logo_group(530, 560, 0.82, gerobak_fill=YELLOW), bg=RED)
    )
    # Ikon PWA maskable: logo di dalam zona aman lingkaran 80%.
    (out / "kokmaju-maskable.svg").write_text(
        svg(1024, 1024, logo_group(530, 545, 0.6, gerobak_fill=YELLOW), bg=RED)
    )
    (out / "kokmaju-wordmark.svg").write_text(
        svg(1500, 470, logo_group(760, 268, 1.0, gerobak_fill=RED_DARK, outline_extra=RED_DARK))
    )
    (out / "kokmaju-wordmark-dark.svg").write_text(
        svg(1500, 470, logo_group(760, 268, 1.0, gerobak_fill=YELLOW))
    )


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
