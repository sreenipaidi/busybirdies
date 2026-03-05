import sanitizeHtml from 'sanitize-html';

/**
 * Allowed HTML tags for rich text content such as KB article bodies.
 * These tags preserve formatting while stripping any dangerous content
 * like scripts, event handlers, and javascript: URLs.
 */
const ALLOWED_TAGS = [
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'a',
  'strong',
  'em',
  'code',
  'pre',
  'blockquote',
  'img',
  'br',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
];

/**
 * Allowed HTML attributes per tag using string format.
 * Only safe attributes are permitted:
 * - Links (a): href, target, rel
 * - Images (img): src, alt, width, height
 * - Table cells: colspan, rowspan
 */
const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt', 'width', 'height'],
  th: ['colspan', 'rowspan'],
  td: ['colspan', 'rowspan'],
};

/**
 * Allowed URL schemes for href and src attributes.
 * Blocks javascript:, data:, and vbscript: URLs.
 */
const ALLOWED_SCHEMES = ['http', 'https', 'mailto'];

/**
 * Sanitize user-provided HTML content by stripping dangerous elements
 * and attributes while preserving safe formatting tags.
 *
 * This function:
 * - Removes all script tags and their content
 * - Strips all event handler attributes (onclick, onerror, etc.)
 * - Blocks javascript: and data: URLs
 * - Allows only a whitelist of safe HTML tags and attributes
 *
 * @param html - The raw HTML string to sanitize
 * @returns The sanitized HTML string
 */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ALLOWED_SCHEMES,
    disallowedTagsMode: 'discard',
    // Enforce rel="noopener noreferrer" on links that open in new tabs
    transformTags: {
      a: (tagName, attribs) => {
        const result: sanitizeHtml.Attributes = { ...attribs };
        if (result.target === '_blank') {
          result.rel = 'noopener noreferrer';
        }
        return { tagName, attribs: result };
      },
    },
  });
}

/**
 * Sanitize search snippets that may contain only <mark> tags for
 * highlighting search matches (from PostgreSQL ts_headline).
 *
 * @param snippet - The raw snippet string from search results
 * @returns The sanitized snippet with only mark tags allowed
 */
export function sanitizeSearchSnippet(snippet: string): string {
  return sanitizeHtml(snippet, {
    allowedTags: ['mark'],
    allowedAttributes: {},
  });
}
