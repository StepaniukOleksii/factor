const fs = require('fs');
const path = require('path');
const { withAppBuildGradle, withDangerousMod } = require('expo/config-plugins');

// `android/` is generated and gitignored, so anything edited there by hand is lost on the next
// `expo prebuild`. This plugin reapplies the native config that has to outlive the folder:
//
//   1. Release builds sign with a real keystore instead of the shared debug one, so the installed
//      app can be updated in place. The credentials live in ~/.gradle/gradle.properties, outside
//      the repo — see releasing-android.md. Without them the release build falls back to debug
//      signing, keeping a fresh clone, CI, and the emulator buildable with no keystore present.
//   2. Debug builds get a `.dev` application id suffix, so the dev client and the real app can sit
//      on the same device without one uninstalling the other. They are also labelled "Factor Dev",
//      since two apps called "Factor" on one home screen defeats the point of keeping them apart.
const STORE_FILE_PROPERTY = 'FACTOR_RELEASE_STORE_FILE';

const RELEASE_SIGNING_CONFIG = `        if (project.hasProperty('${STORE_FILE_PROPERTY}')) {
            release {
                storeFile file(${STORE_FILE_PROPERTY})
                storePassword FACTOR_RELEASE_STORE_PASSWORD
                keyAlias FACTOR_RELEASE_KEY_ALIAS
                keyPassword FACTOR_RELEASE_KEY_PASSWORD
            }
        }
`;

// Anchors into the Expo template's build.gradle. Each is asserted before use: a silent no-op here
// would ship a debug-signed release, which installs fine and only fails months later at update time.
const replacements = [
  {
    // Close of the template's `debug` signing config, immediately before `signingConfigs` ends.
    find: "            keyPassword 'android'\n        }\n    }\n",
    replace: `            keyPassword 'android'\n        }\n${RELEASE_SIGNING_CONFIG}    }\n`,
  },
  {
    find: '    buildTypes {\n        debug {\n',
    replace: '    buildTypes {\n        debug {\n            applicationIdSuffix ".dev"\n',
  },
  {
    // The `release` build type is the second `signingConfig signingConfigs.debug` in the file; the
    // first belongs to `debug` and must keep the debug keystore.
    find:
      '        release {\n' +
      '            // Caution! In production, you need to generate your own keystore file.\n' +
      '            // see https://reactnative.dev/docs/signed-apk-android.\n' +
      '            signingConfig signingConfigs.debug\n',
    replace:
      '        release {\n' +
      `            signingConfig project.hasProperty('${STORE_FILE_PROPERTY}') ? signingConfigs.release : signingConfigs.debug\n`,
  },
];

// The label override goes in a debug source set rather than the shared strings.xml: Android resource
// merging gives the variant's own resources priority, whereas redefining app_name in both places is a
// duplicate-resource build failure.
const DEBUG_APP_NAME = 'Factor Dev';

function withDebugAppName(config) {
  return withDangerousMod(config, [
    'android',
    (modConfig) => {
      const dir = path.join(modConfig.modRequest.platformProjectRoot, 'app', 'src', 'debug', 'res', 'values');
      fs.mkdirSync(dir, { recursive: true });
      const strings = `<resources>
  <string name="app_name">${DEBUG_APP_NAME}</string>
</resources>
`;
      fs.writeFileSync(path.join(dir, 'strings.xml'), strings);
      return modConfig;
    },
  ]);
}

function withSigningConfig(config) {
  return withAppBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;

    // Prebuild without `--clean` merges into the existing file, which may already carry these edits.
    if (contents.includes(STORE_FILE_PROPERTY)) return modConfig;

    for (const { find, replace } of replacements) {
      if (!contents.includes(find)) {
        throw new Error(
          'withReleaseSigning: could not find the expected build.gradle section:\n' +
            find +
            '\nThe Expo template changed — update plugins/withReleaseSigning.js to match.'
        );
      }
      contents = contents.replace(find, replace);
    }

    modConfig.modResults.contents = contents;
    return modConfig;
  });
}

module.exports = function withReleaseSigning(config) {
  return withDebugAppName(withSigningConfig(config));
};
