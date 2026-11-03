import type { Request, Response } from 'express';
import { validateProviderConnection } from './provider-connections.service.js';

export const validateConnection = async (req: Request, res: Response) => {
  const auth = res.locals.auth as { userId: string };
  const result = await validateProviderConnection({
    organisationId: req.params.organisationId as string,
    connectionId: req.params.connectionId as string,
    actorId: auth.userId,
  });
  res.json({ success: true, data: result, requestId: res.locals.requestId });
};
