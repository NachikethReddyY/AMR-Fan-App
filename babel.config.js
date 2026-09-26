const { dirname, sep } = require('node:path');

module.exports = function (api) {
  const isWeb = api.caller((caller) => caller?.platform === 'web');
  const webPackage = dirname(require.resolve('react-native-web/package.json'));

  return {
    presets: [['babel-preset-expo']],

    overrides: [
      {
        // Keep RN Web's internal imports out of CSS wrappers that import its index.
        // Expo and the remaining plugins still transform these dependency files.
        exclude: isWeb
          ? (filename) => filename.startsWith(`${webPackage}${sep}`)
          : undefined,
        presets: ['nativewind/babel'],
      },
    ],

    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],

          alias: {
            '@': './',
            'tailwind.config': './tailwind.config.js',
          },
        },
      ],
      'react-native-worklets/plugin',
    ],
  };
};
