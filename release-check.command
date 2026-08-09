#!/bin/zsh

set -e

RUNTIME_ROOT="/Users/matthewsimiele/.cache/codex-runtimes/codex-primary-runtime/dependencies"
export PATH="$RUNTIME_ROOT/node/bin:$RUNTIME_ROOT/bin/fallback:/usr/bin:/bin:/usr/sbin:/sbin"
export CI=1
export EXPO_NO_TELEMETRY=1

cd "/Users/matthewsimiele/Documents/Cheese App"

pnpm install --frozen-lockfile
pnpm release:preflight

echo
echo "By the Whey release preflight passed."

