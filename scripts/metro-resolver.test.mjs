import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');
const root = resolve(import.meta.dirname, '..');
const webRoot = dirname(require.resolve('react-native-web/package.json'));
const config = require('../metro.config.js');
const original = withNativewind(getDefaultConfig(root), { inlineRem: 16 });
function resolveImport(resolver, originModulePath, moduleName, platform) {
  const calls = [];
  const result = resolver(
    {
      originModulePath,
      resolveRequest: (_context, name, target) => {
        calls.push([name, target]);
        return {
          type: 'sourceFile',
          filePath: name.startsWith('react-native-css/')
            ? `/installed/${name}.js`
            : platform === 'web'
              ? join(webRoot, 'dist/exports/FlatList/index.js')
              : name === 'react-native'
                ? join(root, 'node_modules/react-native/index.js')
                : join(
                    root,
                    'node_modules/react-native/Libraries/Lists/FlatList.js',
                  ),
        };
      },
    },
    moduleName,
    platform,
  );
  return { result, calls };
}
test('RN Web internal FlatList import stays internal instead of cycling through CSS wrapper', () => {
  const origin = join(
    webRoot,
    'dist/vendor/react-native/Animated/components/AnimatedFlatList.js',
  );
  const value = resolveImport(
    config.resolver.resolveRequest,
    origin,
    '../../../../exports/FlatList',
    'web',
  );
  assert.equal(
    value.result.filePath,
    join(webRoot, 'dist/exports/FlatList/index.js'),
  );
  assert.equal(value.calls.length, 1);
});
test('app web imports still use NativeWind wrappers; sibling package is not treated as RN Web', () => {
  for (const origin of [
    join(root, 'src/App.tsx'),
    join(`${webRoot}-other`, 'index.js'),
  ]) {
    const value = resolveImport(
      config.resolver.resolveRequest,
      origin,
      'react-native',
      'web',
    );
    assert.equal(
      value.result.filePath,
      '/installed/react-native-css/components/FlatList.js',
    );
  }
  assert.equal(config.transformerPath, original.transformerPath);
  assert.deepEqual(
    config.transformer.reactNativeCSS,
    original.transformer.reactNativeCSS,
  );
  assert.deepEqual(config.resolver.sourceExts, original.resolver.sourceExts);
});
for (const platform of ['ios', 'android']) {
  test(`${platform} delegates exactly as the existing NativeWind resolver`, () => {
    for (const origin of [
      join(root, 'src/App.tsx'),
      join(webRoot, 'dist/index.js'),
    ]) {
      for (const name of [
        'react-native',
        'react-native-safe-area-context',
        './FlatList',
        'react-native-css-metro-override',
      ]) {
        assert.deepEqual(
          resolveImport(config.resolver.resolveRequest, origin, name, platform),
          resolveImport(
            original.resolver.resolveRequest,
            origin,
            name,
            platform,
          ),
        );
      }
    }
  });
}
test('Babel keeps RN Web internals, app styling and native output correct across cached callers', () => {
  const expoRequire = createRequire(require.resolve('expo/package.json'));
  const babelRequire = createRequire(expoRequire.resolve('babel-preset-expo'));
  // Expo owns these transitive Babel packages. Resolve them for the isolated
  // probe without adding a dependency or changing the parent test process.
  const probe = function () {
    const assert = require('node:assert/strict');
    const { join } = require('node:path');
    const { transformSync } = require(process.argv[1]);
    const [root, webRoot] = process.argv.slice(2);
    const configFile = join(root, 'babel.config.js');
    const configured = require(configFile)({ caller: (fn) => fn(undefined) });
    const original = {
      presets: [['babel-preset-expo'], 'nativewind/babel'],
      plugins: configured.plugins,
    };
    const internal = join(
      webRoot,
      'dist/vendor/react-native/Animated/components/AnimatedFlatList.js',
    );
    const app = join(root, 'src/App.tsx');
    const internalSource =
      "import FlatList from '../../../../exports/FlatList'; export const render = () => <FlatList />;";
    const appSource =
      "import { View, FlatList } from 'react-native'; export const render = () => <View className='flex-1'><FlatList /></View>;";
    const transform = (source, filename, platform, baseline = false) => {
      const options = {
        cwd: root,
        filename,
        babelrc: false,
        ...(platform === undefined
          ? {}
          : {
              caller: {
                name: 'metro',
                platform,
                supportsStaticESM: true,
                isDev: true,
              },
            }),
        ...(baseline ? { configFile: false, ...original } : { configFile }),
      };
      return transformSync(source, options).code;
    };
    // Reuse one Babel process/config cache while alternating callers and files.
    for (const platform of [
      'web',
      'ios',
      'web',
      'android',
      undefined,
      'web',
      'ios',
    ]) {
      if (platform === 'web') {
        const output = transform(internalSource, internal, platform);
        assert.doesNotMatch(output, /react-native-css/);
        assert.match(output, /exports\/FlatList/);
        assert.doesNotMatch(output, /<FlatList/); // Expo still transforms JSX.
        for (const filename of [app, join(`${webRoot}-other`, 'index.jsx')]) {
          const styled = transform(appSource, filename, platform);
          assert.match(styled, /react-native-css/);
          assert.equal(styled, transform(appSource, filename, platform, true));
        }
      } else {
        for (const [source, filename] of [
          [internalSource, internal],
          [appSource, app],
        ]) {
          assert.equal(
            transform(source, filename, platform),
            transform(source, filename, platform, true),
          );
        }
      }
    }
    console.log(
      'web internal/app/sibling + ios/android/no-caller output and cache controls passed',
    );
  };
  const output = execFileSync(
    process.execPath,
    [
      '-e',
      `(${probe.toString()})();`,
      babelRequire.resolve('@babel/core'),
      root,
      webRoot,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_PATH: dirname(
          dirname(expoRequire.resolve('babel-preset-expo/package.json')),
        ),
      },
    },
  );
  assert.match(output, /cache controls passed/);
});
