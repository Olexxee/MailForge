import { Router } from 'express';
import { asyncWrapper, createRateLimiter, validateBody, validateParams } from '../../lib/http.js';
import { requireAuth, requireCsrf } from '../auth/auth.middleware.js';
import {
  createMailbox,
  createMailboxAccess,
  deleteMailboxAccess,
  listMailboxAccess,
  listMailboxes,
} from './mailboxes.controller.js';
import { connectGo54MailboxSchema, grantMailboxAccessSchema, mailboxAccessParamsSchema, mailboxParamsSchema, organisationMailboxParamsSchema } from './mailboxes.validator.js';

export const mailboxesRouter = Router();
mailboxesRouter.use(requireAuth);
mailboxesRouter.get('/organisations/:organisationId/mailboxes', validateParams(organisationMailboxParamsSchema), asyncWrapper(listMailboxes));
mailboxesRouter.post(
  '/organisations/:organisationId/mailboxes',
  requireCsrf,
  validateParams(organisationMailboxParamsSchema),
  createRateLimiter(5),
  validateBody(connectGo54MailboxSchema),
  asyncWrapper(createMailbox),
);
mailboxesRouter.get(
  '/organisations/:organisationId/mailboxes/:mailboxId/access',
  validateParams(mailboxParamsSchema),
  asyncWrapper(listMailboxAccess),
);
mailboxesRouter.post(
  '/organisations/:organisationId/mailboxes/:mailboxId/access',
  requireCsrf,
  validateParams(mailboxParamsSchema),
  validateBody(grantMailboxAccessSchema),
  asyncWrapper(createMailboxAccess),
);
mailboxesRouter.delete(
  '/organisations/:organisationId/mailboxes/:mailboxId/access/:userId',
  requireCsrf,
  validateParams(mailboxAccessParamsSchema),
  asyncWrapper(deleteMailboxAccess),
);
