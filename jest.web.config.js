module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/tests/mocks/web-setup.ts'],
  testMatch: ['<rootDir>/tests/**/*.test.[jt]s?(x)'],
  moduleNameMapper: {
    '^expo/virtual/env(?:\\.js)?$': '<rootDir>/tests/mocks/expo-virtual-env.ts',
    '^@react-navigation/native$':
      '<rootDir>/tests/mocks/react-navigation-native.tsx',
  },
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
};
