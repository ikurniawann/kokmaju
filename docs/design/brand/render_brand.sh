#!/usr/bin/env bash
# Render SVG brand KoMa → PNG transparan via headless Chromium (butuh font Google online).
# Pakai: docs/design/brand/render_brand.sh <dir-svg> <dir-png>
set -euo pipefail
SRC=$1; OUT=$2; mkdir -p "$OUT"
CHROME=${CHROME:-$(ls ~/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell | tail -1)}
for f in "$SRC"/*.svg; do
  name=$(basename "$f" .svg)
  dims=$(grep -oE 'width="[0-9]+" height="[0-9]+"' "$f" | head -1 | tr -dc '0-9 ')
  w=${dims% *}; h=${dims#* }
  html="$OUT/.$name.html"
  printf '<!doctype html><html><head><style>html,body{margin:0;background:transparent}</style></head><body>%s</body></html>' "$(cat "$f")" > "$html"
  "$CHROME" --headless --no-sandbox --disable-gpu --hide-scrollbars --default-background-color=00000000 \
    --virtual-time-budget=8000 --window-size="$w,$h" --screenshot="$OUT/$name.png" "file://$(realpath "$html")" >/dev/null 2>&1
  rm -f "$html"
  echo "$OUT/$name.png"
done
