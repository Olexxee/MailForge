import { describe, expect, it } from 'vitest';
import { FakeMailProvider } from './fake-provider.js';

describe('FakeMailProvider', () => {
  it('filters by folder and enforces bounded pagination', async () => {
    const provider = new FakeMailProvider();
    provider.seed([
      { id: 'a', folderId: 'inbox', subject: 'A', from: 'a@example.com', receivedAt: new Date(), unread: true },
      { id: 'b', folderId: 'sent', subject: 'B', from: 'b@example.com', receivedAt: new Date(), unread: false },
    ]);
    await expect(provider.listMessages('inbox', 10)).resolves.toHaveLength(1);
    await expect(provider.listMessages('inbox', 101)).rejects.toThrow(RangeError);
  });
});
