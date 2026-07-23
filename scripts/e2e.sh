#!/usr/bin/env bash
# Runs the Maestro E2E suite against the Factor Android emulator, end to end.
# This is the "check" step the setup/teardown scripts were built to wrap: it
# boots + builds + installs + launches the app via emulator-setup.sh, runs the
# flows with Maestro, then tears the environment down via emulator-teardown.sh.
#
# Usage:
#   bash scripts/e2e.sh                 # run every flow in .maestro/
#   bash scripts/e2e.sh <flow-path>     # run a single flow or dir (repo-relative)
#   E2E_KEEP_EMULATOR=1 bash scripts/e2e.sh   # leave the emulator + Metro up
#
# Exits with Maestro's own exit code (0 = all flows passed), so it can gate CI.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"                       # so .maestro/ and npm resolve from the root
FLOW="${1:-.maestro/}"

log() { echo "[e2e] $*" >&2; }

# The Maestro installer puts the CLI at ~/.maestro/bin and adds it to PATH via
# the shell *profile* — which a non-interactive `bash script.sh` (as `npm run
# e2e` spawns) does not source. Add the standard location ourselves so the run
# doesn't depend on an interactive shell having loaded the profile.
export PATH="$HOME/.maestro/bin:$PATH"

# Maestro runs on the JVM and dies if JAVA_HOME points somewhere without a
# working java. This machine's JAVA_HOME can be a broken sdkman 'current'
# symlink (no bin/java.exe); fall back to Android Studio's bundled JBR, exactly
# as emulator-setup.sh does for the Gradle build.
if [ -n "${JAVA_HOME:-}" ] && [ ! -x "$JAVA_HOME/bin/java.exe" ]; then
  log "JAVA_HOME ($JAVA_HOME) has no working bin/java.exe — overriding"
  export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
fi

# Fail fast — before the multi-minute emulator build — if Maestro isn't usable.
if ! command -v maestro >/dev/null 2>&1; then
  log "Maestro CLI not found (looked in \$HOME/.maestro/bin too)."
  log "Install it:  curl -Ls \"https://get.maestro.mobile.dev\" | bash"
  exit 1
fi

# Registered only now, so a missing-Maestro abort above never tears down an
# emulator/Metro the user may have had running for something else. Runs on
# every exit path once set — including a setup failure or a Maestro crash.
teardown() {
  if [ -n "${E2E_KEEP_EMULATOR:-}" ]; then
    log "E2E_KEEP_EMULATOR set — leaving the emulator and Metro running"
    log "Re-run flows without a rebuild:  maestro test $FLOW"
    return
  fi
  bash "$SCRIPT_DIR/emulator-teardown.sh"
}
trap teardown EXIT

# Setup streams its progress to stderr and prints exactly one machine-readable
# line to stdout: "READY device=<serial> log=<path>". Capture stdout to parse
# the serial; stderr flows straight through so its progress is still visible.
if ! ready_line="$(bash "$SCRIPT_DIR/emulator-setup.sh")"; then
  log "setup failed — see its output above; skipping Maestro"
  exit 1
fi

device="${ready_line#*device=}"
device="${device%% *}"
if [ -z "$device" ]; then
  log "could not parse a device serial from setup output: '$ready_line'"
  exit 1
fi

log "Running Maestro against $device: $FLOW"
# --device targets the emulator serial explicitly, so a physical device
# connected alongside it is never picked (matching the setup/teardown scripts,
# which only ever resolve emulator-* serials).
maestro test --device "$device" "$FLOW"
status=$?

if [ "$status" -eq 0 ]; then
  log "Maestro: all flows passed"
else
  log "Maestro: failures (exit $status) — artifacts under ~/.maestro/tests/"
fi
exit "$status"
