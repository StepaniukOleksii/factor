# Releasing on Android

## Purpose

This document describes how to build the standalone Factor app — the one installed on a phone and used for real, with
real data. It is the counterpart to [testing-android-manually.md](testing-android-manually.md), which covers the
development build used while working on the app.

The difference is what the APK contains. A development build loads its JavaScript from Metro running on this PC, so the
phone is useless without the laptop. A release build embeds the JS bundle in the APK, so it launches on its own,
offline, with no cable and no dev server. It also compiles out everything gated by `__DEV__` — notably the "Reseed test
data" dev-menu command, which would otherwise be one shake away from wiping real observations (see
[testing-data.md](testing-data.md)).

As with the development build, Android is the only target; iOS is out of scope.

---

## Two apps on one device

Debug builds carry a `.dev` application id suffix, applied by
[plugins/withReleaseSigning.js](plugins/withReleaseSigning.js). The two builds therefore install as separate Android
apps:

* `io.github.stepaniukoleksii.factor.dev` — the development build, driven by Metro, holding whatever test data the
  seeding command last wrote.
* `io.github.stepaniukoleksii.factor` — the real app, holding real data.

They keep separate databases and can sit on the phone at the same time. Nothing done while developing can reach the real
data, and `npm run android` never uninstalls the app being used for real. The Maestro flows and
[scripts/emulator-setup.sh](scripts/emulator-setup.sh) target the `.dev` id, since E2E runs against the development
build.

The suffix does mean `expo run:android` has to be told which id to launch, because it reads `applicationId` from
`build.gradle` and does not account for the suffix. The `--app-id` flag is already baked into the `android` script in
[package.json](package.json), so `npm run android` works unchanged.

---

## One-time setup: the release keystore

The signing key is the app's permanent identity. Android refuses to install an update whose signature does not match the
installed copy, so replacing or losing the key means uninstalling first — which deletes the local database along with
the app. There is no export feature, so that database is the only copy of the data.

This is why the release build cannot keep using the debug keystore it ships with by default. That file lives inside
`android/`, which is generated and gitignored, and `expo prebuild` regenerates it. The first prebuild after a dependency
change would silently produce a differently-signed app that Android then refuses to install over the existing one.

### 1. Generate the keystore

The keystore lives in `keys/` at the repo root. That folder is gitignored — the repo is public, and a committed signing
key is a published one, recoverable from history long after the file is deleted. It sits inside the repo for convenience
only, next to the project it signs.

```powershell
New-Item -ItemType Directory -Force keys
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v -storetype PKCS12 -keystore keys\factor-release.jks -alias factor -keyalg RSA -keysize 2048 -validity 10000
```

It prompts for a keystore password and some identity fields (name, organisation, country); the identity fields only
appear in the certificate and can be anything. Note that `android/app/debug.keystore` is a different file and is not
this one — the debug key is regenerated at will, which is exactly what this key must never do.

### 2. Point Gradle at it

Gradle reads per-user properties from `C:\Users\olgau\.gradle\gradle.properties`, which is outside the repo and never
committed. Create it if it does not exist and add:

```properties
FACTOR_RELEASE_STORE_FILE=C:/Users/olgau/Developer/factor/keys/factor-release.jks
FACTOR_RELEASE_STORE_PASSWORD=<the password chosen above>
FACTOR_RELEASE_KEY_ALIAS=factor
FACTOR_RELEASE_KEY_PASSWORD=<the same password, unless a separate key password was set>
```

Use forward slashes even on Windows — Gradle reads a backslash in a properties file as an escape character.

### 3. Back up the keystore

Copy the `.jks` somewhere off this machine. Being gitignored, it is not backed up by pushing — a lost laptop loses the
key. Losing it is unrecoverable: no future build can ever update the installed app, and the only way forward is
uninstall and reinstall, taking the data with it.

### 4. Verify the wiring

```
cd android && ./gradlew :app:signingReport
```

The `release` variant should report `Config: release` and the path to the `.jks`. If it reports `Config: debug`, the
properties are not being picked up. That fallback is deliberate — it keeps a fresh clone, CI, and the emulator buildable
with no keystore present — which is exactly why it is worth checking rather than assuming.

---

## Building and installing

With the phone connected and showing up in `adb devices` (USB or wireless — see
[testing-android-manually.md](testing-android-manually.md)):

```
npm run android:release
```

This compiles the release variant and installs it. The first release build takes several minutes, since the debug
build's cache does not carry over.

To build the APK without installing it — to copy it to the phone directly, or keep it around:

```
cd android && ./gradlew assembleRelease
```

The APK lands at `android/app/build/outputs/apk/release/app-release.apk`, and installs with `adb install -r <path>` or
by opening the file on the phone.

That APK is universal: it carries every ABI listed in `android/gradle.properties`, which makes it far larger than any
one phone needs. To build for the phone's architecture alone — `arm64-v8a` on anything modern — pass it explicitly:

```
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

Check the phone's architecture with `adb shell getprop ro.product.cpu.abi` if unsure. The universal APK is the safer
default; the single-ABI one is worth it when moving the file around by hand.

---

## Shipping yourself an update

Bump `android.versionCode` in [app.json](app.json) — Android refuses to install a build whose `versionCode` is lower
than the installed one, and treats an equal one as a reinstall. Bump `version` too when the change is worth naming; it
is what shows in the phone's app info screen.

Then rebuild and install as above. The data survives, as long as the application id and the signing key are unchanged.

Re-run `npx expo prebuild --platform android` first whenever a native dependency or `app.json`'s native config changed,
exactly as for the development build. The signing config and the `.dev` suffix survive that, since the config plugin
reapplies both on every prebuild.

---

## Troubleshooting

* **`INSTALL_FAILED_UPDATE_INCOMPATIBLE`** — the installed copy was signed with a different key, usually because it was
  built before the keystore was set up and is therefore debug-signed. The only fix is to uninstall it first, which
  deletes its data.
* **An app chooser appears instead of the app when opening an `exp+factor://` dev-client link** — both builds register
  that scheme, so with the real app installed the link is ambiguous. `npm run android` is unaffected, since it launches
  the activity by explicit component; the chooser only shows for a bare link, where "Factor Dev" is the one to pick.
* **`INSTALL_FAILED_VERSION_DOWNGRADE`** — the APK's `versionCode` is lower than the installed app's. Bump it in
  `app.json` and prebuild.
* **The installed app still shows the dev menu, or "Reseed test data" is present** — that is the development build.
  Check which id got installed: `adb shell pm list packages | grep factor`.
* **`signingReport` says `Config: debug` for the release variant** — `gradle.properties` is missing, in the wrong place,
  or has a `FACTOR_RELEASE_*` key misspelled. It must be the per-user file under `C:\Users\olgau\.gradle\`, not the
  project's `android/gradle.properties`.
* **Gradle fails with a keystore password error** — a backslash in `FACTOR_RELEASE_STORE_FILE`, or a password containing
  characters the properties format treats specially. Use forward slashes in the path.
* **`INSTALL_FAILED_USER_RESTRICTED: Install canceled by user`** on a Xiaomi/Redmi/POCO phone — the MIUI install prompt
  auto-cancels if it is not tapped within a few seconds. Retry `adb install -r` and watch the phone screen; the APK does
  not need rebuilding.
