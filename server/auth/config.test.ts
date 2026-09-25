import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authConfig } from './config.ts';

const production = {
  NODE_ENV: 'production',
  AUTH_ISSUER: 'https://identity.example.test/tenant',
  AUTH_AUDIENCE: 'amr-api',
  AUTH_JWKS_URL: 'https://identity.example.test/tenant/keys',
  AUTH_REQUIRED_SCOPE: 'account.access',
  API_HOST: '0.0.0.0',
};
test('production requires complete verification configuration and refuses dev bypass', () => {
  assert.equal(authConfig(production).kind, 'oidc');
  for (const key of [
    'AUTH_ISSUER',
    'AUTH_AUDIENCE',
    'AUTH_JWKS_URL',
    'AUTH_REQUIRED_SCOPE',
  ]) {
    assert.throws(() => authConfig({ ...production, [key]: '' }));
  }
  assert.throws(() => authConfig({ ...production, AUTH_DEV_ENABLED: 'true' }));
  assert.throws(() =>
    authConfig({ ...production, AUTH_JWKS_URL: 'http://keys.test' }),
  );
  assert.throws(() =>
    authConfig({ ...production, AUTH_ISSUER: 'http://issuer.test' }),
  );
  assert.throws(() => authConfig({ ...production, NODE_ENV: 'prod' }));
  assert.throws(() => authConfig({}));
});
test('synthetic sign-in requires explicit development mode and loopback binding', () => {
  assert.equal(
    authConfig({
      NODE_ENV: 'development',
      AUTH_DEV_ENABLED: 'true',
      API_HOST: '127.0.0.1',
    }).kind,
    'synthetic',
  );
  assert.throws(() =>
    authConfig({
      NODE_ENV: 'development',
      AUTH_DEV_ENABLED: 'true',
      API_HOST: '0.0.0.0',
    }),
  );
  assert.throws(() =>
    authConfig({ NODE_ENV: 'development', AUTH_DEV_ENABLED: 'yes' }),
  );
});
