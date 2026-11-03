import type { Request, Response } from 'express';
import { getCurrentUser, issueSession, renewCsrfToken, revokeUserSession, rotateUserSession, authenticateCredentials } from './auth.service.js';
import { clearSessionCookies, setCsrfCookie, setSessionCookies } from './auth.cookies.js';

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

export const renewCsrf = async (_req: Request, res: Response) => {
  const auth = res.locals.auth as { sessionId: string; expiresAt: Date };
  const csrfToken = await renewCsrfToken(auth.sessionId);
  setCsrfCookie(res, csrfToken, auth.expiresAt);
  res.json({ success: true, data: { csrfToken }, requestId: res.locals.requestId });
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
