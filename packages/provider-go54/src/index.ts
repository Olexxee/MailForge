import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import {
  type MailProvider,
  type ProviderAttachmentSummary,
  type ProviderCapability,
  type ProviderFolder,
  type ProviderHealth,
  type ProviderMessageDetail,
  type ProviderMessagePage,
  type ProviderMessageSummary,
} from '@mailforge/provider-core';

export const GO54_PROVIDER_ID = 'go54' as const;

export interface Go54Credentials {
  email: string;
  password: string;
}

export interface Go54HealthChecks {
  checkImap: () => Promise<void>;
  checkSmtp: () => Promise<void>;
}

interface Go54ImapConfig {
  host: string;
  port: 993 | 143;
}

interface Go54SmtpConfig {
  host: string;
  port: 465 | 587;
}

interface ImapAddress {
  name?: string | null | undefined;
  address?: string | null | undefined;
}

interface MimeNode {
  part?: string;
  type?: string;
  subtype?: string;
  disposition?: string | { type?: string };
  parameters?: Record<string, string>;
  dispositionParameters?: Record<string, string>;
  size?: number;
  childNodes?: MimeNode[];
}

interface PageCursor {
  uidValidity: string;
  beforeUid: number;
}

interface MessageIdentifier {
  uidValidity: string;
  uid: number;
}

const MAX_PAGE_SIZE = 50;
const UID_SCAN_WINDOW = 10_000;
const MAX_BODY_PART_BYTES = 256 * 1024;

const codedError = (code: string): Error & { code: string } =>
  Object.assign(new Error(code), { code });

const validateHostname = (host: string, errorCode: string): string => {
  const value = host.trim();
  const pattern = /^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/;
  if (!pattern.test(value)) throw codedError(errorCode);
  return value;
};

const readImapConfig = (): Go54ImapConfig => {
  const hostValue = process.env.GO54_IMAP_HOST;
  if (!hostValue?.trim()) throw codedError('GO54_IMAP_HOST_NOT_CONFIGURED');
  const port = Number(process.env.GO54_IMAP_PORT ?? '993');
  if (port !== 993 && port !== 143) throw codedError('GO54_IMAP_PORT_UNSUPPORTED');
  return { host: validateHostname(hostValue, 'GO54_IMAP_HOST_INVALID'), port };
};

const readSmtpConfig = (): Go54SmtpConfig => {
  const hostValue = process.env.GO54_SMTP_HOST;
  if (!hostValue?.trim()) throw codedError('GO54_SMTP_HOST_NOT_CONFIGURED');
  const port = Number(process.env.GO54_SMTP_PORT ?? '465');
  if (port !== 465 && port !== 587) throw codedError('GO54_SMTP_PORT_UNSUPPORTED');
  return { host: validateHostname(hostValue, 'GO54_SMTP_HOST_INVALID'), port };
};

const safeErrorCode = (error: unknown): string => {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && /^[A-Z0-9_]{1,40}$/.test(code)) return code;
  }
  return 'PROVIDER_CONNECTION_FAILED';
};

const createImapClient = (credentials: Go54Credentials) => {
  const config = readImapConfig();
  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.port === 993,
    ...(config.port === 143 ? { doSTARTTLS: true } : {}),
    auth: { user: credentials.email, pass: credentials.password },
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    logger: false,
    connectionTimeout: 10_000,
    socketTimeout: 20_000,
  });
};

const withImapClient = async <T>(
  credentials: Go54Credentials,
  operation: (client: ImapFlow) => Promise<T>,
): Promise<T> => {
  const client = createImapClient(credentials);
  let connected = false;
  try {
    await client.connect();
    connected = true;
    return await operation(client);
  } finally {
    if (connected) await client.logout().catch(() => undefined);
    else client.close();
  }
};

const checkImap = async (credentials: Go54Credentials): Promise<void> => {
  await withImapClient(credentials, async (client) => {
    await client.list();
  });
};

const checkSmtp = async (credentials: Go54Credentials): Promise<void> => {
  const config = readSmtpConfig();
  const implicitTls = config.port === 465;
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: implicitTls,
    ...(!implicitTls ? { requireTLS: true } : {}),
    auth: { user: credentials.email, pass: credentials.password },
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
    logger: false,
    debug: false,
  });
  try {
    await transporter.verify();
  } finally {
    transporter.close();
  }
};

const encodeCursor = (cursor: PageCursor): string =>
  Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');

const decodeCursor = (value: string): PageCursor => {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('uidValidity' in parsed) ||
      typeof parsed.uidValidity !== 'string' ||
      !('beforeUid' in parsed) ||
      typeof parsed.beforeUid !== 'number' ||
      !Number.isSafeInteger(parsed.beforeUid) ||
      parsed.beforeUid < 1
    ) throw new Error('invalid cursor');
    return { uidValidity: parsed.uidValidity, beforeUid: parsed.beforeUid };
  } catch {
    throw codedError('MESSAGE_CURSOR_INVALID');
  }
};

const encodeMessageId = (identifier: MessageIdentifier): string =>
  Buffer.from(JSON.stringify(identifier), 'utf8').toString('base64url');

const decodeMessageId = (value: string): MessageIdentifier => {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('uidValidity' in parsed) ||
      typeof parsed.uidValidity !== 'string' ||
      !('uid' in parsed) ||
      typeof parsed.uid !== 'number' ||
      !Number.isSafeInteger(parsed.uid) ||
      parsed.uid < 1
    ) throw new Error('invalid message id');
    return { uidValidity: parsed.uidValidity, uid: parsed.uid };
  } catch {
    throw codedError('MAIL_MESSAGE_IDENTIFIER_INVALID');
  }
};

const addressList = (addresses: ImapAddress[] | undefined): string[] =>
  (addresses ?? [])
    .map((item) => item.address?.trim() || item.name?.trim() || '')
    .filter(Boolean)
    .slice(0, 50);

const displayAddress = (addresses: ImapAddress[] | undefined): string =>
  addressList(addresses).join(', ') || 'Unknown sender';

const getDate = (value: Date | string | undefined, fallback?: Date | string): Date => {
  const date = value ?? fallback;
  if (!date) return new Date(0);
  const parsed = date instanceof Date ? date : new Date(date);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
};

const isAttachment = (node: MimeNode): boolean => {
  const disposition = typeof node.disposition === 'string'
    ? node.disposition
    : node.disposition?.type ?? '';
  return disposition.toLowerCase() === 'attachment' ||
    Boolean(node.dispositionParameters?.filename || node.parameters?.name);
};

const walkMime = (node: MimeNode | undefined, result: {
  plain: string[];
  html: string[];
  attachments: ProviderAttachmentSummary[];
}): void => {
  if (!node) return;
  if (node.childNodes?.length) {
    for (const child of node.childNodes) walkMime(child, result);
    return;
  }
  const contentType = (node.type ?? '').toLowerCase();
  const subtype = (node.subtype ?? '').toLowerCase();
  const part = node.part;
  if (isAttachment(node)) {
    if (part) {
      result.attachments.push({
        partId: part,
        filename: node.dispositionParameters?.filename ?? node.parameters?.name ?? 'attachment',
        contentType: contentType && subtype ? contentType + '/' + subtype : 'application/octet-stream',
        size: Math.max(0, node.size ?? 0),
      });
    }
    return;
  }
  if (!part || contentType !== 'text') return;
  if (subtype === 'plain') result.plain.push(part);
  if (subtype === 'html') result.html.push(part);
};

const readBodyPart = async (
  client: ImapFlow,
  uid: number,
  part: string,
): Promise<{ value: string; truncated: boolean }> => {
  const download = await client.download(uid, part, {
    uid: true,
    maxBytes: MAX_BODY_PART_BYTES,
    chunkSize: 32 * 1024,
  });
  if (!download.content) return { value: '', truncated: false };
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of download.content) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    chunks.push(buffer);
  }
  return {
    value: Buffer.concat(chunks).toString('utf8'),
    truncated: total >= MAX_BODY_PART_BYTES,
  };
};

const toSummary = (
  message: {
    uid: number;
    envelope?: {
      subject?: string | null | undefined;
      from?: ImapAddress[] | undefined;
      to?: ImapAddress[] | undefined;
      date?: Date | string | undefined;
    } | undefined;
    flags?: Set<string> | undefined;
    internalDate?: Date | string | undefined;
    size?: number | undefined;
  },
  folderId: string,
  uidValidity: string,
): ProviderMessageSummary => ({
  id: encodeMessageId({ uidValidity, uid: message.uid }),
  folderId,
  subject: message.envelope?.subject?.trim() || '(no subject)',
  from: displayAddress(message.envelope?.from),
  to: addressList(message.envelope?.to),
  receivedAt: getDate(message.internalDate, message.envelope?.date),
  unread: !message.flags?.has('\\Seen'),
  flagged: message.flags?.has('\\Flagged') ?? false,
  size: Math.max(0, message.size ?? 0),
});

export class Go54Provider implements MailProvider {
  readonly providerId = GO54_PROVIDER_ID;
  private readonly credentials: Go54Credentials;
  private readonly healthChecks: Go54HealthChecks;

  constructor(credentials: Go54Credentials, healthChecks?: Go54HealthChecks) {
    this.credentials = credentials;
    this.healthChecks = healthChecks ?? {
      checkImap: () => checkImap(credentials),
      checkSmtp: () => checkSmtp(credentials),
    };
  }

  capabilities(): ReadonlySet<ProviderCapability> {
    return new Set<ProviderCapability>(['listFolders', 'listMessages', 'readMessage']);
  }

  async checkHealth(): Promise<ProviderHealth> {
    const [imap, smtp] = await Promise.allSettled([
      this.healthChecks.checkImap(),
      this.healthChecks.checkSmtp(),
    ]);
    return {
      imap: imap.status === 'fulfilled' ? 'available' : 'unavailable',
      smtp: smtp.status === 'fulfilled' ? 'available' : 'unavailable',
      checkedAt: new Date(),
      ...(imap.status === 'rejected' ? { imapErrorCode: safeErrorCode(imap.reason) } : {}),
      ...(smtp.status === 'rejected' ? { smtpErrorCode: safeErrorCode(smtp.reason) } : {}),
    };
  }

  async listFolders(): Promise<ProviderFolder[]> {
    return withImapClient(this.credentials, async (client) => {
      const folders = await client.list();
      return folders
        .filter((folder) => typeof folder.path === 'string' && folder.path.length > 0)
        .slice(0, 500)
        .map((folder) => ({
          id: folder.path,
          name: folder.name || folder.path,
          ...(folder.specialUse ? { specialUse: folder.specialUse } : {}),
        }));
    });
  }

  async listMessages(
    folderId: string,
    options: { limit: number; cursor?: string },
  ): Promise<ProviderMessagePage> {
    if (!folderId || folderId.length > 500) throw codedError('MAIL_FOLDER_INVALID');
    const limit = Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(options.limit)));
    return withImapClient(this.credentials, async (client) => {
      const lock = await client.getMailboxLock(folderId, { readOnly: true });
      try {
        const mailbox = client.mailbox;
        if (!mailbox) throw codedError('MAILBOX_NOT_SELECTED');
        const uidValidity = String(mailbox.uidValidity ?? '');
        if (!uidValidity) throw codedError('MAILBOX_UIDVALIDITY_UNAVAILABLE');
        const cursor = options.cursor ? decodeCursor(options.cursor) : undefined;
        if (cursor && cursor.uidValidity !== uidValidity) throw codedError('MAILBOX_UIDVALIDITY_CHANGED');

        const beforeUid = cursor?.beforeUid ?? Math.max(0, Number(mailbox.uidNext ?? 1) - 1);
        if (beforeUid < 1) return { messages: [], nextCursor: null, uidValidity };

        const minUid = Math.max(1, beforeUid - UID_SCAN_WINDOW + 1);
        const uids = await client.search({ uid: minUid + ':' + beforeUid }, { uid: true });
        if (uids === false || uids === undefined) throw codedError('IMAP_SEARCH_FAILED');
        const pageUids = uids.slice(-limit).reverse();
        const fetched = pageUids.length
          ? await client.fetchAll(pageUids, { envelope: true, flags: true, internalDate: true, size: true }, { uid: true })
          : [];
        const messages = fetched
          .sort((a, b) => b.uid - a.uid)
          .map((message) => toSummary(message, folderId, uidValidity));
        const nextBeforeUid = uids.length > limit
          ? (pageUids[pageUids.length - 1] ?? 1) - 1
          : minUid - 1;
        return {
          messages,
          nextCursor: nextBeforeUid >= 1 ? encodeCursor({ uidValidity, beforeUid: nextBeforeUid }) : null,
          uidValidity,
        };
      } finally {
        lock.release();
      }
    });
  }

  async getMessage(folderId: string, messageId: string): Promise<ProviderMessageDetail | null> {
    if (!folderId || folderId.length > 500 || !messageId || messageId.length > 512) {
      throw codedError('MAIL_MESSAGE_IDENTIFIER_INVALID');
    }
    const identifier = decodeMessageId(messageId);
    return withImapClient(this.credentials, async (client) => {
      const lock = await client.getMailboxLock(folderId, { readOnly: true });
      try {
        const mailbox = client.mailbox;
        if (!mailbox) throw codedError('MAILBOX_NOT_SELECTED');
        const uidValidity = String(mailbox.uidValidity ?? '');
        if (!uidValidity || uidValidity !== identifier.uidValidity) throw codedError('MAILBOX_UIDVALIDITY_CHANGED');
        const message = await client.fetchOne(identifier.uid, {
          envelope: true,
          flags: true,
          internalDate: true,
          size: true,
          bodyStructure: true,
        }, { uid: true });
        if (!message) return null;
        const summary = toSummary(message, folderId, uidValidity);
        const mime = { plain: [] as string[], html: [] as string[], attachments: [] as ProviderAttachmentSummary[] };
        walkMime(message.bodyStructure as MimeNode | undefined, mime);
        const plainParts = await Promise.all(mime.plain.slice(0, 2).map((part) => readBodyPart(client, identifier.uid, part)));
        const htmlParts = await Promise.all(mime.html.slice(0, 2).map((part) => readBodyPart(client, identifier.uid, part)));
        return {
          ...summary,
          cc: addressList(message.envelope?.cc),
          text: plainParts.map((part) => part.value).join('\n').slice(0, MAX_BODY_PART_BYTES),
          html: htmlParts.map((part) => part.value).join('\n').slice(0, MAX_BODY_PART_BYTES) || null,
          bodyTruncated: [...plainParts, ...htmlParts].some((part) => part.truncated),
          attachments: mime.attachments.slice(0, 50),
        };
      } finally {
        lock.release();
      }
    });
  }
}
