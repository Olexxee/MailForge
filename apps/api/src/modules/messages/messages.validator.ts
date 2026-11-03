import { z } from 'zod';

export const mailboxMessagesParamsSchema = z.object({
  organisationId: z.string().cuid(),
  mailboxId: z.string().cuid(),
});

export const folderMessagesParamsSchema = mailboxMessagesParamsSchema.extend({
  folderId: z.string().min(1).max(700),
});

export const messageDetailParamsSchema = folderMessagesParamsSchema.extend({
  messageId: z.string().min(1).max(512),
});

export const messagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(25),
  cursor: z.string().min(1).max(2048).optional(),
}).strict();

export const attachmentParamsSchema = messageDetailParamsSchema.extend({
  partId: z.string().regex(/^[0-9]+(?:\.[0-9]+)*$/).max(64),
});

export const messageReadStateBodySchema = z.object({
  unread: z.boolean(),
}).strict();
