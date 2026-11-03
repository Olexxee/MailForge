import { z } from 'zod';

export const validateProviderConnectionParamsSchema = z.object({
  organisationId: z.string().cuid(),
  connectionId: z.string().cuid(),
});
