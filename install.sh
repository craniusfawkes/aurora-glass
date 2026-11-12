#!/bin/sh
# aurora-glass: installs the original Aurora theme and applies the glass patches and extra features.
# Run on the router (OpenWrt 25.12+). Usage: sh install.sh [project_folder]
# Safe to run again.
set -e

# 0a. Version warning: the theme was tested on OpenWrt 25.12 and on the SNAPSHOT (LuCI Master) of the Xiaomi AX6000
REL=$(. /etc/openwrt_release 2>/dev/null; echo "$DISTRIB_RELEASE")
case "$REL" in
  25.12*) ;;
  *) echo "WARNING: OpenWrt '$REL' (tested on 25.12). If the layout looks wrong, let us know." ;;
esac

UPSTREAM_URL="${UPSTREAM_URL:-https://codeload.github.com/eamonxg/luci-theme-aurora/tar.gz/refs/tags/v1.4.0}"
OUI_URL="${OUI_URL:-https://standards-oui.ieee.org/oui/oui.txt}"
D="${1:-$(dirname "$0")}"          # folder with admin.css, admin.js, login-glass.css, cgi/ and assets/
P=/www/luci-static/aurora
H=/usr/share/ucode/luci/template/themes/aurora/header.ut
S=/usr/share/ucode/luci/template/themes/aurora/sysauth.ut
C=/etc/aurora-custom

# 0. Tools used by the traffic, vendor and model features
for t in iw hexdump jsonfilter awk; do
  command -v "$t" >/dev/null 2>&1 || echo "WARNING: '$t' not found; some features will not work."
done

# 1. Original theme (only if not installed yet).
# Uses the GitHub source code (works on any OpenWrt 25.12+, without depending on an apk package).
if [ ! -f "$H" ]; then
  echo "Installing the original Aurora theme..."
  # BusyBox (OpenWrt) has no --strip-components: extract to a folder and use the folder inside
  T=/tmp/aurora-up-tmp
  rm -rf "$T" && mkdir -p "$T"
  uclient-fetch -q -T 120 -O - "$UPSTREAM_URL" | tar -xz -C "$T"
  UP=$(ls -d "$T"/*/ | head -n 1)
  UP=${UP%/}
  cp -r "$UP/htdocs/." /www/
  mkdir -p /usr/share/ucode/luci/template/themes/aurora
  cp -r "$UP/ucode/template/themes/aurora/." /usr/share/ucode/luci/template/themes/aurora/
  cp -r "$UP/root/." /
  sh /etc/uci-defaults/30_luci-theme-aurora 2>/dev/null || true
  rm -rf "$T"
  # marks that aurora-glass installed Aurora (the uninstaller only removes Aurora when this mark exists)
  mkdir -p "$C" && touch "$C/upstream-installed"
fi

# 2. Glass patches and images
mkdir -p "$P/patches" "$P/images" "$P/data" "$C"
cp "$D/admin.css" "$D/admin.js" "$P/patches/"
cp "$D"/assets/*.svg "$D"/assets/*.png "$D"/assets/favicon.ico "$P/images/"

# 3. Glass login screen (appended to the original login.css, only once)
if [ ! -f "$C/login-applied" ]; then
  [ -f "$P/login.css.orig" ] || cp "$P/login.css" "$P/login.css.orig"
  cat "$D/login-glass.css" >> "$P/login.css"
  touch "$C/login-applied"
fi

# 4. Cache: patches and icons use icon_cache_version (stops the browser from showing an old version)
sed -i 's|patches/{{ patch }}\.css"|patches/{{ patch }}.css?v={{ icon_cache_version }}"|; s|patches/{{ patch }}\.js"|patches/{{ patch }}.js?v={{ icon_cache_version }}"|' "$H"
sed -i 's|patches/{{ patch }}\.css?v=1\.4\.0|patches/{{ patch }}.css?v={{ icon_cache_version }}|' "$H"
sed -i 's|patches/{{ patch }}\.js?v=1\.4\.0|patches/{{ patch }}.js?v={{ icon_cache_version }}|' "$H"
sed -i 's|" sizes="any" type="image/svg+xml">|" sizes="any">|' "$H"
sed -i 's|{{ favicon_ico }}" sizes="32x32"|{{ favicon_ico }}?v={{ icon_cache_version }}" sizes="32x32"|' "$H"
# 4-name: the theme name shows as AuroraGlass (the credit to the original Aurora stays on the login screen)
sed -i 's|content="LuCI Aurora"|content="LuCI AuroraGlass"|; s|?? '"'"'Aurora'"'"')|?? '"'"'AuroraGlass'"'"')|' "$H"

# 4a. Login: shows the model name (e.g. "Xiaomi Mi Router AX3000T") instead of the hostname
sed -i "s|striptags(boardinfo?\.hostname ?? '?')|striptags(boardinfo?.model ?? boardinfo?.hostname ?? '?')|" "$S"

# 4b. Model image: model photo (modelos/<id>.png or the AX3000T); otherwise the generic one
MODEL_ID=$(jsonfilter -i /etc/board.json -e '@.model.id' 2>/dev/null | tr ',' '_')
rm -f "$P/images/modelo.png" "$P/images/modelo.svg"
if [ -n "$MODEL_ID" ] && [ -f "$D/modelos/$MODEL_ID.png" ]; then
  cp "$D/modelos/$MODEL_ID.png" "$P/images/modelo.png"
elif echo "$MODEL_ID" | grep -qi 'ax3000t'; then
  cp "$D/assets/ax3000t.png" "$P/images/modelo.png"
else
  cp "$D/assets/roteador-generico.svg" "$P/images/modelo.svg"
fi

# 4b-2. Logo (home/sidebar) and favicon per model: use the model photo and favicon when they exist
if [ -n "$MODEL_ID" ] && [ -f "$D/modelos/$MODEL_ID.png" ]; then
  cp "$D/modelos/$MODEL_ID.png" "$P/images/logo-$MODEL_ID.png"
  uci set aurora.theme.logo_svg="logo-$MODEL_ID.png"
  if [ -f "$D/modelos/$MODEL_ID-favicon.png" ]; then
    cp "$D/modelos/$MODEL_ID-favicon.png" "$P/images/favicon-$MODEL_ID.png"
    uci set aurora.theme.favicon_png="favicon-$MODEL_ID.png"
  fi
  # browsers prefer favicon.ico: also replace it with this model's icon (if any)
  [ -f "$D/modelos/$MODEL_ID-favicon.ico" ] && cp "$D/modelos/$MODEL_ID-favicon.ico" "$P/images/favicon.ico"
fi

# 4c. IEEE vendor list converted to MAC -> vendor
if [ ! -s "$P/data/oui.tsv" ]; then
  echo "Downloading the IEEE vendor list..."
  if uclient-fetch -q -T 120 -O /tmp/oui.txt "$OUI_URL"; then
    awk -F'\t' '/\(hex\)/ {
      m = $1; sub(/[ \t]*\(hex\).*/, "", m); gsub(/-/, "", m)
      v = $NF; gsub(/^[ \t]+|[ \t]+$/, "", v)
      if (length(m) == 6 && v != "") print m "\t" v
    }' /tmp/oui.txt > "$P/data/oui.tsv"
  else
    echo "WARNING: could not download the vendor list; the vendor will show as '?'."
  fi
  rm -f /tmp/oui.txt
fi

# 4d. CGIs: traffic per device (fast read) and vendor
mkdir -p /www/cgi-bin
cp "$D/cgi/aurora-bw" /www/cgi-bin/aurora-bw && chmod 755 /www/cgi-bin/aurora-bw
cp "$D/cgi/aurora-oui" /www/cgi-bin/aurora-oui && chmod 755 /www/cgi-bin/aurora-oui

# 4e. Traffic collector and background loop (updates /tmp/aurora-bw.json every second)
cp "$D/cgi/aurora-bw-collect" "$C/bw-collect.sh" && chmod 755 "$C/bw-collect.sh"
cp "$D/cgi/aurora-bw-loop" "$C/bw-loop.sh" && chmod 755 "$C/bw-loop.sh"
# keeps a single line in rc.local and makes the loop start at boot (rc.local ends with exit 0)
sed -i '/aurora-bw-loop/d; /^exit 0$/d' /etc/rc.local
echo "$C/bw-loop.sh >/dev/null 2>&1 & # aurora-bw-loop" >> /etc/rc.local
echo "exit 0" >> /etc/rc.local
"$C/bw-loop.sh" >/dev/null 2>&1 &

# 4f. Devices page: LuCI view, menu entry (Status > Devices) and access rule
# LuCI loads views from resources/, the menu from menu.d/ and the permissions from acl.d/
mkdir -p /www/luci-static/resources/view/aurora /usr/share/luci/menu.d /usr/share/rpcd/acl.d
cp "$D/luci/view/aurora/devices.js" /www/luci-static/resources/view/aurora/devices.js
cp "$D/luci/menu.d/luci-app-aurora.json" /usr/share/luci/menu.d/luci-app-aurora.json
cp "$D/luci/acl.d/luci-app-aurora.json" /usr/share/rpcd/acl.d/luci-app-aurora.json
# clears LuCI's menu cache and reloads rpcd so the new entry and rule apply without a reboot
rm -f /tmp/luci-indexcache /tmp/luci-indexcache.* 2>/dev/null || true
/etc/init.d/rpcd reload 2>/dev/null || true

# 5. Theme configuration
# creates the file and the theme section if missing (on a clean router, /etc/config/aurora does not exist)
[ -f /etc/config/aurora ] || touch /etc/config/aurora
uci -q get aurora.theme >/dev/null || uci set aurora.theme=theme
uci -q get aurora.theme.icon_cache_version >/dev/null || uci set aurora.theme.icon_cache_version=1
# each install bumps the cache version: the browser downloads the new CSS and JS (no Ctrl+F5 needed)
v=$(( $(uci -q get aurora.theme.icon_cache_version || echo 0) + 1 )); uci set aurora.theme.icon_cache_version=$v
# background and scale: without them LuCI does not mark the page (data-bg) and the glass styles do not apply
BG="url(/luci-static/aurora/images/bg-tech-light.svg?v=2)"
uci -q get aurora.theme.struct_main_bg >/dev/null || uci set aurora.theme.struct_main_bg="$BG"
uci -q get aurora.theme.struct_login_bg >/dev/null || uci set aurora.theme.struct_login_bg="$BG"
uci -q get aurora.theme.struct_main_bg_scrim >/dev/null || uci set aurora.theme.struct_main_bg_scrim='12%'
uci -q get aurora.theme.dark_main_bg_scrim >/dev/null || uci set aurora.theme.dark_main_bg_scrim='22%'
uci -q get aurora.theme.struct_login_bg_scrim >/dev/null || uci set aurora.theme.struct_login_bg_scrim='12%'
uci -q get aurora.theme.dark_login_bg_scrim >/dev/null || uci set aurora.theme.dark_login_bg_scrim='22%'
uci commit aurora
# theme name in the LuCI theme list: AuroraGlass (UCI does not accept hyphens; the path stays /luci-static/aurora)
uci -q delete luci.themes.Aurora || true
uci -q get luci.themes.AuroraGlass >/dev/null || uci set luci.themes.AuroraGlass='/luci-static/aurora'
uci set luci.main.mediaurlbase=/luci-static/aurora
uci commit luci

# 6. Survives system upgrades (sysupgrade)
for f in "$C" /etc/config/aurora "$P/patches/admin.css" "$P/patches/admin.js" "$H" "$S" \
         /www/cgi-bin/aurora-bw /www/cgi-bin/aurora-oui "$P/data/oui.tsv" \
         /www/luci-static/resources/view/aurora/devices.js \
         /usr/share/luci/menu.d/luci-app-aurora.json /usr/share/rpcd/acl.d/luci-app-aurora.json; do
  grep -qxF "$f" /etc/sysupgrade.conf || echo "$f" >> /etc/sysupgrade.conf
done
for f in "$P"/images/*.svg "$P"/images/*.png "$P"/images/favicon.ico; do
  grep -qxF "$f" /etc/sysupgrade.conf || echo "$f" >> /etc/sysupgrade.conf
done

logger -t aurora-glass "aurora-glass installed"
echo "Done (cache $v). Refresh the LuCI page with Ctrl+F5 the first time."
