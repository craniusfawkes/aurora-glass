#!/bin/sh
# aurora-glass: uninstalls aurora-glass and the Aurora theme, and switches LuCI back to the default theme (bootstrap).
# Run on the router: sh uninstall.sh    (asks for confirmation; use "sh uninstall.sh -y" to skip it)
set -e

P=/www/luci-static/aurora
H=/usr/share/ucode/luci/template/themes/aurora
C=/etc/aurora-custom

# 0. Confirmation
if [ "$1" != "-y" ]; then
  printf 'Remove aurora-glass and Aurora, and switch back to the default theme? (y/N) '
  read ans
  case "$ans" in y|Y|s|S) ;; *) echo "Cancelled."; exit 0 ;; esac
fi

# 1. Stops the traffic collector and removes its loop from rc.local
killall bw-loop.sh 2>/dev/null || true
sed -i '/aurora-bw-loop/d' /etc/rc.local

# 2. Removes aurora-glass files
rm -f /www/cgi-bin/aurora-bw /www/cgi-bin/aurora-oui
rm -f /tmp/aurora-bw.json /tmp/aurora-bw.* /tmp/aurora-names.tsv /tmp/aurora-ports.tsv
rm -rf "$C"

# 3. Removes the Aurora theme (glass and original files)
rm -rf "$P" "$H"
rm -f /etc/uci-defaults/30_luci-theme-aurora

# 4. Removes the entries the installer added to the system backup list (sysupgrade)
sed -i '/aurora/d' /etc/sysupgrade.conf

# 5. Removes the theme settings and the theme from the LuCI list
rm -f /etc/config/aurora
uci -q delete luci.themes.Aurora || true
uci -q delete luci.themes.Aurora_Glass || true

# 6. Switches LuCI to the default theme (bootstrap, if installed)
if [ -d /www/luci-static/bootstrap ]; then
  uci set luci.main.mediaurlbase=/luci-static/bootstrap
else
  uci -q delete luci.main.mediaurlbase || true
fi
uci commit luci

logger -t aurora-glass "aurora-glass and Aurora removed"
echo "Done. Refresh the LuCI page with Ctrl+F5."
