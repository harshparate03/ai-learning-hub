/** Strip HTML tags and dangerous patterns from user-supplied text. */
export function sanitizeUserInput(input: string, maxLength = 12000): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .trim()
    .slice(0, maxLength);
}

/** Sanitize email for storage/display. */
export function sanitizeEmail(email: string): string {
  return sanitizeUserInput(email, 254)
    .toLowerCase()
    .replace(/[^a-z0-9@._+\-]/g, '');
}

/** Validate basic email shape after sanitization. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
