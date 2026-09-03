/**
 * Inbound Email & Content Sanitizer for LLM Safety
 *
 * Strips HTML/script tags, zero-width characters, and defangs prompt-injection markers
 * before inbound content is appended to conversation history or system prompts.
 */

// Regex for zero-width / bidirectional control characters commonly used to conceal payloads
const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2060-\u206F]/g;

// Known adversarial prompt injection markers
const INJECTION_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /system\s+override\s*:/gi, replacement: '[User note: system override]' },
  { pattern: /ignore\s+(all\s+)?(prior|previous)\s+instructions/gi, replacement: '[User asked to disregard prior context]' },
  { pattern: /you\s+are\s+now\s+(an?\s+)?unrestricted/gi, replacement: '[User requested unrestricted role]' },
  { pattern: /print\s+verbatim\s+(your\s+)?(entire\s+)?system\s+prompt/gi, replacement: '[User requested system prompt]' },
  { pattern: /output\s+your\s+system\s+prompt/gi, replacement: '[User requested system prompt]' },
  { pattern: /###\s*instruction:?/gi, replacement: '### User Question:' },
  { pattern: /\[system\]/gi, replacement: '[user]' },
  { pattern: /<\|\s*im_start\s*\|>/gi, replacement: '' },
  { pattern: /<\|\s*im_end\s*\|>/gi, replacement: '' },
];

/**
 * Strips HTML tags while converting common line-break tags (<br>, <p>) to newlines.
 */
export function stripHtmlTags(html: string): string {
  if (!html || typeof html !== 'string') return '';
  return html
    // Convert line breaks and paragraph tags into clean newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    // Remove script and style blocks entirely
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

/**
 * Sanitizes inbound email or chat content before submitting to the LLM.
 */
export function sanitizeInboundEmail(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';

  // 1. Strip HTML tags & scripts
  let cleaned = stripHtmlTags(rawText);

  // 2. Remove invisible / zero-width characters
  cleaned = cleaned.replace(ZERO_WIDTH_REGEX, '');

  // 3. Defang known prompt injection directives
  for (const { pattern, replacement } of INJECTION_PATTERNS) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  // 4. Defang markdown fence escapes (e.g. ````json or ```system)
  cleaned = cleaned.replace(/`{3,}\s*(json|system|prompt|assistant|model)?/gi, (match) => {
    return match.replace(/`/g, "'");
  });

  // 5. Normalize excessive whitespace (more than 3 consecutive newlines)
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n').trim();

  return cleaned;
}

/**
 * Sanitizes metadata fields (name, county, location, company, etc.) to prevent
 * indirect prompt injection, newline breakouts, and template manipulation.
 */
export function sanitizeMetadataField(rawText: string, maxLength: number = 120): string {
  if (!rawText || typeof rawText !== 'string') return '';
  let cleaned = stripHtmlTags(rawText);
  cleaned = cleaned.replace(ZERO_WIDTH_REGEX, '');
  for (const { pattern, replacement } of INJECTION_PATTERNS) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  // Strip newlines, carriage returns, tabs, and control characters
  cleaned = cleaned.replace(/[\r\n\t]+/g, ' ');
  cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  // Defang markdown / template syntax brackets
  cleaned = cleaned.replace(/[`${}[\]()]/g, '');
  // Truncate to maximum length
  return cleaned.trim().slice(0, maxLength);
}

