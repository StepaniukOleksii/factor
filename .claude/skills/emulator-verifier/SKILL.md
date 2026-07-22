---
name: emulator-verifier
description: Boots the Android emulator and visually verifies a Factor app change by building, installing, and screenshotting it. Use when the user explicitly asks for emulator or visual verification of a change. Not for automated test frameworks and not for day-to-day physical-device testing (see testing-android-manually.md for that).
metadata:
  version: "1.1.1"
---

# Emulator Verifier

Verify a change by running Factor on the Android emulator and inspecting a screenshot. Slow (minutes) — only
do this when the user explicitly asks for emulator/visual verification, not as a default verification step.

This covers manual, screenshot-based verification only.

Every `adb` command below targets the serial `emulator-setup.sh` prints (normally `emulator-5554`) — the
scripts only ever resolve `emulator-*` serials, so they're safe even if a physical device is also connected.

1. **Setup**: `bash scripts/emulator-setup.sh`. Boots (or reuses) the emulator, frees a stale port-8081
   process, resets the app's on-device database for a fresh schema, then builds, installs, and launches the
   app. Blocks until the app is confirmed running — don't background or poll it yourself, and don't add your
   own settle-time wait after it returns. On success it prints `READY device=<serial> log=<path>`; use
   `<serial>` for every command below. On failure it exits non-zero with the reason on stderr — read `<path>`
   (the raw build log) before retrying.
    * The database reset only deletes the app's SQLite directory (via `run-as`, not `pm clear`) — the AVD's
      disk otherwise persists indefinitely across runs (unlike its boot state, which `-no-snapshot` resets
      every time), so a schema change can silently look broken just because a previous run's database
      predates it. A full `pm clear` would also reset here, but it wipes the Expo dev-launcher's "seen this
      before" flag too, which then intercepts the next launch with an onboarding screen.
2. **Screenshot**: `adb -s <serial> exec-out screencap -p > file.png`, then read the image — this also shows
   it to the user, so don't skip it or just describe the result in text. Do this for every screenshot you take
   during verification, not only the first. Also check for error toasts: `adb -s <serial> logcat -d | grep -i
   error`.
    * If the JS bundle fails to load mid-session (Metro restarted independently of the app), logcat shows
      repeated `okhttp.OkHttpClient` / `BundleDownloader` errors and the app is stuck on a
      "Bundling"/"Reloading" banner — the emulator's simulated network cycling through connectivity probes,
      not a real bug. Force-stop and relaunch: `adb -s <serial> shell am force-stop com.anonymous.factor`,
      then reopen via the intent in step 3.
3. **Reload without rebuilding**: `adb -s <serial> shell am start -a android.intent.action.VIEW -d
   "exp+factor://expo-development-client/?url=http://10.0.2.2:8081"`. `10.0.2.2` is the emulator's alias for
   the host's loopback — doesn't apply to a physical device.
4. **Teardown**: `bash scripts/emulator-teardown.sh`. Always run this, even after a setup failure — it's
   idempotent.
