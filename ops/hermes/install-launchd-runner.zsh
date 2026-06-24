#!/bin/zsh
set -euo pipefail

LABEL="com.hughbrown.fjordpilot.deep-runner"
SCRIPT_DIR="${0:A:h}"
REPO_ROOT="${SCRIPT_DIR:h:h}"
RUNNER="$REPO_ROOT/ops/hermes/run-fjordpilot-deep-runner.zsh"
NODE_BIN="${FJORDPILOT_NODE_BIN:-$(command -v node)}"
CODEX_BIN="${FJORDPILOT_CODEX_BIN:-$(command -v codex)}"
INTERVAL_SECONDS="${FJORDPILOT_RUNNER_INTERVAL_SECONDS:-60}"
PLIST_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$HOME/Library/Logs/fjordpilot"
PLIST="$PLIST_DIR/$LABEL.plist"
DOMAIN="gui/$(id -u)"

if [[ -z "$NODE_BIN" ]]; then
  echo "Could not find node. Set FJORDPILOT_NODE_BIN and retry." >&2
  exit 1
fi

if [[ -z "$CODEX_BIN" ]]; then
  echo "Could not find codex. Set FJORDPILOT_CODEX_BIN and retry." >&2
  exit 1
fi

security find-generic-password -s fjordpilot -a FJORDPILOT_TOOL_TOKEN -w >/dev/null

mkdir -p "$PLIST_DIR" "$LOG_DIR"
chmod +x "$RUNNER"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>$RUNNER</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$REPO_ROOT</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>FJORDPILOT_REPO_ROOT</key>
    <string>$REPO_ROOT</string>
    <key>FJORDPILOT_NODE_BIN</key>
    <string>$NODE_BIN</string>
    <key>FJORDPILOT_CODEX_BIN</key>
    <string>$CODEX_BIN</string>
    <key>FJORDPILOT_RUNNER_NAME</key>
    <string>launchd-hermes-codex</string>
    <key>PATH</key>
    <string>/Users/hughbrown/.local/bin:/Users/hughbrown/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>$INTERVAL_SECONDS</integer>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/deep-runner.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/deep-runner.err.log</string>
</dict>
</plist>
PLIST

plutil -lint "$PLIST"

if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
  launchctl bootout "$DOMAIN/$LABEL" >/dev/null 2>&1 || true
fi

launchctl bootstrap "$DOMAIN" "$PLIST"
launchctl kickstart -k "$DOMAIN/$LABEL"

echo "Installed $LABEL"
echo "Plist: $PLIST"
echo "Logs: $LOG_DIR/deep-runner.log and $LOG_DIR/deep-runner.err.log"
