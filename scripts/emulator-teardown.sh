#!/usr/bin/env bash
# Tears down the Factor Android emulator environment: kills whatever is
# serving on the dev-server port, then cleanly shuts down the emulator.
# Safe to run even if setup only partially succeeded, or if nothing is
# running — every step is a no-op when there's nothing to tear down.
#
# Used by the emulator-verifier skill's teardown step; also intended for a
# future automated test framework to reuse as its own teardown phase.
set -uo pipefail

PORT=8081

log() { echo "[emulator-teardown] $*" >&2; }

# Resolve the PID actually bound to the port and kill it directly — Windows
# doesn't reliably kill it via just stopping a tracked background task.
pids="$(netstat -ano 2>/dev/null | grep LISTENING | grep ":${PORT} " | awk '{print $NF}' | sort -u)"
if [ -n "$pids" ]; then
  for pid in $pids; do
    log "Killing process on port $PORT (PID $pid)"
    taskkill //F //PID "$pid" >/dev/null 2>&1
  done
else
  log "Nothing listening on port $PORT"
fi

device="$(adb devices 2>/dev/null | awk '/^emulator-[0-9]+[[:space:]]+device$/ { print $1; exit }')"
if [ -n "$device" ]; then
  log "Shutting down $device"
  adb -s "$device" emu kill >/dev/null 2>&1
else
  log "No running emulator device found"
fi

log "Done"
