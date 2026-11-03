import { Router } from 'express';
import { asyncWrapper, createRateLimiter, validateBody } from '../../lib/http.js';
import { login, logout, me, refresh, renewCsrf } from './auth.controller.js';
import { requireAuth, requireCsrf, requireTrustedOrigin } from './auth.middleware.js';
import { loginSchema } from './auth.validator.js';

export const authRouter = Router();
authRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
authRouter.post('/login', requireTrustedOrigin, createRateLimiter(5), validateBody(loginSchema), asyncWrapper(login));
authRouter.get('/csrf', requireAuth, asyncWrapper(renewCsrf));\nauthRouter.get('/me', requireAuth, asyncWrapper(me));
authRouter.post('/logout', requireAuth, requireCsrf, asyncWrapper(logout));
authRouter.post('/refresh', requireAuth, requireCsrf, asyncWrapper(refresh));
