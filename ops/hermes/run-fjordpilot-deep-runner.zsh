#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
REPO_ROOT="${FJORDPILOT_REPO_ROOT:-${SCRIPT_DIR:h:h}}"
NODE_BIN="${FJORDPILOT_NODE_BIN:-/Users/hughbrown/.local/bin/node}"
CODEX_BIN="${FJORDPILOT_CODEX_BIN:-/Users/hughbrown/.npm-global/bin/codex}"
LOCK_DIR="${TMPDIR:-/tmp}/fjordpilot-deep-runner.lock"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  exit 0
fi
trap 'rmdir "$LOCK_DIR"' EXIT

TOKEN="$(security find-generic-password -s fjordpilot -a FJORDPILOT_TOOL_TOKEN -w)"

export FJORDPILOT_TOOL_TOKEN="$TOKEN"
export FJORDPILOT_REPO_ROOT="$REPO_ROOT"
export FJORDPILOT_CODEX_BIN="$CODEX_BIN"
export FJORDPILOT_RUNNER_NAME="${FJORDPILOT_RUNNER_NAME:-launchd-hermes-codex}"

cd "$REPO_ROOT"
"$NODE_BIN" ops/hermes/fjordpilot-deep-runner.mjs --once
