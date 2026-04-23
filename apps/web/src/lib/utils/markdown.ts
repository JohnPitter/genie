import { marked, type Tokens } from 'marked';

// Custom renderer for financial data — clean, premium look
const renderer = new marked.Renderer();

// Tables: styled premium dark table
renderer.table = ({ header, rows }: Tokens.Table) => {
  const headerCells = header
    .map((cell) => `<th>${renderCellTokens(cell.tokens)}</th>`)
    .join('');

  const bodyRows = rows
    .map((row) => {
      const cells = row
        .map((cell) => `<td>${renderCellTokens(cell.tokens)}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<div class="md-table-wrap"><table class="md-table"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
};

function renderCellTokens(tokens: Tokens.Generic[]): string {
  return tokens
    .map((t: Tokens.Generic) => {
      if (t.type === 'text') {
        const txt = t as Tokens.Text;
        // Recurse into nested tokens (e.g. link inside text)
        if (txt.tokens && txt.tokens.length) return renderCellTokens(txt.tokens as Tokens.Generic[]);
        return escapeHtml(txt.text);
      }
      if (t.type === 'link') {
        const lnk = t as Tokens.Link;
        const href = lnk.href && (lnk.href.startsWith('http://') || lnk.href.startsWith('https://')) ? lnk.href : '#';
        const label = lnk.tokens?.length ? renderCellTokens(lnk.tokens as Tokens.Generic[]) : escapeHtml(lnk.text ?? '');
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
      }
      if (t.type === 'strong') return `<strong>${escapeHtml((t as Tokens.Strong).text)}</strong>`;
      if (t.type === 'em') return `<em>${escapeHtml((t as Tokens.Em).text)}</em>`;
      if (t.type === 'codespan') return `<code>${escapeHtml((t as Tokens.Codespan).text)}</code>`;
      return 'raw' in t ? escapeHtml(String(t.raw)) : '';
    })
    .join('');
}

// Links: open in new tab, safe URLs only
renderer.link = ({ href, title, tokens }: Tokens.Link) => {
  const safe = href && (href.startsWith('http://') || href.startsWith('https://')) ? href : '#';
  const text = tokens.map((t: Tokens.Generic) => {
    const tok = t as unknown as { text?: string; raw?: string };
    return tok.text ? escapeHtml(tok.text) : (tok.raw ? escapeHtml(tok.raw) : '');
  }).join('');
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
  return `<a href="${safe}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
};

// Headings: styled
renderer.heading = ({ text, depth }: Tokens.Heading) => {
  return `<h${depth} class="md-h${depth}">${text}</h${depth}>`;
};

// Code blocks
renderer.code = ({ text, lang }: Tokens.Code) => {
  const escaped = escapeHtml(text);
  const langAttr = lang ? ` class="lang-${lang}"` : '';
  return `<pre class="md-codeblock"${langAttr}><code>${escaped}</code></pre>`;
};

marked.setOptions({ breaks: true });

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Escape raw HTML tags that slip through marked (XSS prevention).
// We allow only the tags that our own renderer explicitly emits.
const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'strong', 'em', 'code', 'pre', 'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody',
  'tr', 'th', 'td', 'div', 'span', 'blockquote',
  's', 'del', 'sub', 'sup', 'mark',
]);

function sanitizeHtml(html: string): string {
  // Escape any tag whose name is not in the allowlist
  return html.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag: string) => {
    return ALLOWED_TAGS.has(tag.toLowerCase()) ? match : match.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  });
}

export function renderMarkdown(text: string): string {
  if (!text) return '';
  const html = marked.parse(text, { renderer, async: false }) as string;
  return sanitizeHtml(html);
}

// Keep for backwards compat — now delegates to full renderer
export function renderInlineMarkdown(text: string): string {
  return renderMarkdown(text);
}
