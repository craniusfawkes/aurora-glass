#!/bin/sh
# aurora-glass: removes aurora-glass and switches LuCI back to the default theme (bootstrap).
# Aurora itself is removed only if aurora-glass installed it. An Aurora installed separately is left alone.
# Run on the router: sh uninstall.sh    (asks for confirmation; use "sh uninstall.sh -y" to skip it)
set -e

P=/www/luci-static/aurora
H=/usr/share/ucode/luci/template/themes/aurora
C=/etc/aurora-custom
MARK="$C/upstream-installed"   # created by install.sh only when it installed Aurora itself

# 0. Confirmation
if [ "$1" != "-y" ]; then
  printf 'Remove aurora-glass and switch back to the default theme? (y/N) '
  read ans
  case "$ans" in y|Y|s|S) ;; *) echo "Cancelled."; exit 0 ;; esac
fi

# 1. Stops the traffic collector and removes its loop from rc.local
killall bw-loop.sh 2>/dev/null || true
sed -i '/aurora-bw-loop/d' /etc/rc.local

# 2. Removes aurora-glass files
rm -f /www/cgi-bin/aurora-bw /www/cgi-bin/aurora-oui
rm -f /tmp/aurora-bw.json /tmp/aurora-bw.* /tmp/aurora-names.tsv /tmp/aurora-ports.tsv
rm -f "$P/patches/admin.css" "$P/patches/admin.js" "$P/data/oui.tsv"
rm -f "$P/images/modelo.png" "$P/images/modelo.svg"
rm -rf "$C"

# 3. Aurora: removed only if aurora-glass installed it; otherwise the original files are kept
if [ -f "$MARK" ]; then
  rm -rf "$P" "$H"
  rm -f /etc/uci-defaults/30_luci-theme-aurora
  rm -f /etc/config/aurora
  uci -q delete luci.themes.Aurora || true
else
  # restores the login page the installer changed (only if the backup exists)
  [ -f "$P/login.css.orig" ] && mv "$P/login.css.orig" "$P/login.css"
fi
uci -q delete luci.themes.Aurora_Glass || true

# 4. Removes only the entries the installer added to the system backup list (sysupgrade)
sed -i '\|/etc/aurora-custom|d; \|/www/cgi-bin/aurora-|d; \|/aurora/patches/admin\.|d; \|/etc/config/aurora$|d' /etc/sysupgrade.conf

# 5. Switches LuCI to the default theme (bootstrap, if installed)
if [ -d /www/luci-static/bootstrap ]; then
  uci set luci.main.mediaurlbase=/luci-static/bootstrap
else
  uci -q delete luci.main.mediaurlbase || true
fi
uci commit luci

logger -t aurora-glass "aurora-glass removed"
echo "Done. Refresh the LuCI page with Ctrl+F5."
