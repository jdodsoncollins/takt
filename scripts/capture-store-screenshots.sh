#!/usr/bin/env bash
# Capture App Store listing screens from a demo-mode Release simulator build.
# Requires EXPO_PUBLIC_TAKT_DEMO_MODE=1 to have been baked into the binary.
set -euo pipefail

export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:/opt/homebrew/bin${PATH:+:$PATH}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env"
  set +a
fi
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
IPHONE="${IPHONE_UDID:-}"
IPAD="${IPAD_UDID:-}"
BUNDLE="${EXPO_PUBLIC_BUNDLE_ID:-com.example.takt}"
SCHEME="${EXPO_PUBLIC_SCHEME:-takt}"
OUT="$ROOT/store/screenshots"
SIMCTL=(/usr/bin/xcrun simctl)

if [ -z "$IPHONE" ] || [ -z "$IPAD" ]; then
  echo "Set IPHONE_UDID and IPAD_UDID to simulator identifiers." >&2
  exit 1
fi

status_bar() {
  local udid="$1"
  "${SIMCTL[@]}" status_bar "$udid" override \
    --time "9:41" \
    --dataNetwork wifi \
    --wifiMode active \
    --wifiBars 3 \
    --cellularMode active \
    --cellularBars 4 \
    --operatorName '' \
    --batteryState charged \
    --batteryLevel 100 >/dev/null
}

quiet_other_apps() {
  local udid="$1"
  "${SIMCTL[@]}" terminate "$udid" com.apple.Music >/dev/null 2>&1 || true
}

launch() {
  local udid="$1"
  "${SIMCTL[@]}" terminate "$udid" "$BUNDLE" >/dev/null 2>&1 || true
  "${SIMCTL[@]}" launch "$udid" "$BUNDLE" >/dev/null
  /bin/sleep 3
}

open_route() {
  local udid="$1"
  local path="$2"
  "${SIMCTL[@]}" openurl "$udid" "${SCHEME}://${path}" >/dev/null
  /bin/sleep 1.4
}

flatten() {
  local src="$1"
  python3 - "$src" <<'PY'
import sys
from pathlib import Path
from PIL import Image
p = Path(sys.argv[1])
im = Image.open(p).convert("RGB")
im.save(p, format="PNG", optimize=True)
PY
}

capture_set() {
  local udid="$1"
  local dest="$2"
  mkdir -p "$dest"
  quiet_other_apps "$udid"
  status_bar "$udid"
  launch "$udid"

  open_route "$udid" "/home"
  /bin/sleep 2.4
  "${SIMCTL[@]}" io "$udid" screenshot "$dest/01-home.png"

  open_route "$udid" "/deployments"
  /bin/sleep 1.2
  "${SIMCTL[@]}" io "$udid" screenshot "$dest/02-deploys.png"

  open_route "$udid" "/activity"
  /bin/sleep 1.0
  "${SIMCTL[@]}" io "$udid" screenshot "$dest/03-activity.png"

  open_route "$udid" "/search"
  /bin/sleep 1.0
  "${SIMCTL[@]}" io "$udid" screenshot "$dest/04-search.png"

  open_route "$udid" "/home"
  /bin/sleep 0.8
  open_route "$udid" "/sites"
  /bin/sleep 1.4
  "${SIMCTL[@]}" io "$udid" screenshot "$dest/06-sites.png"

  open_route "$udid" "/home"
  /bin/sleep 0.6
  open_route "$udid" "/settings"
  /bin/sleep 1.2
  "${SIMCTL[@]}" io "$udid" screenshot "$dest/05-settings.png"

  for f in 01-home 02-deploys 03-activity 04-search 05-settings 06-sites; do
    flatten "$dest/$f.png"
  done
}

copy_upload() {
  local src_dir="$1"
  local dest_dir="$2"
  shift 2
  mkdir -p "$dest_dir"
  rm -f "$dest_dir"/*.png
  local i=1
  for spec in "$@"; do
    local num="${spec%%:*}"
    local name="${spec#*:}"
    cp "$src_dir/${name}.png" "$dest_dir/${i}-${name}.png"
    i=$((i + 1))
  done
}

"${SIMCTL[@]}" boot "$IPHONE" >/dev/null 2>&1 || true
"${SIMCTL[@]}" boot "$IPAD" >/dev/null 2>&1 || true

APP="$(find ~/Library/Developer/Xcode/DerivedData -path '*Taktung*/Build/Products/Release-iphonesimulator/Taktung.app' -print -quit)"
if [ -z "$APP" ] || [ ! -d "$APP" ]; then
  echo "Release Taktung.app not found" >&2
  exit 1
fi
"${SIMCTL[@]}" install "$IPHONE" "$APP"
"${SIMCTL[@]}" install "$IPAD" "$APP"

capture_set "$IPHONE" "$OUT/iphone-6.9-1320x2868"
capture_set "$IPAD" "$OUT/ipad-13-2064x2752"

copy_upload "$OUT/iphone-6.9-1320x2868" "$OUT/upload-iphone" \
  1:01-home 2:02-deploys 3:03-activity 4:04-search 5:05-settings 6:06-sites
copy_upload "$OUT/ipad-13-2064x2752" "$OUT/upload-ipad" \
  1:01-home 2:02-deploys 3:03-activity 4:04-search 5:05-settings 6:06-sites

echo "Captured demo screens into $OUT"
sips -g pixelWidth -g pixelHeight -g hasAlpha \
  "$OUT/iphone-6.9-1320x2868/01-home.png" \
  "$OUT/ipad-13-2064x2752/01-home.png"
