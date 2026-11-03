import { z } from 'zod';

export const createInvitationSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  role: z.enum(['ADMIN', 'STAFF']).default('STAFF'),
}).strict();

export const acceptInvitationSchema = z.object({
  token: z.string().min(32).max(256),
  displayName: z.string().trim().min(1).max(100),
  password: z.string().min(12).max(256),
}).strict();
