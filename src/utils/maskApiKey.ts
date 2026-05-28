/**
 * Mask an API key for display: shows first 3 and last 4 characters.
 * Examples: "sk-abc123xyz" → "sk-****xyz"
 *           "short" → "****"
 *           "" → ""
 */
export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 7) return '****';
  const prefix = key.slice(0, 3);
  const suffix = key.slice(-4);
  return `${prefix}${'*'.repeat(Math.min(key.length - 7, 8))}${suffix}`;
}
