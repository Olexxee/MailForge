import { z } from 'zod';

export const createDomainSchema = z.object({
  domain: z.string().trim().min(3).max(253),
}).strict();

export const organisationDomainParamsSchema = z.object({
  organisationId: z.string().cuid(),
});

export const domainParamsSchema = z.object({
  organisationId: z.string().cuid(),
  domainId: z.string().cuid(),
});
