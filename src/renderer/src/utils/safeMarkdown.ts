import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Los enlaces siempre se abren fuera del launcher y sin acceso a window.opener
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/** Convierte Markdown a HTML y lo sanitiza (las notas/normas vienen de fuentes remotas). */
export function renderSafeMarkdown(markdown: string): string {
  const raw = marked.parse(markdown, { breaks: true, gfm: true }) as string;
  return DOMPurify.sanitize(raw, { ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i });
}
