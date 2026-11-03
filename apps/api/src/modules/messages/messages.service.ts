import sanitizeHtml from 'sanitize-html';
import { Go54Provider } from '@mailforge/provider-go54';
import { AppError } from '../../lib/http.js';
import { decryptCredential } from '../../lib/credential-encryption.js';
import { assertMailboxPermission } from '../mailboxes/mailboxes.service.js';
import { findMailboxProviderForRead } from './messages.db.js';

const safeHtmlOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    'a', 'b', 'blockquote', 'br', 'code', 'div', 'em', 'h1', 'h2', 'h3',
    'hr', 'i', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'table', 'tbody',
    'td', 'th', 'thead', 'tr', 'u', 'ul',
  ],
  allowedAttributes: {
    a: ['href', 'title'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
};

export const sanitizeMessageHtml = (html: string): string => sanitizeHtml(html, safeHtmlOptions);

const providerError = (error: unknown): never => {
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code: unknown }).code)
    : '';
  if (code === 'MAILBOX_UIDVALIDITY_CHANGED') {
    throw new AppError('MAILBOX_CHANGED', 409, 'This folder changed on the mail server. Refresh the folder and try again');
  }
  if (code === 'MESSAGE_CURSOR_INVALID') {
    throw new AppError('MESSAGE_CURSOR_INVALID', 400, 'The message page cursor is invalid. Refresh the folder');
  }
  if (code === 'MAIL_FOLDER_INVALID' || code === 'MAIL_MESSAGE_IDENTIFIER_INVALID') {
    throw new AppError('MAIL_RESOURCE_INVALID', 400, 'The requested mail resource is invalid');
  }
  throw new AppError('MAIL_PROVIDER_UNAVAILABLE', 502, 'The mail provider could not complete this request. Try again later');
};

const getProvider = async (organisationId: string, mailboxId: string, actorId: string) => {
  await assertMailboxPermission(organisationId, mailboxId, actorId, 'READ');
  const mailbox = await findMailboxProviderForRead(organisationId, mailboxId);
  if (!mailbox) throw new AppError('MAILBOX_NOT_FOUND', 404, 'Mailbox was not found');
  if (mailbox.providerConnection.providerType !== 'GO54') {
    throw new AppError('PROVIDER_UNSUPPORTED', 501, 'This mailbox provider is not supported for inbox reading');
  }

  let credentials: { password: string };
  try {
    const plaintext = decryptCredential(
      mailbox.providerConnection.encryptedCredentials,
      mailbox.providerConnection.credentialKeyVersion,
      organisationId + ':' + mailbox.providerConnection.accountEmail,
    );
    const parsed: unknown = JSON.parse(plaintext);
    if (!parsed || typeof parsed !== 'object' || !('password' in parsed) || typeof parsed.password !== 'string') {
      throw new Error('invalid credential payload');
    }
    credentials = { password: parsed.password };
  } catch {
    throw new AppError('CREDENTIAL_DECRYPTION_FAILED', 503, 'Stored provider credentials cannot be decrypted. Check the configured credential keyring');
  }

  return new Go54Provider({
    email: mailbox.providerConnection.accountEmail,
    password: credentials.password,
  });
};

export const getMailboxFolders = async (input: {
  organisationId: string;
  mailboxId: string;
  actorId: string;
}) => {
  const provider = await getProvider(input.organisationId, input.mailboxId, input.actorId);
  try {
    const folders = await provider.listFolders();
    return folders.map((folder) => ({
      id: Buffer.from(folder.id, 'utf8').toString('base64url'),
      name: folder.name,
      specialUse: folder.specialUse ?? null,
    }));
  } catch (error) {
    providerError(error);
  }
};

const decodeFolderId = (value: string): string => {
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    if (!decoded || decoded.length > 500 || Buffer.from(decoded, 'utf8').toString('base64url') !== value) {
      throw new Error('invalid folder id');
    }
    return decoded;
  } catch {
    throw new AppError('MAIL_FOLDER_INVALID', 400, 'The requested folder is invalid');
  }
};

export const getMailboxMessages = async (input: {
  organisationId: string;
  mailboxId: string;
  actorId: string;
  folderId: string;
  limit: number;
  cursor?: string;
}) => {
  const provider = await getProvider(input.organisationId, input.mailboxId, input.actorId);
  const folderId = decodeFolderId(input.folderId);
  try {
    const page = await provider.listMessages(folderId, {
      limit: input.limit,
      ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
    });
    return {
      messages: page.messages,
      nextCursor: page.nextCursor,
    };
  } catch (error) {
    providerError(error);
  }
};

export const getMailboxMessage = async (input: {
  organisationId: string;
  mailboxId: string;
  actorId: string;
  folderId: string;
  messageId: string;
}) => {
  const provider = await getProvider(input.organisationId, input.mailboxId, input.actorId);
  const folderId = decodeFolderId(input.folderId);
  try {
    const message = await provider.getMessage(folderId, input.messageId);
    if (!message) throw new AppError('MESSAGE_NOT_FOUND', 404, 'Message was not found in this folder');
    return {
      ...message,
      html: message.html === null ? null : sanitizeMessageHtml(message.html),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    providerError(error);
  }
};
