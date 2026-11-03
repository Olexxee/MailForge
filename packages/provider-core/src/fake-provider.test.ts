import { describe, expect, it } from 'vitest';
import { FakeMailProvider } from './fake-provider.js';
import type { ProviderMessageDetail } from './index.js';

const message = (id: string, folderId: string, subject: string): ProviderMessageDetail => ({
  id,
  folderId,
  subject,
  from: 'sender@example.com',
  to: ['recipient@example.com'],
  receivedAt: new Date('2026-11-01T10:00:00.000Z'),
  unread: true,
  flagged: false,
  size: 120,
  cc: [],
  text: 'Message body',
  html: null,
  bodyTruncated: false,
  attachments: [],
});

describe('FakeMailProvider', () => {
  it('lists folders and filters messages by folder', async () => {
    const provider = new FakeMailProvider();
    provider.seed([
      message('1', 'inbox', 'A'),
      message('2', 'sent', 'B'),
    ]);

    await expect(provider.listFolders()).resolves.toHaveLength(2);
    await expect(provider.listMessages('inbox', { limit: 10 })).resolves.toMatchObject({
      messages: [{ id: '1' }],
      nextCursor: null,
    });
  });

  it('uses bounded cursor pagination and reads a folder-scoped message', async () => {
    const provider = new FakeMailProvider();
    provider.seed([
      message('1', 'inbox', 'A'),
      message('2', 'inbox', 'B'),
      message('3', 'inbox', 'C'),
    ]);

    const first = await provider.listMessages('inbox', { limit: 2 });
    expect(first.messages).toHaveLength(2);
    expect(first.nextCursor).toBe('2');
    const second = await provider.listMessages('inbox', { limit: 2, cursor: first.nextCursor ?? undefined });
    expect(second.messages).toHaveLength(1);
    await expect(provider.getMessage('inbox', '3')).resolves.toMatchObject({ subject: 'C' });
    await expect(provider.getMessage('sent', '3')).resolves.toBeNull();
    await provider.setMessageSeen('inbox', '3', true);
    await expect(provider.getMessage('inbox', '3')).resolves.toMatchObject({ unread: false });
    await expect(provider.downloadAttachment('inbox', '3', '1', 1024)).resolves.toBeNull();
  });

  it('rejects invalid page sizes and cursors', async () => {
    const provider = new FakeMailProvider();
    await expect(provider.listMessages('inbox', { limit: 51 })).rejects.toThrow(RangeError);
    await expect(provider.listMessages('inbox', { limit: 10, cursor: 'not-a-number' })).rejects.toThrow('MESSAGE_CURSOR_INVALID');
  });
});
