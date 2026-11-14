import type {
    ContactAvailability,
    ContactEnrichmentOptions,
    ContactResult,
} from '../types/contact-enrichment.types';

export interface ContactEnrichmentProvider {
  /**
   * Check if email/phone is available for a LinkedIn profile URL.
   * Returns both true if not supported (will rely on fetch to fail without charging where possible).
   */
  checkAvailability(
    linkedinUrl: string,
  ): Promise<ContactAvailability>;

  /**
   * Fetch contact information. Pass `apolloPersonId` + `companyDomain` in `options` for
   * Apollo `people/match` (and optional `linkedinUrl` to disambiguate the profile).
   */
  fetchContacts(
    linkedinUrl: string,
    options?: ContactEnrichmentOptions,
  ): Promise<ContactResult>;

  /**
   * Get the provider name.
   */
  getName(): string;

  /**
   * Check if this provider is enabled/configured.
   */
  isEnabled(): boolean;
}
