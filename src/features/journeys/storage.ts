import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import {
  AESEncryptionKey,
  AESSealedData,
  aesEncryptAsync,
  aesDecryptAsync,
} from 'expo-crypto';
import { captureSchema, type CaptureStore } from './recorder';

const keyName = 'amr.journey.capture.key.v1';
const keyOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};
let database: Promise<SQLite.SQLiteDatabase> | undefined;
function db() {
  return (database ??= (async () => {
    const value = await SQLite.openDatabaseAsync('journey-capture.db');
    await value.execAsync(
      'PRAGMA secure_delete = ON; CREATE TABLE IF NOT EXISTS capture (id INTEGER PRIMARY KEY CHECK (id = 1), ciphertext TEXT NOT NULL)',
    );
    return value;
  })());
}
async function key(create: boolean) {
  const stored = await SecureStore.getItemAsync(keyName, keyOptions);
  if (stored) return AESEncryptionKey.import(stored, 'base64');
  if (!create) return null;
  const generated = await AESEncryptionKey.generate();
  await SecureStore.setItemAsync(
    keyName,
    await generated.encoded('base64'),
    keyOptions,
  );
  return generated;
}
// Only encrypted GPS and mutation intents enter SQLite. Session tokens never do.
// The device-only key permits locked-screen capture after the first device unlock.
export const captureStore: CaptureStore = {
  async read() {
    const row = await (
      await db()
    ).getFirstAsync<{ ciphertext: string }>(
      'SELECT ciphertext FROM capture WHERE id = 1',
    );
    if (!row) return null;
    const encryptionKey = await key(false);
    if (!encryptionKey) {
      await (await db()).runAsync('DELETE FROM capture');
      return null;
    }
    const bytes = await aesDecryptAsync(
      AESSealedData.fromCombined(row.ciphertext),
      encryptionKey,
    );
    return captureSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
  },
  async write(value) {
    if (!value) {
      await (await db()).runAsync('DELETE FROM capture');
      await SecureStore.deleteItemAsync(keyName, keyOptions);
      return;
    }
    const encryptionKey = await key(true);
    if (!encryptionKey) throw new Error('Journey encryption is unavailable.');
    const sealed = await aesEncryptAsync(
      new TextEncoder().encode(JSON.stringify(captureSchema.parse(value))),
      encryptionKey,
    );
    await (
      await db()
    ).runAsync(
      'INSERT INTO capture (id, ciphertext) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET ciphertext = excluded.ciphertext',
      await sealed.combined('base64'),
    );
  },
};
