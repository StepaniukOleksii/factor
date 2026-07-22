#!/usr/bin/env bash
# Boots the Factor Android emulator (or reuses one already running), frees a
# stale Metro process left on the dev-server port by a previous run, then
# builds, installs, and launches the app. Blocks until the app is ready to
# be checked, then prints one line to stdout:
#   READY device=<serial> log=<path-to-build-log>
# On failure, prints the reason to stderr and exits non-zero.
#
# Used by the emulator-verifier skill's setup step; also intended for a
# future automated test framework to reuse as its own setup phase — only
# the "check" step in between setup and teardown should need to change.
set -uo pipefail

AVD_NAME="Pixel_7"
PACKAGE="com.anonymous.factor"
PORT=8081
BOOT_TIMEOUT=180
BUILD_TIMEOUT=900
DISPLAY_TIMEOUT=60
JS_TIMEOUT=150
LOG_FILE="$(mktemp -t emulator-setup-build.XXXXXX.log)"

log() { echo "[emulator-setup] $*" >&2; }
fail() { log "FAILED: $*"; exit 1; }

resolve_device() {
  adb devices | awk '/^emulator-[0-9]+[[:space:]]+device$/ { print $1; exit }'
}

DEVICE="$(resolve_device)"
if [ -n "$DEVICE" ] && [ "$(adb -s "$DEVICE" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; then
  log "Reusing already-booted $DEVICE"
else
  log "Booting $AVD_NAME"
  "$LOCALAPPDATA/Android/Sdk/emulator/emulator.exe" -avd "$AVD_NAME" -no-snapshot >/dev/null 2>&1 &
  disown

  waited=0
  while [ -z "$DEVICE" ]; do
    DEVICE="$(resolve_device)"
    [ -n "$DEVICE" ] && break
    sleep 3
    waited=$((waited + 3))
    [ "$waited" -ge "$BOOT_TIMEOUT" ] && fail "no emulator device appeared within ${BOOT_TIMEOUT}s"
  done

  adb -s "$DEVICE" wait-for-device
  waited=0
  until [ "$(adb -s "$DEVICE" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
    sleep 5
    waited=$((waited + 5))
    [ "$waited" -ge "$BOOT_TIMEOUT" ] && fail "$DEVICE did not finish booting within ${BOOT_TIMEOUT}s"
  done
  log "$DEVICE booted"
fi

# A leftover Metro instance from a previous run silently absorbs this run
# instead of erroring, making a stale result look like a fresh one.
stale_pids="$(netstat -ano | grep LISTENING | grep ":${PORT} " | awk '{print $NF}' | sort -u)"
if [ -n "$stale_pids" ]; then
  for pid in $stale_pids; do
    log "Killing stale process on port $PORT (PID $pid)"
    taskkill //F //PID "$pid" >/dev/null 2>&1
  done
fi

# The AVD's disk (unlike its boot state) survives every run, so a previous
# session's SQLite database silently carries over even across -no-snapshot
# cold boots — a schema change can then look broken only because the on-disk
# database predates it, not because of the change itself. Deleting just the
# SQLite directory resets app data for a guaranteed-fresh schema on every
# run, without `pm clear`'s side effect of also wiping the Expo
# dev-launcher's "seen this before" flag, which would otherwise interject an
# onboarding screen on the next launch. A no-op (harmless failure) on a
# device where the package isn't installed yet.
if adb -s "$DEVICE" shell pm list packages "$PACKAGE" 2>/dev/null | grep -q "$PACKAGE"; then
  log "Resetting on-device database for a fresh schema"
  adb -s "$DEVICE" shell run-as "$PACKAGE" rm -rf files/SQLite >/dev/null 2>&1
fi

adb -s "$DEVICE" logcat -c

# Git Bash's JAVA_HOME can be shadowed by a shell profile (e.g. SDKMAN)
# pointing at a broken install — a directory that exists but has no
# bin/java.exe under it (e.g. an incomplete SDKMAN "current" pointer),
# which fails the Gradle build. A plain `-d` check isn't enough since the
# directory itself can exist even when it's not a working JDK.
if [ -n "${JAVA_HOME:-}" ] && [ ! -x "$JAVA_HOME/bin/java.exe" ]; then
  log "JAVA_HOME ($JAVA_HOME) has no working bin/java.exe — overriding"
  export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
fi

log "Building, installing, and launching (log: $LOG_FILE)"
npm run android -- --device "$AVD_NAME" >"$LOG_FILE" 2>&1 &
BUILD_PID=$!
disown

# The real readiness signal is the dev server actually serving — checking
# that directly is more robust than matching specific log wording, which
# can vary between a fresh Metro start and other code paths.
waited=0
while true; do
  if netstat -ano | grep LISTENING | grep -q ":${PORT} "; then
    break
  fi
  if ! kill -0 "$BUILD_PID" 2>/dev/null; then
    fail "build process exited before serving on port ${PORT} — see $LOG_FILE"
  fi
  if grep -qiE "^ERROR|BUILD FAILED|exited with non-zero code" "$LOG_FILE" 2>/dev/null; then
    fail "build failed — see $LOG_FILE"
  fi
  sleep 5
  waited=$((waited + 5))
  [ "$waited" -ge "$BUILD_TIMEOUT" ] && fail "build/install did not start serving on port ${PORT} within ${BUILD_TIMEOUT}s — see $LOG_FILE"
done

log "Metro serving — waiting for the app to actually display"

# The dev server coming up isn't the same as the app being on screen: there's
# a further couple seconds of Android activity-launch lag in between. Wait
# for the system's own "first frame drawn" signal instead of guessing a
# fixed delay. logcat was cleared before the build started, so any match
# here is necessarily from this run, not a stale one.
waited=0
until adb -s "$DEVICE" logcat -d 2>/dev/null | grep -q "Displayed ${PACKAGE}/"; do
  if ! kill -0 "$BUILD_PID" 2>/dev/null; then
    fail "build process exited before the app was displayed — see $LOG_FILE"
  fi
  sleep 2
  waited=$((waited + 2))
  [ "$waited" -ge "$DISPLAY_TIMEOUT" ] && fail "app did not display within ${DISPLAY_TIMEOUT}s of the dev server coming up — see $LOG_FILE"
done

log "App window displayed — waiting for the JS app to start running"

# "Displayed" only means the native window was composited — for a fresh
# React Native app that's typically still a blank root view. The JS bundle
# itself can take much longer to load, especially right after a cold boot
# when the emulator's simulated network is still cycling through
# connectivity probes (the same known cause as the bundle-load gotcha in
# the emulator-verifier skill). Wait for the JS runtime to actually start —
# a generic React Native signal, not app-specific — before calling it ready.
waited=0
until adb -s "$DEVICE" logcat -d 2>/dev/null | grep -q 'ReactNativeJS: Running "main"'; do
  if ! kill -0 "$BUILD_PID" 2>/dev/null; then
    fail "build process exited before the JS app started running — see $LOG_FILE"
  fi
  sleep 2
  waited=$((waited + 2))
  [ "$waited" -ge "$JS_TIMEOUT" ] && fail "JS app did not start running within ${JS_TIMEOUT}s of the window being displayed — see $LOG_FILE"
done

log "JS app running"
echo "READY device=$DEVICE log=$LOG_FILE"
