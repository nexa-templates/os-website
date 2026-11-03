import { marked } from 'marked';
import sanitize from 'sanitize-html';

export function markdown(body) {
  return sanitize(marked.parse(body, { async: false }), {
    allowedTags: ['p', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'strong', 'em', 'del', 'blockquote', 'code', 'pre', 'hr', 'br', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    allowedAttributes: { a: ['href', 'title', 'rel'], ol: ['start'] },
    allowedSchemes: ['http', 'https', 'mailto'], allowProtocolRelative: false,
    transformTags: { a: sanitize.simpleTransform('a', { rel: 'noopener noreferrer' }) },
  });
}
