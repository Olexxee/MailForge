import { z } from 'zod';

export const createOrganisationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(60),
}).strict();

export const updateMembershipSchema = z.object({
  role: z.enum(['ADMIN', 'STAFF']).optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => value.role !== undefined || value.isActive !== undefined, {
  message: 'At least one membership field must be supplied',
});
