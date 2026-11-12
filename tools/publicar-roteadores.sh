#!/bin/sh
# Publica o tema (admin.js e admin.css) nos dois roteadores de uma vez e atualiza o cache.
# Uso (Git Bash ou Linux): sh tools/publicar-roteadores.sh
# Chave SSH: defina CHAVE=/caminho/da/chave se for diferente da padrão abaixo.
# Compatível com OpenWrt (BusyBox): não usa scp/sftp, só ssh + cat.

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHAVE="${CHAVE:-$HOME/.ssh/claude_router}"
ROTEADORES="192.168.1.102 192.168.1.10"   # AX3000T e AX6000
PASTA=/www/luci-static/aurora/patches

for R in $ROTEADORES; do
  echo "== $R"
  # sintaxe JavaScript antes de enviar (evita publicar um arquivo quebrado)
  node --check "$ROOT/admin.js" >/dev/null 2>&1 || { echo "ERRO: admin.js com erro de sintaxe"; exit 1; }
  for f in admin.js admin.css; do
    # envia o arquivo pelo ssh (o roteador não tem sftp-server)
    ssh -i "$CHAVE" -o BatchMode=yes "root@$R" "cat > $PASTA/$f" < "$ROOT/$f"
  done
  # sobe a versão do cache para o navegador baixar os arquivos novos
  ssh -i "$CHAVE" -o BatchMode=yes "root@$R" 'v=$(( $(uci -q get aurora.theme.icon_cache_version) + 1 )); uci set aurora.theme.icon_cache_version=$v && uci commit aurora && echo "cache=$v"'
  # confere se a cópia no roteador ficou igual à local
  L=$(md5sum "$ROOT/admin.js" "$ROOT/admin.css" | awk '{print $1}' | tr '\n' ' ')
  Rm=$(ssh -i "$CHAVE" -o BatchMode=yes "root@$R" "cd $PASTA && md5sum admin.js admin.css | awk '{print \$1}' | tr '\n' ' '")
  if [ "$L" = "$Rm" ]; then echo "ok: arquivos iguais"; else echo "ERRO: arquivos diferentes no $R"; exit 1; fi
done
echo "Pronto: os dois roteadores estão atualizados."
