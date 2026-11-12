#!/bin/sh
# Publishes the theme (admin.js and admin.css) to both routers at once and bumps the cache.
# Usage (Git Bash or Linux): sh tools/publicar-roteadores.sh
# SSH key: set CHAVE=/path/to/key if it differs from the default below.
# Compatible with OpenWrt (BusyBox): no scp/sftp, only ssh + cat.

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHAVE="${CHAVE:-$HOME/.ssh/claude_router}"
ROTEADORES="192.168.1.102 192.168.1.10"   # AX3000T and AX6000
PASTA=/www/luci-static/aurora/patches

for R in $ROTEADORES; do
  echo "== $R"
  # sintaxe JavaScript antes de enviar (evita publicar um arquivo quebrado)
  node --check "$ROOT/admin.js" >/dev/null 2>&1 || { echo "ERRO: admin.js com erro de sintaxe"; exit 1; }
  for f in admin.js admin.css; do
    # send the file over ssh (the router has no sftp-server)
    ssh -i "$CHAVE" -o BatchMode=yes "root@$R" "cat > $PASTA/$f" < "$ROOT/$f"
  done
  # bump the cache version so the browser downloads the new files
  ssh -i "$CHAVE" -o BatchMode=yes "root@$R" 'v=$(( $(uci -q get aurora.theme.icon_cache_version) + 1 )); uci set aurora.theme.icon_cache_version=$v && uci commit aurora && echo "cache=$v"'
  # check that the router copy matches the local one
  L=$(md5sum "$ROOT/admin.js" "$ROOT/admin.css" | awk '{print $1}' | tr '\n' ' ')
  Rm=$(ssh -i "$CHAVE" -o BatchMode=yes "root@$R" "cd $PASTA && md5sum admin.js admin.css | awk '{print \$1}' | tr '\n' ' '")
  if [ "$L" = "$Rm" ]; then echo "ok: arquivos iguais"; else echo "ERRO: arquivos diferentes no $R"; exit 1; fi
done
echo "Pronto: os dois roteadores estão atualizados."
