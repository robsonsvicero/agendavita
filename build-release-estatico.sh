#!/usr/bin/env bash
set -euo pipefail
npm run build
echo "Build concluido em dist/. Envie o conteudo dessa pasta para public_html."
