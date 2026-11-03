import { Router } from 'express';
import { asyncWrapper, createRateLimiter, validateBody } from '../../lib/http.js';
import { requireAuth, requireCsrf } from '../auth/auth.middleware.js';
import {
  createMailbox,
  createMailboxAccess,
  deleteMailboxAccess,
  listMailboxAccess,
  listMailboxes,
} from './mailboxes.controller.js';
import { connectGo54MailboxSchema, grantMailboxAccessSchema } from './mailboxes.validator.js';

export const mailboxesRouter = Router();
mailboxesRouter.use(requireAuth);
mailboxesRouter.get('/organisations/:organisationId/mailboxes', asyncWrapper(listMailboxes));
mailboxesRouter.post(
  '/organisations/:organisationId/mailboxes',
  requireCsrf,
  createRateLimiter(5),
  validateBody(connectGo54MailboxSchema),
  asyncWrapper(createMailbox),
);
mailboxesRouter.get(
  '/organisations/:organisationId/mailboxes/:mailboxId/access',
  asyncWrapper(listMailboxAccess),
);
mailboxesRouter.post(
  '/organisations/:organisationId/mailboxes/:mailboxId/access',
  requireCsrf,
  validateBody(grantMailboxAccessSchema),
  asyncWrapper(createMailboxAccess),
);
mailboxesRouter.delete(
  '/organisations/:organisationId/mailboxes/:mailboxId/access/:userId',
  requireCsrf,
  asyncWrapper(deleteMailboxAccess),
);
