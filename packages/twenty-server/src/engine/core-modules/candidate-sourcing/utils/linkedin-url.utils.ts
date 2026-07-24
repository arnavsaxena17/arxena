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
  
  // Remove any whitespace
  url = url.trim();
  
  // If it doesn't contain linkedin.com, return as is
  if (!url.includes('linkedin.com')) {
    return url;
  }
  
  // Convert www.linkedin.com to linkedin.com for consistency
  url = url.replace('www.linkedin.com', 'linkedin.com');
  
  // Ensure it starts with https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  // Convert http:// to https:// for security
  url = url.replace('http://linkedin.com', 'https://linkedin.com');
  
  return url;
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
