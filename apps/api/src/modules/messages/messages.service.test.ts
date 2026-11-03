import { describe, expect, it } from 'vitest';
import { sanitizeMessageHtml } from './messages.service.js';

describe('sanitizeMessageHtml', () => {
  it('keeps basic formatting while removing scripts, images, styles and event handlers', () => {
    const html = sanitizeMessageHtml(
      '<h2 onclick="alert(1)">Hello</h2><script>steal()</script><img src="https://tracker.example/pixel"><p style="color:red">Safe text</p>',
    );

    expect(html).toContain('<h2>Hello</h2>');
    expect(html).toContain('Safe text');
    expect(html).not.toContain('script');
    expect(html).not.toContain('steal()');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('style=');
  });

  it('removes unsafe URL schemes from links', () => {
    const html = sanitizeMessageHtml('<a href="javascript:alert(1)">open</a>');
    expect(html).toContain('open</a>');
    expect(html).not.toContain('javascript:');
  });
});
