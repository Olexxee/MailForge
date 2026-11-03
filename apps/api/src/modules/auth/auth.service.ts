import { AppError } from '../../lib/http.js';
import { createOpaqueToken, hashToken, verifyPassword } from '../../lib/crypto.js';
import { createSession, findActiveSession, findUserByEmail, findUserById, revokeSession, rotateSession, updateSessionCsrfHash } from './auth.db.js';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ABSOLUTE_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const authenticateCredentials = async (email: string, password: string) => {
  const user = await findUserByEmail(email);
  const dummyHash = [
    'scrypt', '32768', '8', '1',
    Buffer.from('0123456789abcdef').toString('base64url'),
    Buffer.alloc(64).toString('base64url'),
  ].join('$');
  const valid = await verifyPassword(password, user?.passwordHash ?? dummyHash);
  if (!user || !valid || !user.isActive) {
    throw new AppError('INVALID_CREDENTIALS', 401, 'Email or password is incorrect');
  }
  return user;
};

export const issueSession = async (userId: string) => {
  const sessionToken = createOpaqueToken();
  const csrfToken = createOpaqueToken(24);
  const absoluteExpiresAt = new Date(Date.now() + ABSOLUTE_SESSION_TTL_MS);
  const expiresAt = new Date(Math.min(Date.now() + SESSION_TTL_MS, absoluteExpiresAt.getTime()));
  await createSession({
    userId,
    tokenHash: hashToken(sessionToken),
    csrfTokenHash: hashToken(csrfToken),
    expiresAt,
    absoluteExpiresAt,
  });
  return { sessionToken, csrfToken, expiresAt, absoluteExpiresAt };
};

export const getSession = (token: string) => findActiveSession(hashToken(token));

export const rotateUserSession = async (sessionId: string, userId: string, absoluteExpiresAt: Date) => {
  if (absoluteExpiresAt <= new Date()) {
    throw new AppError('SESSION_EXPIRED', 401, 'Session is no longer valid');
  }
  const sessionToken = createOpaqueToken();
  const csrfToken = createOpaqueToken(24);
  const expiresAt = new Date(Math.min(Date.now() + SESSION_TTL_MS, absoluteExpiresAt.getTime()));
  const session = await rotateSession({
    oldSessionId: sessionId,
    userId,
    tokenHash: hashToken(sessionToken),
    csrfTokenHash: hashToken(csrfToken),
    expiresAt,
    absoluteExpiresAt,
  });
  if (!session) throw new AppError('SESSION_EXPIRED', 401, 'Session is no longer valid');
  return { sessionToken, csrfToken, expiresAt, absoluteExpiresAt };
};

export const revokeUserSession = (sessionId: string) => revokeSession(sessionId);

export const getCurrentUser = async (userId: string) => {
  const user = await findUserById(userId);
  if (!user || !user.isActive) throw new AppError('UNAUTHENTICATED', 401, 'Authentication required');
  return user;
};

export const renewCsrfToken = async (sessionId: string) => {
  const token = createOpaqueToken(24);
  const updated = await updateSessionCsrfHash(sessionId, hashToken(token));
  if (updated.count !== 1) throw new AppError('SESSION_EXPIRED', 401, 'Session is no longer valid');
  return token;
};
