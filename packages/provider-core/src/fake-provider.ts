import type {
  MailProvider,
  ProviderHealth,
  ProviderMessageDetail,
} from './index.js';

export class FakeMailProvider implements MailProvider {
  readonly providerId = 'fake';
  private readonly messages: ProviderMessageDetail[] = [];
  private readonly folders = [
    { id: 'inbox', name: 'Inbox', specialUse: '\\Inbox' },
    { id: 'sent', name: 'Sent', specialUse: '\\Sent' },
  ];

  capabilities() {
    return new Set(['listFolders', 'listMessages', 'readMessage'] as const);
  }

  async checkHealth(): Promise<ProviderHealth> {
    return { imap: 'available', smtp: 'not-configured', checkedAt: new Date() };
  }

  async listFolders() {
    return this.folders;
  }

  async listMessages(
    folderId: string,
    options: { limit: number; cursor?: string },
  ) {
    if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 50) {
      throw new RangeError('limit must be an integer between 1 and 50');
    }
    const offset = options.cursor ? Number(options.cursor) : 0;
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('MESSAGE_CURSOR_INVALID');
    const matching = this.messages
      .filter((message) => message.folderId === folderId)
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
    const page = matching.slice(offset, offset + options.limit);
    const nextOffset = offset + page.length;
    return {
      messages: page,
      nextCursor: nextOffset < matching.length ? String(nextOffset) : null,
      uidValidity: 'fake-uid-validity',
    };
  }

  async getMessage(folderId: string, messageId: string): Promise<ProviderMessageDetail | null> {
    return this.messages.find((message) => message.folderId === folderId && message.id === messageId) ?? null;
  }

  seed(messages: ProviderMessageDetail[]): void {
    this.messages.push(...messages);
  }
}
