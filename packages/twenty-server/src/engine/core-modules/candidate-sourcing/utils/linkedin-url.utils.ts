import { canonicalizeLinkedinProfileUrl } from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-profile-id.util';

/**
 * Utility functions for handling LinkedIn URLs.
 * Standard DB form: https://linkedin.com/in/{decoded NFC slug} (no www, no %XX).
 */

export const normalizeLinkedInUrl = (url: string): string => {
  if (!url) {
    return '';
  }

  const trimmed = url.trim();

  if (!trimmed.includes('linkedin.com') && !/^https?:\/\//i.test(trimmed)) {
    // Bare slug / public identifier
    return canonicalizeLinkedinProfileUrl(trimmed);
  }

  if (!trimmed.includes('linkedin.com')) {
    return trimmed;
  }

  return canonicalizeLinkedinProfileUrl(trimmed) || trimmed;
};

export const reconstructLinkedInUrlForDisplay = (url: string): string => {
  if (!url) {
    return '';
  }

  return url.replace('linkedin.com', 'www.linkedin.com');
};

export const isLinkedInUrl = (url: string): boolean => {
  if (!url) {
    return false;
  }

  return url.includes('linkedin.com');
};
