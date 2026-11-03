import { AppError } from '../../app.js';
import { createOpaqueToken, hashToken, verifyPassword } from '../../lib/crypto.js';
import { createSession, findActiveSession, findUserByEmail, findUserById, revokeSession, rotateSession } from './auth.db.js';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const authenticateCredentials = async (email: string, password: string) => {
  const user = await findUserByEmail(email);
  // Run a password hash for unknown users as well, reducing account-enumeration timing differences.
  const dummyHash = `scrypt$32768$8$1${Buffer.from('0123456789abcdef').toString('base64url')}${Buffer.alloc(64).toString('base64url')}`;
  const valid = await verifyPassword(password, user?.passwordHash ?? dummyHash);
  if (!user || !valid || !user.isActive) throw new AppError('INVALID_CREDENTIALS', 401, 'Email or password is incorrect');
  return user;
};

export const issueSession = async (userId: string) => {
  const sessionToken = createOpaqueToken();
  const csrfToken = createOpaqueToken(24);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await createSession({
    userId,
    tokenHash: hashToken(sessionToken),
    csrfTokenHash: hashToken(csrfToken),
    expiresAt,
  });
  return { sessionToken, csrfToken, expiresAt };
};

export const getSession = (token: string) => findActiveSession(hashToken(token));

export const rotateUserSession = async (sessionId: string, userId: string) => {
  const sessionToken = createOpaqueToken();
  const csrfToken = createOpaqueToken(24);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const session = await rotateSession({
    oldSessionId: sessionId,
    userId,
    tokenHash: hashToken(sessionToken),
    csrfTokenHash: hashToken(csrfToken),
    expiresAt,
  });
  if (!session) throw new AppError('SESSION_EXPIRED', 401, 'Session is no longer valid');
  return { sessionToken, csrfToken, expiresAt };
};

export const revokeUserSession = (sessionId: string) => revokeSession(sessionId);

export const getCurrentUser = async (userId: string) => {
  const user = await findUserById(userId);
  if (!user || !user.isActive) throw new AppError('UNAUTHENTICATED', 401, 'Authentication required');
  return user;
};

export const registerInvitedUser = async (input: {
  email: string; displayName: string; password: string; invitationId: string;
}) => hashPassword(input.password);
