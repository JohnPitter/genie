import { describe, it, expect } from 'vitest';
import { renderInlineMarkdown } from './markdown';

describe('renderInlineMarkdown', () => {
  it('escapes <script> tags (XSS prevention)', () => {
    const result = renderInlineMarkdown('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('escapes & characters', () => {
    const result = renderInlineMarkdown('a & b');
    expect(result).toContain('&amp;');
  });

  it('escapes > and < characters', () => {
    const result = renderInlineMarkdown('1 < 2 > 0');
    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
  });

  it('renders **bold** as <strong>', () => {
    const result = renderInlineMarkdown('Hello **world**!');
    expect(result).toContain('<strong>world</strong>');
  });

  it('renders *italic* as <em>', () => {
    const result = renderInlineMarkdown('Hello *world*!');
    expect(result).toContain('<em>world</em>');
  });

  it('renders `code` as <code>', () => {
    const result = renderInlineMarkdown('Use `npm install`.');
    expect(result).toContain('<code>npm install</code>');
  });

  it('renders [link](url) as <a> with target=_blank', () => {
    const result = renderInlineMarkdown('[Petrobras](https://petrobras.com.br)');
    expect(result).toContain('<a href="https://petrobras.com.br"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
    expect(result).toContain('>Petrobras</a>');
  });

  it('renders link with http:// scheme', () => {
    const result = renderInlineMarkdown('[Site](http://example.com)');
    expect(result).toContain('href="http://example.com"');
  });

  it('blocks non-http link (replaces with #)', () => {
    const result = renderInlineMarkdown('[Evil](javascript:alert(1))');
    expect(result).toContain('href="#"');
    expect(result).not.toContain('javascript:');
  });

  it('wraps text in <p> tags', () => {
    const result = renderInlineMarkdown('Hello world');
    expect(result).toContain('<p>');
    expect(result).toContain('</p>');
  });

  it('converts \\n\\n to separate paragraphs', () => {
    const result = renderInlineMarkdown('Para one.\n\nPara two.');
    expect(result).toContain('<p>Para one.</p>');
    expect(result).toContain('<p>Para two.</p>');
  });

  it('converts single \\n to <br>', () => {
    const result = renderInlineMarkdown('Line one.\nLine two.');
    expect(result).toContain('<br>');
  });

  it('handles mixed formatting', () => {
    const result = renderInlineMarkdown('**Bold** and *italic* and `code`.');
    expect(result).toContain('<strong>Bold</strong>');
    expect(result).toContain('<em>italic</em>');
    expect(result).toContain('<code>code</code>');
  });

  it('does not apply markdown inside already-escaped entities', () => {
    // Input: <b>test</b> — should be escaped, not rendered as HTML
    const result = renderInlineMarkdown('<b>test</b>');
    expect(result).not.toContain('<b>');
    expect(result).toContain('&lt;b&gt;');
  });
});
