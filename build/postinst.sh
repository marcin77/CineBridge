#!/bin/bash
set -e

ICON_SRC="/opt/CineBridge/resources/build/icons"
ICON_DST="/usr/share/icons/hicolor"

for size in 16 24 32 48 64 128 256 512 1024; do
  if [ -f "${ICON_SRC}/${size}x${size}.png" ]; then
    mkdir -p "${ICON_DST}/${size}x${size}/apps"
    cp "${ICON_SRC}/${size}x${size}.png" "${ICON_DST}/${size}x${size}/apps/cinebridge.png"
  fi
done

# Odśwież cache ikon
if command -v gtk-update-icon-cache &>/dev/null; then
  gtk-update-icon-cache -f -t /usr/share/icons/hicolor || true
fi

if command -v update-desktop-database &>/dev/null; then
  update-desktop-database /usr/share/applications || true
fi
