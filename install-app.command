#!/bin/zsh

set -e

RUNTIME_ROOT="/Users/matthewsimiele/.cache/codex-runtimes/codex-primary-runtime/dependencies"
export PATH="$RUNTIME_ROOT/node/bin:$RUNTIME_ROOT/bin/fallback:/usr/bin:/bin:/usr/sbin:/sbin"

cd "/Users/matthewsimiele/Documents/Cheese App"
pnpm install

echo
echo "By the Whey is installed. Run ./start-app.command to launch it."
