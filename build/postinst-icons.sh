#!/bin/bash
set -e

# ── Ikony ────────────────────────────────────────────────────────────────
ICON_SRC="/opt/CineBridge/resources/build/icons"
ICON_DST="/usr/share/icons/hicolor"

mkdir -p "${ICON_DST}/16x16/apps"
cp "${ICON_SRC}/16x16.png" "${ICON_DST}/16x16/apps/cinebridge.png"
mkdir -p "${ICON_DST}/24x24/apps"
cp "${ICON_SRC}/24x24.png" "${ICON_DST}/24x24/apps/cinebridge.png"
mkdir -p "${ICON_DST}/32x32/apps"
cp "${ICON_SRC}/32x32.png" "${ICON_DST}/32x32/apps/cinebridge.png"
mkdir -p "${ICON_DST}/48x48/apps"
cp "${ICON_SRC}/48x48.png" "${ICON_DST}/48x48/apps/cinebridge.png"
mkdir -p "${ICON_DST}/64x64/apps"
cp "${ICON_SRC}/64x64.png" "${ICON_DST}/64x64/apps/cinebridge.png"
mkdir -p "${ICON_DST}/128x128/apps"
cp "${ICON_SRC}/128x128.png" "${ICON_DST}/128x128/apps/cinebridge.png"
mkdir -p "${ICON_DST}/256x256/apps"
cp "${ICON_SRC}/256x256.png" "${ICON_DST}/256x256/apps/cinebridge.png"
mkdir -p "${ICON_DST}/512x512/apps"
cp "${ICON_SRC}/512x512.png" "${ICON_DST}/512x512/apps/cinebridge.png"

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f -t /usr/share/icons/hicolor || true
fi

# ── Symlink do /usr/bin ───────────────────────────────────────────────────
if type update-alternatives 2>/dev/null >&1; then
  if [ -L '/usr/bin/cinebridge' -a -e '/usr/bin/cinebridge' -a "`readlink '/usr/bin/cinebridge'`" != '/etc/alternatives/cinebridge' ]; then
    rm -f '/usr/bin/cinebridge'
  fi
  update-alternatives --install '/usr/bin/cinebridge' 'cinebridge' '/opt/CineBridge/cinebridge' 100 || ln -sf '/opt/CineBridge/cinebridge' '/usr/bin/cinebridge'
else
  ln -sf '/opt/CineBridge/cinebridge' '/usr/bin/cinebridge'
fi

# ── chrome-sandbox ────────────────────────────────────────────────────────
if ! { [[ -L /proc/self/ns/user ]] && unshare --user true; }; then
  chmod 4755 '/opt/CineBridge/chrome-sandbox' || true
else
  chmod 0755 '/opt/CineBridge/chrome-sandbox' || true
fi

if hash update-mime-database 2>/dev/null; then
  update-mime-database /usr/share/mime || true
fi

if hash update-desktop-database 2>/dev/null; then
  update-desktop-database /usr/share/applications || true
fi
