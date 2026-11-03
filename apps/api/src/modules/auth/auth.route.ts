import { Router } from 'express';
import { asyncWrapper, createRateLimiter, validateBody } from '../../app.js';
import { login, logout, me, refresh } from './auth.controller.js';
import { requireAuth, requireCsrf } from './auth.middleware.js';
import { loginSchema } from './auth.validator.js';

export const authRouter = Router();
authRouter.post('/login', createRateLimiter(5), validateBody(loginSchema), asyncWrapper(login));
authRouter.get('/me', requireAuth, asyncWrapper(me));
authRouter.post('/logout', requireAuth, requireCsrf, asyncWrapper(logout));
authRouter.post('/refresh', requireAuth, requireCsrf, asyncWrapper(refresh));
