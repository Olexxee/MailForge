export type ProviderCapability =
  | 'listFolders'
  | 'listMessages'
  | 'readMessage'
  | 'sendMessage'
  | 'searchMessages'
  | 'mutateFlags'
  | 'manageFolders';

export type ProviderProtocolStatus = 'available' | 'unavailable' | 'not-configured';

export interface ProviderHealth {
  imap: ProviderProtocolStatus;
  smtp: ProviderProtocolStatus;
  checkedAt: Date;
  imapErrorCode?: string;
  smtpErrorCode?: string;
}

export interface ProviderFolder {
  id: string;
  name: string;
  specialUse?: string;
  messageCount?: number;
  unseenCount?: number;
}

export interface ProviderMessageSummary {
  id: string;
  folderId: string;
  subject: string;
  from: string;
  to: string[];
  receivedAt: Date;
  unread: boolean;
  flagged: boolean;
  size: number;
}

export interface ProviderMessagePage {
  messages: ProviderMessageSummary[];
  nextCursor: string | null;
  uidValidity: string;
}

export interface ProviderAttachmentSummary {
  partId: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface ProviderMessageDetail extends ProviderMessageSummary {
  cc: string[];
  text: string;
  html: string | null;
  bodyTruncated: boolean;
  attachments: ProviderAttachmentSummary[];
}

export interface ProviderAttachmentDownload {
  filename: string;
  contentType: string;
  size: number;
  stream: AsyncIterable<Uint8Array>;
}

export interface MailProvider {
  readonly providerId: string;
  capabilities(): ReadonlySet<ProviderCapability>;
  checkHealth(): Promise<ProviderHealth>;
  listFolders(): Promise<ProviderFolder[]>;
  listMessages(
    folderId: string,
    options: { limit: number; cursor?: string },
  ): Promise<ProviderMessagePage>;
  getMessage(folderId: string, messageId: string): Promise<ProviderMessageDetail | null>;
  downloadAttachment(
    folderId: string,
    messageId: string,
    partId: string,
    maxBytes: number,
  ): Promise<ProviderAttachmentDownload | null>;
  setMessageSeen(folderId: string, messageId: string, seen: boolean): Promise<void>;
}

export class ProviderCapabilityError extends Error {
  constructor(capability: ProviderCapability) {
    super('Provider does not support capability: ' + capability);
    this.name = 'ProviderCapabilityError';
  }
}
