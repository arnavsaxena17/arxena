const DEFAULT_CALENDLY_URL = 'https://calendly.com/arxena';

/**
 * Public Calendly scheduling URL for inline embeds.
 * Override with NEXT_PUBLIC_CALENDLY_URL (e.g. a specific event type URL).
 */
export function getCalendlyUrl(): string {
  const url = process.env.NEXT_PUBLIC_CALENDLY_URL?.trim();
  return url && url.length > 0 ? url : DEFAULT_CALENDLY_URL;
}
