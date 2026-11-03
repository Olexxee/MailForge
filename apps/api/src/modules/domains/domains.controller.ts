import type { Request, Response } from 'express';
import { addOrganisationDomain, getOrganisationDomains, rotateOrganisationDomainChallenge, verifyOrganisationDomain } from './domains.service.js';

export const listDomains = async (req: Request, res: Response) => {
  const auth = res.locals.auth as { userId: string };
  const domains = await getOrganisationDomains(req.params.organisationId as string, auth.userId);
  res.json({ success: true, data: { domains }, requestId: res.locals.requestId });
};

export const createDomain = async (req: Request, res: Response) => {
  const auth = res.locals.auth as { userId: string };
  const result = await addOrganisationDomain({
    organisationId: req.params.organisationId as string,
    actorId: auth.userId,
    domain: (req.body as { domain: string }).domain,
  });
  res.status(201).json({ success: true, data: result, requestId: res.locals.requestId });
};

export const verifyDomain = async (req: Request, res: Response) => {
  const auth = res.locals.auth as { userId: string };
  const domain = await verifyOrganisationDomain({
    organisationId: req.params.organisationId as string,
    actorId: auth.userId,
    domainId: req.params.domainId as string,
  });
  res.json({ success: true, data: { domain }, requestId: res.locals.requestId });
};

export const rotateDomainChallenge = async (req: Request, res: Response) => {
  const auth = res.locals.auth as { userId: string };
  const result = await rotateOrganisationDomainChallenge({
    organisationId: req.params.organisationId as string,
    actorId: auth.userId,
    domainId: req.params.domainId as string,
  });
  res.json({ success: true, data: result, requestId: res.locals.requestId });
};
