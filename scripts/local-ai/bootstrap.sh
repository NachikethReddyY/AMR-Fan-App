#!/bin/sh
set -eu
umask 077
repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
laya_cache="$HOME/.cache/amr/laya"
mkdir -p "$laya_cache"
command -v uv >/dev/null
if [ ! -x "$laya_cache/venv/bin/python" ]; then
  uv venv --python 3.12 "$laya_cache/venv"
fi
uv pip sync --python "$laya_cache/venv/bin/python" --require-hashes "$repo_dir/scripts/local-ai/requirements.lock"
"$laya_cache/venv/bin/python" -I -c 'import laya; print("Installed Laya", laya.__version__)'
