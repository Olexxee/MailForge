import { z } from 'zod';

export const mailboxMessagesParamsSchema = z.object({
  organisationId: z.string().cuid(),
  mailboxId: z.string().cuid(),
});

export const folderMessagesParamsSchema = mailboxMessagesParamsSchema.extend({
  folderId: z.string().min(1).max(700),
});

export const messageDetailParamsSchema = folderMessagesParamsSchema.extend({
  messageUid: z.string().regex(/^[1-9][0-9]{0,14}$/).transform(Number),
});

export const messagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(25),
  cursor: z.string().min(1).max(2048).optional(),
}).strict();
