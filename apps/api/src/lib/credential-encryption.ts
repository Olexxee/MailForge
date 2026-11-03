import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

type Keyring = { activeVersion: number; keys: Map<number, Buffer> };

const readKeyring = (): Keyring => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(process.env.CREDENTIAL_ENCRYPTION_KEYS_JSON ?? '{}');
  } catch {
    throw new Error('CREDENTIAL_ENCRYPTION_CONFIGURATION_INVALID');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('CREDENTIAL_ENCRYPTION_CONFIGURATION_INVALID');
  }
  const keys = new Map<number, Buffer>();
  for (const [versionText, value] of Object.entries(parsed)) {
    const version = Number(versionText);
    if (!Number.isSafeInteger(version) || version < 1 || typeof value !== 'string') {
      throw new Error('CREDENTIAL_ENCRYPTION_CONFIGURATION_INVALID');
    }
    const key = Buffer.from(value, 'base64');
    if (key.length !== KEY_LENGTH || key.toString('base64') !== value) {
      throw new Error('CREDENTIAL_ENCRYPTION_CONFIGURATION_INVALID');
    }
    keys.set(version, key);
  }
  const activeVersion = Number(process.env.CREDENTIAL_ENCRYPTION_ACTIVE_KEY_VERSION ?? '1');
  if (!Number.isSafeInteger(activeVersion) || !keys.has(activeVersion)) {
    throw new Error('CREDENTIAL_ENCRYPTION_CONFIGURATION_INVALID');
  }
  return { activeVersion, keys };
};

export interface EncryptedCredential {
  ciphertext: string;
  keyVersion: number;
}

export const encryptCredential = (plaintext: string): EncryptedCredential => {
  const keyring = readKeyring();
  const key = keyring.keys.get(keyring.activeVersion);
  if (!key) throw new Error('CREDENTIAL_ENCRYPTION_CONFIGURATION_INVALID');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    keyVersion: keyring.activeVersion,
    ciphertext: ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.'),
  };
};

export const decryptCredential = (ciphertext: string, keyVersion: number): string => {
  try {
    const key = readKeyring().keys.get(keyVersion);
    if (!key) throw new Error('missing key version');
    const [format, ivText, tagText, dataText, extra] = ciphertext.split('.');
    if (format !== 'v1' || !ivText || !tagText || !dataText || extra !== undefined) {
      throw new Error('invalid encrypted payload');
    }
    const iv = Buffer.from(ivText, 'base64url');
    const tag = Buffer.from(tagText, 'base64url');
    const data = Buffer.from(dataText, 'base64url');
    if (iv.length !== IV_LENGTH || tag.length !== 16 || data.length === 0) {
      throw new Error('invalid encrypted payload');
    }
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('CREDENTIAL_DECRYPTION_FAILED');
  }
};
