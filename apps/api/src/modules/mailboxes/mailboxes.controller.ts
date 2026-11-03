import type { Request, Response } from 'express';
import {
  connectGo54Mailbox,
  getMailboxAccess,
  getMailboxes,
  grantMailboxAccess,
  revokeMailboxAccess,
} from './mailboxes.service.js';

export const listMailboxes = async (req: Request, res: Response) => {
  const auth = res.locals.auth as { userId: string };
  const mailboxes = await getMailboxes(req.params.organisationId as string, auth.userId);
  res.json({ success: true, data: { mailboxes }, requestId: res.locals.requestId });
};

export const createMailbox = async (req: Request, res: Response) => {
  const auth = res.locals.auth as { userId: string };
  const body = req.body as { domainId: string; email: string; displayName?: string; password: string };
  const result = await connectGo54Mailbox({
    organisationId: req.params.organisationId as string,
    actorId: auth.userId,
    ...body,
  });
  res.status(201).json({ success: true, data: result, requestId: res.locals.requestId });
};

export const listMailboxAccess = async (req: Request, res: Response) => {
  const auth = res.locals.auth as { userId: string };
  const access = await getMailboxAccess({
    organisationId: req.params.organisationId as string,
    mailboxId: req.params.mailboxId as string,
    actorId: auth.userId,
  });
  res.json({ success: true, data: { access }, requestId: res.locals.requestId });
};

export const createMailboxAccess = async (req: Request, res: Response) => {
  const auth = res.locals.auth as { userId: string };
  const body = req.body as { userId: string; permission: 'READ' | 'SEND' | 'MANAGE' | 'ADMINISTER' };
  const access = await grantMailboxAccess({
    organisationId: req.params.organisationId as string,
    mailboxId: req.params.mailboxId as string,
    actorId: auth.userId,
    ...body,
  });
  res.status(201).json({ success: true, data: { access }, requestId: res.locals.requestId });
};

export const deleteMailboxAccess = async (req: Request, res: Response) => {
  const auth = res.locals.auth as { userId: string };
  const result = await revokeMailboxAccess({
    organisationId: req.params.organisationId as string,
    mailboxId: req.params.mailboxId as string,
    actorId: auth.userId,
    userId: req.params.userId as string,
  });
  res.json({ success: true, data: result, requestId: res.locals.requestId });
};
