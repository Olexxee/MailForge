import { z } from 'zod';

export const connectGo54MailboxSchema = z.object({
  domainId: z.string().cuid(),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  displayName: z.string().trim().max(100).optional(),
  password: z.string().min(1).max(1024),
}).strict();

export const grantMailboxAccessSchema = z.object({
  userId: z.string().cuid(),
  permission: z.enum(['READ', 'SEND', 'MANAGE', 'ADMINISTER']),
}).strict();

export const organisationMailboxParamsSchema = z.object({
  organisationId: z.string().cuid(),
});

export const mailboxParamsSchema = z.object({
  organisationId: z.string().cuid(),
  mailboxId: z.string().cuid(),
});

export const mailboxAccessParamsSchema = z.object({
  organisationId: z.string().cuid(),
  mailboxId: z.string().cuid(),
  userId: z.string().cuid(),
});
