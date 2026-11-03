import type { RequestHandler } from 'express';
import { AppError } from '../../app.js';
import { hashToken, safeEqual } from '../../lib/crypto.js';
import { getSession } from './auth.service.js';
import { readCookie } from './auth.controller.js';

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const token = readCookie(req.headers.cookie, 'mf_session');
    if (!token) throw new AppError('UNAUTHENTICATED', 401, 'Authentication required');
    const session = await getSession(token);
    if (!session) throw new AppError('UNAUTHENTICATED', 401, 'Authentication required');
    res.locals.auth = {
      userId: session.user.id,
      sessionId: session.id,
      csrfTokenHash: session.csrfTokenHash,
    };
    next();
  } catch (error) {
    next(error);
  }
};

export const requireCsrf: RequestHandler = (req, res, next) => {
  const auth = res.locals.auth as { csrfTokenHash: string } | undefined;
  const origin = req.header('origin');
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(process.env.WEB_ORIGIN ?? 'http://localhost:5173').origin) {
        next(new AppError('CSRF_INVALID', 403, 'CSRF validation failed'));
        return;
      }
    } catch {
      next(new AppError('CSRF_INVALID', 403, 'CSRF validation failed'));
      return;
    }
  }
  const cookieToken = readCookie(req.headers.cookie, 'mf_csrf');
  const headerToken = req.header('x-csrf-token');
  if (!auth || !cookieToken || !headerToken ||
      !safeEqual(cookieToken, headerToken) ||
      !safeEqual(hashToken(cookieToken), auth.csrfTokenHash)) {
    next(new AppError('CSRF_INVALID', 403, 'CSRF validation failed'));
    return;
  }
  next();
};
