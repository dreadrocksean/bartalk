const { createRunOncePlugin, withPodfile } = require("@expo/config-plugins");
const {
  mergeContents,
} = require("@expo/config-plugins/build/utils/generateCode");

const RNFIREBASE_PODFILE_LINES = [
  "  $RNFirebaseAsStaticFramework = true",
  "  pod 'FirebaseAuthInterop', :modular_headers => true",
  "  pod 'FirebaseAppCheckInterop', :modular_headers => true",
  "  pod 'GoogleUtilities', :modular_headers => true",
  "  pod 'RecaptchaInterop', :modular_headers => true",
  "  pod 'FirebaseCoreInternal', :modular_headers => true",
  "  pod 'FirebaseFirestoreInternal', :modular_headers => true",
].join("\n");

function addRNFirebasePodfileConfig(src) {
  if (src.includes("$RNFirebaseAsStaticFramework = true")) {
    return src;
  }

  return mergeContents({
    src,
    newSrc: RNFIREBASE_PODFILE_LINES,
    tag: "rnfirebase-static-framework",
    anchor: /use_expo_modules!$/m,
    offset: 1,
    comment: "#",
  }).contents;
}

function allowRNFirebaseNonModularIncludes(src) {
  if (
    src.includes(
      "CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'",
    )
  ) {
    return src;
  }

  return mergeContents({
    src,
    newSrc: [
      "    installer.pods_project.targets.each do |target|",
      "      next unless target.name.start_with?('RNFB')",
      "",
      "      target.build_configurations.each do |config|",
      "        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'",
      "      end",
      "    end",
    ].join("\n"),
    tag: "rnfirebase-non-modular-includes",
    anchor: /^\s+react_native_post_install\($/m,
    offset: 0,
    comment: "#",
  }).contents;
}

const withFirebaseModularHeaders = (config) =>
  withPodfile(config, (config) => {
    config.modResults.contents = addRNFirebasePodfileConfig(
      config.modResults.contents,
    );
    config.modResults.contents = allowRNFirebaseNonModularIncludes(
      config.modResults.contents,
    );
    return config;
  });

module.exports = createRunOncePlugin(
  withFirebaseModularHeaders,
  "with-firebase-modular-headers",
  "1.0.0",
);
