import type { Response } from 'express';

const SESSION_COOKIE = 'mf_session';
const CSRF_COOKIE = 'mf_csrf';
const isProduction = () => process.env.NODE_ENV === 'production';

const sessionCookieOptions = (maxAge?: number) => [
  'Path=/api/v1',
  'HttpOnly',
  'SameSite=Lax',
  ...(isProduction() ? ['Secure'] : []),
  ...(maxAge === undefined ? [] : [`Max-Age=${Math.floor(maxAge / 1000)}`]),
].join('; ');

export const setSessionCookie = (res: Response, sessionToken: string, expiresAt: Date) => {
  const maxAge = Math.max(0, expiresAt.getTime() - Date.now());
  res.append('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(sessionToken)}; ${sessionCookieOptions(maxAge)}`);
};

export const setCsrfCookie = (res: Response, csrfToken: string, expiresAt: Date) => {
  const maxAge = Math.max(0, expiresAt.getTime() - Date.now());
  const secure = isProduction() ? 'Secure; ' : '';
  res.append('Set-Cookie', `${CSRF_COOKIE}=${encodeURIComponent(csrfToken)}; Path=/api/v1; SameSite=Lax; ${secure}Max-Age=${Math.floor(maxAge / 1000)}`);
};

export const setSessionCookies = (res: Response, sessionToken: string, csrfToken: string, expiresAt: Date) => {
  setSessionCookie(res, sessionToken, expiresAt);
  setCsrfCookie(res, csrfToken, expiresAt);
};

export const clearSessionCookies = (res: Response) => {
  res.append('Set-Cookie', `${SESSION_COOKIE}=; ${sessionCookieOptions(0)}`);
  const secure = isProduction() ? 'Secure; ' : '';
  res.append('Set-Cookie', `${CSRF_COOKIE}=; Path=/api/v1; SameSite=Lax; ${secure}Max-Age=0`);
};
