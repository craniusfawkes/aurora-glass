#!/bin/sh
# aurora-glass: uninstalls the glass theme and restores the original Aurora theme.
# Run on the router: sh uninstall.sh    (asks for confirmation; use "sh uninstall.sh -y" to skip it)
# Downloads the original Aurora before changing any file: without internet, nothing is changed.
set -e

UPSTREAM_URL="${UPSTREAM_URL:-https://codeload.github.com/eamonxg/luci-theme-aurora/tar.gz/refs/tags/v1.4.0}"
P=/www/luci-static/aurora
H=/usr/share/ucode/luci/template/themes/aurora/header.ut
C=/etc/aurora-custom
ASSETS_DIR=""   # project folder (optional): if set, removes the images the installer copied from it

# 0. Confirmation
if [ "$1" != "-y" ]; then
  printf 'Remove aurora-glass and go back to the original Aurora? (y/N) '
  read ans
  case "$ans" in y|Y|s|S) ;; *) echo "Cancelled."; exit 0 ;; esac
fi

# 1. Downloads the original Aurora (before any change)
T=/tmp/aurora-un-tmp
rm -rf "$T" && mkdir -p "$T"
if ! uclient-fetch -q -T 120 -O - "$UPSTREAM_URL" | tar -xz -C "$T"; then
  echo "ERROR: could not download the original Aurora. Nothing was changed."
  rm -rf "$T"
  exit 1
fi
UP=$(ls -d "$T"/*/ | head -n 1)
UP=${UP%/}

# 2. Stops the traffic collector and removes its loop from rc.local
killall bw-loop.sh 2>/dev/null || true
sed -i '/aurora-bw-loop/d' /etc/rc.local

# 3. Removes the aurora-glass files
rm -f "$P/patches/admin.css" "$P/patches/admin.js"
rm -f /www/cgi-bin/aurora-bw /www/cgi-bin/aurora-oui
rm -f /tmp/aurora-bw.json /tmp/aurora-bw.* /tmp/aurora-names.tsv /tmp/aurora-ports.tsv
rm -f "$P/data/oui.tsv"
rm -f "$P/images/modelo.png" "$P/images/modelo.svg"
# extra images: only those that do not exist in the original Aurora
if [ -n "$ASSETS_DIR" ] && [ -d "$ASSETS_DIR/assets" ]; then
  for f in "$ASSETS_DIR"/assets/*.svg "$ASSETS_DIR"/assets/*.png "$ASSETS_DIR"/assets/favicon.ico; do
    [ -f "$f" ] || continue
    n=$(basename "$f")
    [ -f "$UP/htdocs/luci-static/aurora/images/$n" ] || rm -f "$P/images/$n"
  done
fi
rm -rf "$C"

# 4. Restores the original Aurora files (login, images and header/login templates)
cp -r "$UP/htdocs/." /www/
cp -r "$UP/ucode/template/themes/aurora/." /usr/share/ucode/luci/template/themes/aurora/
rm -f "$P/login.css.orig"

# 5. Removes the entries the installer added to the system backup list (sysupgrade)
sed -i '/aurora/d' /etc/sysupgrade.conf

# 6. Removes the theme settings the installer set
for k in icon_cache_version struct_main_bg struct_login_bg struct_main_bg_scrim dark_main_bg_scrim struct_login_bg_scrim dark_login_bg_scrim; do
  uci -q delete "aurora.theme.$k" || true
done
uci commit aurora 2>/dev/null || true

# 7. Restores the theme name in the LuCI list and the default theme (bootstrap, if installed)
if uci -q get luci.themes.Aurora_Glass >/dev/null; then uci set luci.themes.Aurora='/luci-static/aurora'; uci -q delete luci.themes.Aurora_Glass; fi
if [ -d /www/luci-static/bootstrap ]; then
  uci set luci.main.mediaurlbase=/luci-static/bootstrap
else
  uci -q delete luci.main.mediaurlbase || true
fi
uci commit luci

rm -rf "$T"
logger -t aurora-glass "aurora-glass removido"
echo "Done. Refresh the LuCI page with Ctrl+F5."
