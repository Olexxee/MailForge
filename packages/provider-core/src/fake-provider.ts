import type { MailProvider, ProviderHealth, ProviderMessageSummary } from './index.js';

export class FakeMailProvider implements MailProvider {
  readonly providerId = 'fake';
  private readonly messages: ProviderMessageSummary[] = [];

  capabilities() {
    return new Set(['listFolders', 'listMessages', 'readMessage'] as const);
  }

  async checkHealth(): Promise<ProviderHealth> {
    return { imap: 'available', smtp: 'not-configured', checkedAt: new Date() };
  }

  async listMessages(folderId: string, limit: number): Promise<ProviderMessageSummary[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new RangeError('limit must be an integer between 1 and 100');
    }
    return this.messages.filter((message) => message.folderId === folderId).slice(0, limit);
  }

  seed(messages: ProviderMessageSummary[]): void {
    this.messages.push(...messages);
  }
}
