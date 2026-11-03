import { afterEach, describe, expect, it } from 'vitest';
import { decryptCredential, encryptCredential } from './credential-encryption.js';

const previousKeys = process.env.CREDENTIAL_ENCRYPTION_KEYS_JSON;
const previousVersion = process.env.CREDENTIAL_ENCRYPTION_ACTIVE_KEY_VERSION;
const keyOne = Buffer.alloc(32, 1).toString('base64');
const keyTwo = Buffer.alloc(32, 2).toString('base64');

afterEach(() => {
  if (previousKeys === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEYS_JSON;
  else process.env.CREDENTIAL_ENCRYPTION_KEYS_JSON = previousKeys;
  if (previousVersion === undefined) delete process.env.CREDENTIAL_ENCRYPTION_ACTIVE_KEY_VERSION;
  else process.env.CREDENTIAL_ENCRYPTION_ACTIVE_KEY_VERSION = previousVersion;
});

describe('credential encryption', () => {
  it('encrypts credentials and decrypts them using their recorded key version', () => {
    process.env.CREDENTIAL_ENCRYPTION_KEYS_JSON = JSON.stringify({ 1: keyOne });
    process.env.CREDENTIAL_ENCRYPTION_ACTIVE_KEY_VERSION = '1';
    const first = encryptCredential('provider-password');
    expect(first.keyVersion).toBe(1);
    expect(first.ciphertext).not.toContain('provider-password');
    expect(decryptCredential(first.ciphertext, first.keyVersion)).toBe('provider-password');
  });

  it('supports decrypting old credentials after the active key rotates', () => {
    process.env.CREDENTIAL_ENCRYPTION_KEYS_JSON = JSON.stringify({ 1: keyOne, 2: keyTwo });
    process.env.CREDENTIAL_ENCRYPTION_ACTIVE_KEY_VERSION = '1';
    const oldCredential = encryptCredential('old-secret');
    process.env.CREDENTIAL_ENCRYPTION_ACTIVE_KEY_VERSION = '2';
    const newCredential = encryptCredential('new-secret');
    expect(oldCredential.keyVersion).toBe(1);
    expect(newCredential.keyVersion).toBe(2);
    expect(decryptCredential(oldCredential.ciphertext, 1)).toBe('old-secret');
    expect(decryptCredential(newCredential.ciphertext, 2)).toBe('new-secret');
  });

  it('rejects tampered ciphertext without leaking crypto details', () => {
    process.env.CREDENTIAL_ENCRYPTION_KEYS_JSON = JSON.stringify({ 1: keyOne });
    process.env.CREDENTIAL_ENCRYPTION_ACTIVE_KEY_VERSION = '1';
    const encrypted = encryptCredential('secret');
    expect(() => decryptCredential(encrypted.ciphertext.slice(0, -1) + 'x', 1))
      .toThrow('CREDENTIAL_DECRYPTION_FAILED');
  });
});
