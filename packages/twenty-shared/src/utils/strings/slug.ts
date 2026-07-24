import { toTitleCase } from './toTitleCase';

/**
 * Converts a display string to a URL slug.
 * "United States" -> "united-states"
 * "Human Resources" -> "human-resources"
 */
export function toSlug(str: string): string {
  return str.trim().toLowerCase().replace(/\s+/g, '-');
}

/**
 * Converts a URL slug back to a display string.
 * "united-states" -> "United States"
 * "human-resources" -> "Human Resources"
 */
export function fromSlug(slug: string): string {
  return toTitleCase(slug.replace(/-/g, ' '));
}
