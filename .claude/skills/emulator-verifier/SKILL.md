---
name: emulator-verifier
description: Boots the Android emulator and visually verifies a Factor app changes by building, installing, and screenshotting it. Use when the user explicitly asks for emulator or visual verification of a change. Not for automated test frameworks (none wired in yet) and not for day-to-day physical-device testing (see testing-android.md for that).
metadata:
  version: "1.0.0"
---

# Emulator Verifier

Verify a change by running Factor on the Android emulator and inspecting a screenshot. This is slow (minutes) —
only do this when the user explicitly asks for emulator/visual verification, not as a default verification step
for implementation or bug-fix work.

This covers manual, screenshot-based verification only. There is no automated on-device test framework wired in
yet — when one is configured later, extend this skill to drive it instead of stopping at a screenshot.

Every plain `adb` command below targets `-s emulator-5554`, the serial the first (and normally only)
emulator instance gets — if `adb devices` ever shows a different one, substitute it throughout. `npm run
android` uses a separate identifier instead (`--device Pixel_7`, the AVD name), since Expo's own device
resolution matches by name, not serial. A physical device is often also connected per
`testing-android.md`'s day-to-day workflow, so don't rely on either command picking the right target when
unqualified: plain `adb` errors outright ("more than one device/emulator") when it's ambiguous, but
`expo run:android` doesn't — with no `--device` flag it silently falls back to whichever device sorts
first, no prompt and no error, so an unqualified run can land on the phone with nothing to show that's
what happened.

1. **Boot it in the background**: `"$LOCALAPPDATA/Android/Sdk/emulator/emulator.exe" -avd Pixel_7
   -no-snapshot`. It never exits on its own — don't wait for "completion". `-no-snapshot` skips both
   loading and saving snapshot state, since every boot here is meant to start cold anyway. Poll separately
   until actually ready (`adb devices` showing `device` is not enough):
   `adb -s emulator-5554 wait-for-device && until [ "$(adb -s emulator-5554 shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do sleep 5; done`
2. **Check port 8081 isn't already held** by a stale process from a previous run:
   `netstat -ano | grep LISTENING | grep ":8081 "`. If it is, kill it: `taskkill //F //PID <pid>`
   (PowerShell's `Stop-Process` isn't available in Git Bash — it's `command not found`). A leftover
   Metro instance silently absorbs the next run instead of erroring, making it look fine when it isn't
   actually testing your change. (Anchor on `:8081 ` with the trailing space — a bare `8081` also
   matches unrelated ports like `18081`.)
3. **Build, install, and launch — never await this command.** Once installed it starts Metro and blocks
   forever serving the bundle, so background it from the start: `npm run android -- --device Pixel_7`.
    * Clear logcat right before this (`adb -s emulator-5554 logcat -c`), so the error check in step 4
      reflects only this run and not stale noise from boot or an earlier verify cycle.
    * Git Bash's `JAVA_HOME` can be shadowed by a shell profile (e.g. SDKMAN) pointing at a path that
      doesn't exist. If the build fails with "JAVA_HOME is set to an invalid directory", override inline:
      `JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" npm run android -- --device Pixel_7`.
    * Poll its log for a readiness line instead of waiting on the command (e.g. `Waiting on
     http://localhost:8081` or the install line). Cover every path that means "done" in your match
      pattern, including the skipped-dev-server case when port 8081 was already busy — a pattern that
      only matches the happy path will poll forever after a partial/alternate success.
4. **Screenshot**: `adb -s emulator-5554 exec-out screencap -p > file.png`, then read the image. A
   rendered screen isn't full proof by itself — also check for error toasts /
   `adb -s emulator-5554 logcat -d | grep -i error`.
    * **The JS bundle can fail to load in the first minute or two after a fresh boot**, even though the
      build/install itself succeeded: `adb logcat` shows `okhttp.OkHttpClient: Callback failure` /
      `java.net.ProtocolException: Expected leading [0-9a-fA-F] character but was 0x2d` from
      `BundleDownloader.processMultipartResponse`, and the app is stuck on a "Bundling"/"Reloading" banner
      forever. This is the emulator's simulated network still cycling through connectivity probes right
      after `sys.boot_completed=1` fires (visible as repeated `NetworkMonitor` probe-failed lines in
      logcat around the same time), not a real problem with the build. Force-stop and relaunch once
      things have had a couple minutes to settle (`adb -s emulator-5554 shell am force-stop
     com.anonymous.factor`, then re-open via the intent in step 5) rather than concluding the change
      broke something.
5. **Reload without rebuilding**, if Metro was restarted independently of the app:
   `adb -s emulator-5554 shell am start -a android.intent.action.VIEW -d
   "exp+factor://expo-development-client/?url=http://10.0.2.2:8081"`. `10.0.2.2` is the standard alias an
   emulator uses to reach the host machine's loopback — a physical device's actual IP does not apply
   here.
6. **Tear down when done** — don't leave things running:
    * Metro: resolve the PID actually bound to port 8081 (`netstat -ano | grep LISTENING | grep ":8081 "`)
      and kill it directly. Stopping the tracked background task alone does not reliably kill it on
      Windows.
    * Emulator: `adb -s emulator-5554 emu kill` — a clean shutdown, unlike killing the process tree.
