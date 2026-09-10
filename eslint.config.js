// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // functions/lib is compiled output (gitignored); linting it reports
    // errors against code nobody edits.
    ignores: ['dist/*', 'functions/lib/*', 'functions/lib/**/*'],
  },
]);
