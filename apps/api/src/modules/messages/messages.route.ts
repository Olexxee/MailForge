import { Router } from 'express';
import { asyncWrapper, validateBody, validateParams, validateQuery } from '../../lib/http.js';
import { requireAuth } from '../auth/auth.middleware.js';
import {
  downloadAttachment,
  getMessage,
  listFolders,
  listMessages,
  setMessageReadState,
} from './messages.controller.js';
import {
  folderMessagesParamsSchema,
  mailboxMessagesParamsSchema,
  attachmentParamsSchema,
  messageDetailParamsSchema,
  messageReadStateBodySchema,
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
  '/organisations/:organisationId/mailboxes/:mailboxId/folders/:folderId/messages/:messageId',
  validateParams(messageDetailParamsSchema),
  asyncWrapper(getMessage),
);

messagesRouter.patch(
  '/organisations/:organisationId/mailboxes/:mailboxId/folders/:folderId/messages/:messageId/read-state',
  validateParams(messageDetailParamsSchema),
  validateBody(messageReadStateBodySchema),
  asyncWrapper(setMessageReadState),
);
messagesRouter.get(
  '/organisations/:organisationId/mailboxes/:mailboxId/folders/:folderId/messages/:messageId/attachments/:partId',
  validateParams(attachmentParamsSchema),
  asyncWrapper(downloadAttachment),
);
