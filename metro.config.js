const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');
const { dirname, sep } = require('node:path');

const config = getDefaultConfig(__dirname);
const styled = withNativewind(config, { inlineRem: 16 });
const webPackage = dirname(require.resolve('react-native-web/package.json'));
const resolveStyled = styled.resolver.resolveRequest;

styled.resolver.resolveRequest = (context, moduleName, platform) => {
  // RN Web's own component imports must not re-enter CSS wrappers through its
  // partially initialized index. App imports still use NativeWind on every platform.
  if (
    platform === 'web' &&
    context.originModulePath.startsWith(`${webPackage}${sep}`)
  ) {
    const resolveOriginal =
      config.resolver.resolveRequest ?? context.resolveRequest;
    return resolveOriginal(context, moduleName, platform);
  }
  return resolveStyled(context, moduleName, platform);
};

module.exports = styled;
