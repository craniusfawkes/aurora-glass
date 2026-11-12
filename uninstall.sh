#!/bin/sh
# AuroraGlass: removes the AuroraGlass files and switches LuCI back to the default theme (bootstrap).
# Run on the router: sh uninstall.sh    (asks for confirmation; use "sh uninstall.sh -y" to skip it)
set -e

P=/www/luci-static/aurora
C=/etc/aurora-custom

# 0. Confirmation
if [ "$1" != "-y" ]; then
  printf 'Remove AuroraGlass and switch back to the default theme? (y/N) '
  read ans
  case "$ans" in y|Y|s|S) ;; *) echo "Cancelled."; exit 0 ;; esac
fi

# 1. Stops the traffic collector and removes its loop from rc.local
killall bw-loop.sh 2>/dev/null || true
sed -i '/aurora-bw-loop/d' /etc/rc.local

# 2. Removes the AuroraGlass files
rm -f /www/cgi-bin/aurora-bw /www/cgi-bin/aurora-oui
rm -f /tmp/aurora-bw.json /tmp/aurora-bw.* /tmp/aurora-names.tsv /tmp/aurora-ports.tsv
rm -f "$P/patches/admin.css" "$P/patches/admin.js" "$P/data/oui.tsv"
rm -f /www/luci-static/resources/view/aurora/devices.js /usr/share/luci/menu.d/luci-app-aurora.json /usr/share/rpcd/acl.d/luci-app-aurora.json
rmdir /www/luci-static/resources/view/aurora 2>/dev/null || true
rm -f /tmp/luci-indexcache /tmp/luci-indexcache.* 2>/dev/null || true
/etc/init.d/rpcd reload 2>/dev/null || true
rm -f "$P/images/modelo.png" "$P/images/modelo.svg"
rm -rf "$C"

# 3. Restores the login page changed by the installer (only if the backup exists)
[ -f "$P/login.css.orig" ] && mv "$P/login.css.orig" "$P/login.css"

# 4. Removes the AuroraGlass settings and the theme entry from the LuCI list
for k in icon_cache_version struct_main_bg struct_login_bg struct_main_bg_scrim dark_main_bg_scrim struct_login_bg_scrim dark_login_bg_scrim; do
  uci -q delete "aurora.theme.$k" || true
done
uci commit aurora 2>/dev/null || true
uci -q delete luci.themes.AuroraGlass || true

# 5. Removes the entries the installer added to the system backup list (sysupgrade)
sed -i '\|/etc/aurora-custom|d; \|/www/cgi-bin/aurora-|d; \|/aurora/patches/admin\.|d; \|/resources/view/aurora/devices\.js|d; \|luci-app-aurora\.json|d' /etc/sysupgrade.conf

# 6. Switches LuCI to the default theme (bootstrap, if installed)
if [ -d /www/luci-static/bootstrap ]; then
  uci set luci.main.mediaurlbase=/luci-static/bootstrap
else
  uci -q delete luci.main.mediaurlbase || true
fi
uci commit luci

logger -t aurora-glass "AuroraGlass removed"
echo "Done. Refresh the LuCI page with Ctrl+F5."
