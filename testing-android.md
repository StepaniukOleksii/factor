# Testing on Android

## Purpose

This document describes how to build and run Factor on Android now that Records visualization depends
on `@shopify/react-native-skia` (see [ADR-1](../adr/1-visualization-rendering-foundation.md)). Skia
ships native code, so the app can no longer run inside the plain Expo Go app — it needs a custom
development build.

This project only targets Android for now. iOS is intentionally out of scope: it would require a Mac
for a local build, or EAS Build's cloud service, and isn't needed yet.

The main testing method is a physical Android device, not the emulator — today that means opening the
app in Expo Go. The setup below replaces Expo Go with a custom development build installed once on
that same device. After that one-time install, day-to-day testing looks the same as it does now: open
the app on your phone and it connects to Metro automatically.

---

## One-time setup

### 1. Confirm your device is visible to adb

Enable Developer Options and USB debugging on the phone (Settings → About phone → tap Build number 7
times, then Settings → Developer options → USB debugging). Connect via USB (or pair over Wi-Fi — see
[Wireless debugging](#wireless-debugging-no-cable) below) and confirm:

```
adb devices
```

The device should show up as `device`, not `unauthorized` (accept the RSA prompt on the phone if asked).

An emulator also works if you'd rather not use the physical device for a given session — this machine
has an AVD named `Pixel_7`:

```
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd Pixel_7
```

### 2. Set `ANDROID_HOME` and `JAVA_HOME`

Neither is currently set in the shell environment. Gradle (used under the hood by `expo run:android`)
needs both. Android Studio bundles its own JDK, so you don't need a separate JDK install — point
`JAVA_HOME` at it. Set these as persistent user environment variables (PowerShell, run once):

```powershell
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
[Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Android\Android Studio\jbr", "User")
```

Open a new terminal afterward so the variables take effect. Verify with:

```powershell
echo $env:ANDROID_HOME
echo $env:JAVA_HOME
```

### 3. Install the dev client and Skia

```
npx expo install expo-dev-client
npx expo install @shopify/react-native-skia
```

### 4. Generate the native Android project

```
npx expo prebuild --platform android
```

This creates a gitignored `android/` folder wired up with Skia's native module. Re-run this any time a
native dependency is added, removed, or upgraded.

### 5. Build and install the development build

With your phone connected and showing up in `adb devices`:

```
npx expo run:android
```

`expo run:android` compiles the native app (first run will take several minutes) and installs it
directly on the connected device, replacing the need to open Expo Go — you'll get a separate "Factor"
dev-client app icon on the phone. This is a one-time install per device; you don't repeat it for
ordinary JS changes, only when a native dependency changes (see below).

**Alternative — EAS Build (cloud), no cable needed:** `npx eas-cli build --profile development
--platform android` compiles the same kind of build on Expo's servers instead of locally. First use
requires `npx eas-cli login` and answering the one-time `eas.json` configuration prompts. When it
finishes, EAS gives you a QR code / link to download the `.apk` straight to your phone — install it
like any sideloaded app (allow "install from unknown sources" if prompted). This is closer to the old
Expo Go experience since there's no USB/build-toolchain step on your end at all, just a one-time app
install.

---

## Wireless debugging (no cable)

Requires Android 11+. This replaces the USB cable for adb — installs, `npm run android`, logcat, all of
it — not just Metro (Metro already reaches the phone over Wi-Fi regardless, cable or not).

**Prerequisite: the phone and this PC must be on the same Wi-Fi network.** A mismatch (phone on mobile
data, PC on a different SSID or on Ethernet with Wi-Fi off) is the most common reason this doesn't work.

1. On the phone: Settings → Developer options → **Wireless debugging** → turn it on.
2. Tap into **Wireless debugging** → **Pair device with pairing code**. This shows an IP address, a
   pairing port, and a 6-digit code — keep the screen open.
3. On the PC, pair (one-time per network):
   ```
   adb pair <ip>:<pairing-port>
   ```
   Enter the 6-digit code when prompted.
4. Back on the phone's main Wireless debugging screen, note the IP address and port shown there — a
   different, stable port from the pairing one. Connect:
   ```
   adb connect <ip>:<port>
   adb devices
   ```
   The phone should show up as `<ip>:<port> device`.

Once connected, the cable can come out entirely — every command in this doc works the same over
wireless. Pairing (steps 2-3) is a one-time thing per network; after that, reconnecting (step 4) is
usually all you need, unless Wireless debugging gets toggled off or the phone reboots, in which case
the connection port may change — check the phone screen again if `adb connect` fails.

---

## Day-to-day workflow

Once the development build is installed on your phone, two commands cover everything, both already in
`package.json`:

**`npm run android`** (`expo run:android`) — rebuilds if needed (fast once cached), installs, starts
Metro, and launches the app automatically. Use this whenever native code changed (a native dependency
was added/upgraded, or `app.json`'s native config changed), or for the first run of a session.

**`npm start`** (`expo start`) — just starts Metro. Since `expo-dev-client` is installed, this already
serves the custom dev build rather than Expo Go, no extra flag needed. Use this for everyday JS/TSX
changes: open the "Factor" app already on your phone and it connects automatically, with fast refresh
same as before.

If you're testing over a flaky network, `npm run start-tunnel` works the same way it did with Expo Go.

**You only need `npm run android` (not just `npm start`) when:**

* a native dependency is added, removed, or upgraded (e.g. bumping `@shopify/react-native-skia`)
* `app.json`'s native config changes (icons, permissions, package name, etc.)

Everyday JS/TSX/logic changes never require a rebuild.

---

## Loading test data

The app ships a dev-only **"Reseed test data"** command in the React Native dev menu. Selecting it
wipes the local database and populates it with a fixed dataset covering charts with real history,
charts with too little data, and observations with no records at all — see
[testing-data.md](testing-data.md) for exactly what gets seeded, why, and a manual verification
checklist. It only exists in dev/dev-client builds (gated by `__DEV__`), never in a release build.

To open the dev menu:

* **Physical device** — shake the phone.

This is destructive — it deletes any observations/records already on the device before inserting the
fixture set, so don't run it if you have manually-entered data you want to keep.

---

## Automated tests and typechecking

Unchanged and still run on Node, no emulator needed:

```
npm run test
npm run typecheck
```

One thing to watch for: any Vitest test that renders a component using `@shopify/react-native-skia`
will need a mock, since Skia's native bindings don't exist in a Node test environment. There isn't one
in place yet — add it when the first Skia-based component gets test coverage, rather than assuming
Skia's own Jest helpers apply as-is under Vitest.

---

## Troubleshooting

* **`SDK location not found`** from Gradle — `ANDROID_HOME` isn't set or the terminal wasn't restarted
  after setting it.
* **`expo run:android` can't find a device** — confirm the phone shows up in `adb devices` as `device`
  (not `unauthorized` or missing), or start the `Pixel_7` emulator instead.
* **Device shows as `unauthorized` in `adb devices`** — unlock the phone and accept the "Allow USB
  debugging" prompt.
* **Wireless debugging is toggled on but `adb devices` still shows nothing** — turning the toggle on
  only makes the phone available, it doesn't connect anything by itself. adb still needs the one-time
  pairing plus an explicit `adb connect <ip>:<port>` — see
  [Wireless debugging](#wireless-debugging-no-cable) above.
* **Wireless debugging was working, then stopped, or never connects** — check that the phone and PC are
  actually on the *same* Wi-Fi network. This is the single most common cause (e.g. phone slipped onto
  mobile data, or the PC is on a different SSID) and won't show any error beyond `adb connect` timing
  out or the device just never appearing.
* **Stale native build after dependency changes** — `cd android && ./gradlew clean`, then re-run
  `npx expo prebuild --platform android` and `npx expo run:android`.
* **App crashes immediately on launch after adding a native module** — usually means prebuild wasn't
  re-run after the dependency was added; repeat step 4.
* **`ANDROID_HOME`/`JAVA_HOME` set correctly but Gradle still can't find them** — the variables were set
  as persistent user environment variables while a terminal/tool session was already running; that
  session keeps its old environment and won't see the update. Open a genuinely new terminal, or pass
  them inline for one command as a workaround: `JAVA_HOME="..." ANDROID_HOME="..." npx expo run:android`.
* **`adb install` fails with `INSTALL_FAILED_USER_RESTRICTED: Install canceled by user`** — even with
  "USB debugging" and "Install via USB" enabled in Developer options, MIUI (Xiaomi/Redmi/POCO) shows an
  "Allow installation via USB?" popup directly on the phone screen at install time. It auto-cancels
  (with this exact error) if you don't tap it within a few seconds — watch the phone the moment the
  install starts. If the APK already built successfully, you don't need to rebuild: just retry
  `adb install -r -d <path to the .apk>` once you've caught the popup.
