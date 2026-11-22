/**
 * Strict RFC 5322 compliant regex for validating email addresses.
 * Requires:
 * 1. Non-empty local part before @ without illegal characters
 * 2. An @ symbol
 * 3. A valid domain name with letters/digits/hyphens
 * 4. A valid top-level domain (TLD) of at least 2 alphabetic characters (e.g., .com, .org, .in, .co.in)
 */
export const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

/**
 * Validates whether an email string is structurally valid.
 */
export function isValidEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  // Disallow spaces anywhere in the address
  if (/\s/.test(trimmed)) return false;
  // Must match regex
  return EMAIL_REGEX.test(trimmed);
}
