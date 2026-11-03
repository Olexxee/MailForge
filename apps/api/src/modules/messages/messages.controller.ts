import type { Request, Response } from 'express';
import {
  getMailboxFolders,
  getMailboxMessage,
  getMailboxMessages,
} from './messages.service.js';

export const listFolders = async (req: Request, res: Response) => {
  const auth = res.locals.auth as { userId: string };
  const folders = await getMailboxFolders({
    organisationId: req.params.organisationId as string,
    mailboxId: req.params.mailboxId as string,
    actorId: auth.userId,
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, data: { folders }, requestId: res.locals.requestId });
};

export const listMessages = async (req: Request, res: Response) => {
  const auth = res.locals.auth as { userId: string };
  const query = req.query as { limit: number; cursor?: string };
  const result = await getMailboxMessages({
    organisationId: req.params.organisationId as string,
    mailboxId: req.params.mailboxId as string,
    actorId: auth.userId,
    folderId: req.params.folderId as string,
    limit: query.limit,
    ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, data: result, requestId: res.locals.requestId });
};

export const getMessage = async (req: Request, res: Response) => {
  const auth = res.locals.auth as { userId: string };
  const message = await getMailboxMessage({
    organisationId: req.params.organisationId as string,
    mailboxId: req.params.mailboxId as string,
    actorId: auth.userId,
    folderId: req.params.folderId as string,
    messageUid: req.params.messageUid as unknown as number,
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, data: { message }, requestId: res.locals.requestId });
};
