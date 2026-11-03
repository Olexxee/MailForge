import type { Request, Response } from 'express';
import { getCurrentUser, issueSession, revokeUserSession, rotateUserSession, authenticateCredentials } from './auth.service.js';

const SESSION_COOKIE = 'mf_session';
const CSRF_COOKIE = 'mf_csrf';
const isProduction = () => process.env.NODE_ENV === 'production';
const cookieOptions = (maxAge?: number) => [
  'Path=/api/v1',
  'HttpOnly',
  'SameSite=Lax',
  ...(isProduction() ? ['Secure'] : []),
  ...(maxAge === undefined ? [] : [`Max-Age=${Math.floor(maxAge / 1000)}`]),
].join('; ');

export const setSessionCookies = (res: Response, sessionToken: string, csrfToken: string, expiresAt: Date) => {
  const maxAge = expiresAt.getTime() - Date.now();
  res.append('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(sessionToken)}; ${cookieOptions(maxAge)}`);
  const csrfAttributes = isProduction() ? 'SameSite=Lax; Secure;' : 'SameSite=Lax;';
  res.append('Set-Cookie', `${CSRF_COOKIE}=${encodeURIComponent(csrfToken)}; Path=/api/v1; ${csrfAttributes} Max-Age=${Math.floor(maxAge / 1000)}`);
};

export const clearSessionCookies = (res: Response) => {
  res.append('Set-Cookie', `${SESSION_COOKIE}=; ${cookieOptions(0)}`);
  const csrfAttributes = isProduction() ? 'SameSite=Lax; Secure;' : 'SameSite=Lax;';
  res.append('Set-Cookie', `${CSRF_COOKIE}=; Path=/api/v1; ${csrfAttributes} Max-Age=0`);
};

const userPayload = (user: Awaited<ReturnType<typeof getCurrentUser>>) => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  memberships: user.memberships.filter((membership) => membership.isActive).map((membership) => ({
    organisationId: membership.organisationId,
    organisationName: membership.organisation.name,
    role: membership.role,
  })),
});

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  const user = await authenticateCredentials(email, password);
  const session = await issueSession(user.id);
  setSessionCookies(res, session.sessionToken, session.csrfToken, session.expiresAt);
  res.status(200).json({ success: true, data: { user: userPayload(user), csrfToken: session.csrfToken }, requestId: res.locals.requestId });
};

export const me = async (_req: Request, res: Response) => {
  const auth = res.locals.auth as { userId: string };
  const user = await getCurrentUser(auth.userId);
  res.json({ success: true, data: { user: userPayload(user) }, requestId: res.locals.requestId });
};

export const logout = async (_req: Request, res: Response) => {
  const auth = res.locals.auth as { sessionId: string };
  await revokeUserSession(auth.sessionId);
  clearSessionCookies(res);
  res.json({ success: true, data: { loggedOut: true }, requestId: res.locals.requestId });
};

export const refresh = async (_req: Request, res: Response) => {
  const auth = res.locals.auth as { sessionId: string; userId: string; absoluteExpiresAt: Date };
  const session = await rotateUserSession(auth.sessionId, auth.userId, auth.absoluteExpiresAt);
  setSessionCookies(res, session.sessionToken, session.csrfToken, session.expiresAt);
  const user = await getCurrentUser(auth.userId);
  res.json({ success: true, data: { user: userPayload(user), csrfToken: session.csrfToken }, requestId: res.locals.requestId });
};

