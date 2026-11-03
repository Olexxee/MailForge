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
