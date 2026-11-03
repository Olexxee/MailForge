import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const deriveKey = (
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number; maxmem: number },
): Promise<Buffer> => new Promise((resolve, reject) => {
  scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
    if (error) reject(error);
    else resolve(derivedKey);
  });
});

export const createOpaqueToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16);
  const derived = await deriveKey(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return `scrypt$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt.toString('base64url')}$${derived.toString('base64url')}`;
};

export const verifyPassword = async (password: string, encoded: string): Promise<boolean> => {
  const [algorithm, n, r, p, saltValue, hashValue] = encoded.split('$');
  if (algorithm !== 'scrypt' || n !== String(1 << 15) || r !== '8' || p !== '1' || !saltValue || !hashValue) return false;
  const salt = Buffer.from(saltValue, 'base64url');
  const expected = Buffer.from(hashValue, 'base64url');
  if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
  const derived = await deriveKey(password, salt, expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
  });
  return timingSafeEqual(derived, expected);
};

export const safeEqual = (left: string, right: string): boolean => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};
