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
  // Convert www.linkedin.com to linkedin.com for consistency
  return url.replace('www.linkedin.com', 'linkedin.com');
};

/**
 * Reconstructs a LinkedIn URL for display purposes (with www)
 * @param url - The normalized LinkedIn URL from database
 * @returns The LinkedIn URL formatted for display
 */
export const reconstructLinkedInUrlForDisplay = (url: string): string => {
  if (!url) return '';
  // Convert linkedin.com to www.linkedin.com for display
  return url.replace('linkedin.com', 'www.linkedin.com');
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
