import { z } from 'zod';

export const createDomainSchema = z.object({
  domain: z.string().trim().min(3).max(253),
}).strict();
