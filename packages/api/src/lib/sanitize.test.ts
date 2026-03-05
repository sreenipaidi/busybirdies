import { describe, it, expect } from 'vitest';
import { sanitizeRichText, sanitizeSearchSnippet } from './sanitize.js';

describe('sanitizeRichText', () => {
  it('should allow safe HTML tags', () => {
    const input = '<p>Hello <strong>world</strong></p>';
    const result = sanitizeRichText(input);
    expect(result).toBe('<p>Hello <strong>world</strong></p>');
  });

  it('should allow heading tags h1-h6', () => {
    const input = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>';
    const result = sanitizeRichText(input);
    expect(result).toContain('<h1>');
    expect(result).toContain('<h2>');
    expect(result).toContain('<h3>');
  });

  it('should allow list tags', () => {
    const input = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    const result = sanitizeRichText(input);
    expect(result).toBe('<ul><li>Item 1</li><li>Item 2</li></ul>');
  });

  it('should allow ordered lists', () => {
    const input = '<ol><li>First</li><li>Second</li></ol>';
    const result = sanitizeRichText(input);
    expect(result).toBe('<ol><li>First</li><li>Second</li></ol>');
  });

  it('should allow links with href attribute', () => {
    const input = '<a href="https://example.com">Click here</a>';
    const result = sanitizeRichText(input);
    expect(result).toContain('href="https://example.com"');
  });

  it('should allow images with src and alt attributes', () => {
    const input = '<img src="https://example.com/img.png" alt="photo" />';
    const result = sanitizeRichText(input);
    expect(result).toContain('src="https://example.com/img.png"');
    expect(result).toContain('alt="photo"');
  });

  it('should allow code and pre tags', () => {
    const input = '<pre><code>const x = 1;</code></pre>';
    const result = sanitizeRichText(input);
    expect(result).toContain('<pre>');
    expect(result).toContain('<code>');
  });

  it('should allow blockquote tags', () => {
    const input = '<blockquote>A quote</blockquote>';
    const result = sanitizeRichText(input);
    expect(result).toBe('<blockquote>A quote</blockquote>');
  });

  it('should allow table tags', () => {
    const input = '<table><thead><tr><th>Col</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>';
    const result = sanitizeRichText(input);
    expect(result).toContain('<table>');
    expect(result).toContain('<thead>');
    expect(result).toContain('<tbody>');
    expect(result).toContain('<tr>');
    expect(result).toContain('<th>');
    expect(result).toContain('<td>');
  });

  it('should allow br tags', () => {
    const input = 'Line one<br>Line two';
    const result = sanitizeRichText(input);
    expect(result).toContain('<br');
  });

  it('should strip script tags completely', () => {
    const input = '<p>Hello</p><script>alert("xss")</script>';
    const result = sanitizeRichText(input);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
    expect(result).toBe('<p>Hello</p>');
  });

  it('should strip inline event handlers', () => {
    const input = '<img src="x" onerror="alert(1)" />';
    const result = sanitizeRichText(input);
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('alert');
  });

  it('should strip onclick event handlers', () => {
    const input = '<p onclick="alert(1)">Click me</p>';
    const result = sanitizeRichText(input);
    expect(result).not.toContain('onclick');
    expect(result).toBe('<p>Click me</p>');
  });

  it('should block javascript: URLs in href', () => {
    const input = '<a href="javascript:alert(1)">Click</a>';
    const result = sanitizeRichText(input);
    expect(result).not.toContain('javascript:');
  });

  it('should block data: URLs in img src', () => {
    const input = '<img src="data:text/html,<script>alert(1)</script>" />';
    const result = sanitizeRichText(input);
    expect(result).not.toContain('data:');
  });

  it('should strip iframe tags', () => {
    const input = '<iframe src="https://evil.com"></iframe>';
    const result = sanitizeRichText(input);
    expect(result).not.toContain('<iframe');
  });

  it('should strip form tags', () => {
    const input = '<form action="https://evil.com"><input type="text" /></form>';
    const result = sanitizeRichText(input);
    expect(result).not.toContain('<form');
    expect(result).not.toContain('<input');
  });

  it('should strip style tags', () => {
    const input = '<style>body { background: red; }</style><p>Hello</p>';
    const result = sanitizeRichText(input);
    expect(result).not.toContain('<style');
    expect(result).toBe('<p>Hello</p>');
  });

  it('should strip style attributes', () => {
    const input = '<p style="background:url(javascript:alert(1))">Styled</p>';
    const result = sanitizeRichText(input);
    expect(result).not.toContain('style=');
  });

  it('should handle empty string input', () => {
    expect(sanitizeRichText('')).toBe('');
  });

  it('should handle plain text without HTML', () => {
    const input = 'Just plain text with no HTML';
    expect(sanitizeRichText(input)).toBe('Just plain text with no HTML');
  });

  it('should allow em tags for emphasis', () => {
    const input = '<em>emphasized text</em>';
    expect(sanitizeRichText(input)).toBe('<em>emphasized text</em>');
  });

  it('should add rel="noopener noreferrer" when target="_blank"', () => {
    const input = '<a href="https://example.com" target="_blank">Link</a>';
    const result = sanitizeRichText(input);
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it('should allow table cells with colspan and rowspan', () => {
    const input = '<table><tr><td colspan="2" rowspan="3">Wide cell</td></tr></table>';
    const result = sanitizeRichText(input);
    expect(result).toContain('colspan="2"');
    expect(result).toContain('rowspan="3"');
  });

  it('should allow mailto: URLs in links', () => {
    const input = '<a href="mailto:support@example.com">Email us</a>';
    const result = sanitizeRichText(input);
    expect(result).toContain('href="mailto:support@example.com"');
  });
});

describe('sanitizeSearchSnippet', () => {
  it('should allow mark tags for search highlighting', () => {
    const input = 'How to <mark>reset</mark> your password';
    const result = sanitizeSearchSnippet(input);
    expect(result).toBe('How to <mark>reset</mark> your password');
  });

  it('should strip all tags except mark', () => {
    const input = '<p>How to <mark>reset</mark> your <script>alert("xss")</script> password</p>';
    const result = sanitizeSearchSnippet(input);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('<p>');
    expect(result).toContain('<mark>reset</mark>');
  });

  it('should handle snippets without mark tags', () => {
    const input = 'Plain text snippet without marks';
    expect(sanitizeSearchSnippet(input)).toBe('Plain text snippet without marks');
  });

  it('should handle empty string', () => {
    expect(sanitizeSearchSnippet('')).toBe('');
  });
});
