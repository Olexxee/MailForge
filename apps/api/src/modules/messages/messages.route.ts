import { Router } from 'express';
import { asyncWrapper, validateParams, validateQuery } from '../../lib/http.js';
import { requireAuth } from '../auth/auth.middleware.js';
import {
  getMessage,
  listFolders,
  listMessages,
} from './messages.controller.js';
import {
  folderMessagesParamsSchema,
  mailboxMessagesParamsSchema,
  messageDetailParamsSchema,
  messagesQuerySchema,
} from './messages.validator.js';

export const messagesRouter = Router();
messagesRouter.use(requireAuth);
messagesRouter.get(
  '/organisations/:organisationId/mailboxes/:mailboxId/folders',
  validateParams(mailboxMessagesParamsSchema),
  asyncWrapper(listFolders),
);
messagesRouter.get(
  '/organisations/:organisationId/mailboxes/:mailboxId/folders/:folderId/messages',
  validateParams(folderMessagesParamsSchema),
  validateQuery(messagesQuerySchema),
  asyncWrapper(listMessages),
);
messagesRouter.get(
  '/organisations/:organisationId/mailboxes/:mailboxId/folders/:folderId/messages/:messageUid',
  validateParams(messageDetailParamsSchema),
  asyncWrapper(getMessage),
);
