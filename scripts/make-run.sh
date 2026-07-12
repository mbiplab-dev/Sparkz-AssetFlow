#!/usr/bin/env bash
set -euo pipefail

export PATH="/c/PROGRA~2/GnuWin32/bin:/c/Program Files/nodejs:/c/Users/Rishabh/.local/bin:/c/Users/Rishabh/AppData/Roaming/Python/Python312/Scripts:/usr/bin:/bin:${PATH:-}"
export POSTGRES_PORT="${POSTGRES_PORT:-5433}"
export MAKE="/c/PROGRA~2/GnuWin32/bin/make.exe"

cd "$(dirname "$0")/.."

echo "Using make: $(command -v make || true)"
make --version | head -n 1
echo "Starting make run..."
exec make run
