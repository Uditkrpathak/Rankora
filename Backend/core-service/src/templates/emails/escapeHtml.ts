/**
 * HTML Escaping utility for email templates to prevent XSS / HTML injection.
 * Escapes &, <, >, ", and ' characters into their corresponding HTML entities.
 */
export function escapeHtml(str: unknown): string {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, (match) => {
    switch (match) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return match;
    }
  });
}
