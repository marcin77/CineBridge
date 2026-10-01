#!/bin/bash
set -e

ICON_DST="/usr/share/icons/hicolor"

for size in 16 24 32 48 64 128 256 512 1024; do
  rm -f "${ICON_DST}/${size}x${size}/apps/cinebridge.png"
done

if command -v gtk-update-icon-cache &>/dev/null; then
  gtk-update-icon-cache -f -t /usr/share/icons/hicolor || true
fi
