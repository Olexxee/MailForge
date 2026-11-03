import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(256),
}).strict();

export const invitationAcceptanceSchema = z.object({
  token: z.string().min(32).max(256),
  displayName: z.string().trim().min(1).max(100),
  password: z.string().min(12).max(256),
}).strict();

export type LoginInput = z.infer<typeof loginSchema>;
export type InvitationAcceptanceInput = z.infer<typeof invitationAcceptanceSchema>;
