const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      '.expo/**',
      'dist/**',
      'coverage/**',
      '.scratch/**',
      '.evidence/**',
      'convex/_generated/**',
      '.agents/**',
      '.agents.local/**',
      '.claude/**',
      'security/fixtures/**',
    ],
  },
]);
