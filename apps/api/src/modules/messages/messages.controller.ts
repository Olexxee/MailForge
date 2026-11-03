import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { NextFunction, Request, Response } from 'express';
import {
  downloadMailboxAttachment,
  getMailboxFolders,
  getMailboxMessage,
  getMailboxMessages,
  updateMailboxMessageReadState,
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
  const query = res.locals.validatedQuery as { limit: number; cursor?: string };
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
    messageId: req.params.messageId as string,
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, data: { message }, requestId: res.locals.requestId });
};

export const setMessageReadState = async (req: Request, res: Response) => {
  const auth = res.locals.auth as { userId: string };
  const body = req.body as { unread: boolean };
  const result = await updateMailboxMessageReadState({
    organisationId: req.params.organisationId as string,
    mailboxId: req.params.mailboxId as string,
    actorId: auth.userId,
    folderId: req.params.folderId as string,
    messageId: req.params.messageId as string,
    unread: body.unread,
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, data: result, requestId: res.locals.requestId });
};

const safeFilename = (value: string): string => {
  const filename = value.replace(/[\\u0000-\\u001f\\u007f/\\\\]/g, '_').slice(0, 180).trim();
  return filename || 'attachment';
};

const encodeFilename = (value: string): string =>
  encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    '%' + character.charCodeAt(0).toString(16).toUpperCase(),
  );

export const downloadAttachment = async (req: Request, res: Response, next: NextFunction) => {
  const auth = res.locals.auth as { userId: string };
  try {
    const attachment = await downloadMailboxAttachment({
      organisationId: req.params.organisationId as string,
      mailboxId: req.params.mailboxId as string,
      actorId: auth.userId,
      folderId: req.params.folderId as string,
      messageId: req.params.messageId as string,
      partId: req.params.partId as string,
    });
    const filename = encodeFilename(safeFilename(attachment.filename));
    res.status(200);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + filename);
    if (attachment.size > 0) res.setHeader('Content-Length', String(attachment.size));
    await pipeline(Readable.from(attachment.stream), res);
  } catch (error) {
    if (res.headersSent) {
      res.destroy(error instanceof Error ? error : undefined);
      return;
    }
    next(error);
  }
};
