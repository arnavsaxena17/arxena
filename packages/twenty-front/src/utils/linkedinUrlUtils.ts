/**
 * Utility functions for handling LinkedIn URLs
 * We standardize LinkedIn URLs to always use https://linkedin.com/in/ format (without www) in the database
 * and reconstruct them for display purposes
 */

/**
 * Normalizes a LinkedIn URL to the standard format (without www)
 * @param url - The LinkedIn URL to normalize
 * @returns The normalized LinkedIn URL
 */
export const normalizeLinkedInUrl = (url: string): string => {
  if (!url) return '';
  // Collapse any number of leading www. subdomains on linkedin.com to a bare linkedin.com
  return url.replace(/(?:www\.)+linkedin\.com/gi, 'linkedin.com');
};

/**
 * Reconstructs a LinkedIn URL for display purposes (with www)
 * @param url - The normalized LinkedIn URL from database
 * @returns The LinkedIn URL formatted for display
 */
const WWW_LINKEDIN_HOST_PLACEHOLDER = '__ARXENA_WWW_LINKEDIN_COM__';

export const reconstructLinkedInUrlForDisplay = (url: string): string => {
  if (!url) return '';
  // Idempotent: collapse any www.www... chain first, then prepend exactly one www.
  // Avoid RegExp lookbehind (?<!...): unsupported on Safari / WebKit before iOS 16.4, which
  // breaks the entire bundle at parse time on older iPads.
  return url
    .replace(/(?:www\.)+linkedin\.com/gi, WWW_LINKEDIN_HOST_PLACEHOLDER)
    .replace(/linkedin\.com/gi, 'www.linkedin.com')
    .split(WWW_LINKEDIN_HOST_PLACEHOLDER)
    .join('www.linkedin.com');
};

/**
 * Checks if a URL is a LinkedIn URL
 * @param url - The URL to check
 * @returns True if the URL is a LinkedIn URL
 */
export const isLinkedInUrl = (url: string): boolean => {
  if (!url) return false;
  return url.includes('linkedin.com');
};
