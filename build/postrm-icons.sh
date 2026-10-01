#!/bin/bash
set -e

ICON_DST="/usr/share/icons/hicolor"

rm -f "${ICON_DST}/16x16/apps/cinebridge.png"
rm -f "${ICON_DST}/24x24/apps/cinebridge.png"
rm -f "${ICON_DST}/32x32/apps/cinebridge.png"
rm -f "${ICON_DST}/48x48/apps/cinebridge.png"
rm -f "${ICON_DST}/64x64/apps/cinebridge.png"
rm -f "${ICON_DST}/128x128/apps/cinebridge.png"
rm -f "${ICON_DST}/256x256/apps/cinebridge.png"
rm -f "${ICON_DST}/512x512/apps/cinebridge.png"

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f -t /usr/share/icons/hicolor || true
fi
