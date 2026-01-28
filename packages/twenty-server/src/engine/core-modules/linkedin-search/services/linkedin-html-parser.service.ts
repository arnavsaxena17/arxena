import { Injectable, Logger } from '@nestjs/common';
import { JSDOM } from 'jsdom';
import { LinkedInPeopleSearchResult } from '../types/linkedin-search-response.type';

@Injectable()
export class LinkedInHtmlParserService {
  private readonly logger = new Logger(LinkedInHtmlParserService.name);

  /**
   * Parse HTML response from LinkedIn raw search endpoint
   * @param html HTML string from Unipile raw endpoint
   * @returns Array of LinkedInPeopleSearchResult
   */
  parseLinkedInSearchResults(html: string): LinkedInPeopleSearchResult[] {
    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // Find all people search result cards
      const resultCards = document.querySelectorAll('[data-view-name="people-search-result"]');
      
      if (resultCards.length === 0) {
        this.logger.warn('No people search results found in HTML');
        return [];
      }

      const results: LinkedInPeopleSearchResult[] = [];

      resultCards.forEach((card, index) => {
        try {
          const result = this.parseResultCard(card as Element, index);
          if (result) {
            results.push(result);
          }
        } catch (error) {
          this.logger.warn(`Failed to parse result card ${index}: ${error}`);
        }
      });

      this.logger.log(`Parsed ${results.length} LinkedIn search results from HTML`);
      return results;
    } catch (error) {
      this.logger.error(`Failed to parse LinkedIn HTML: ${error}`);
      return [];
    }
  }

  /**
   * Parse a single result card element
   */
  private parseResultCard(card: Element, index: number): LinkedInPeopleSearchResult | null {
    try {
      // Extract name and profile URL using stable data attribute
      const nameLink = card.querySelector('a[data-view-name="search-result-lockup-title"]');
      const name = nameLink?.textContent?.trim() || '';
      const profileUrl = nameLink?.getAttribute('href') || null;
      
      // Extract public identifier from profile URL
      const publicIdentifier = profileUrl 
        ? this.extractPublicIdentifier(profileUrl)
        : null;

      // Extract network distance (e.g., "• 2nd") without relying on dynamic classes
      // Strategy:
      // - Find the closest text container for the name (typically a <p> or heading element)
      // - Remove the name from that text and parse the remaining part for "1st", "2nd", "3rd"
      let networkDistanceText = '';
      if (nameLink) {
        const nameContainer =
          nameLink.closest('p') ||
          nameLink.parentElement ||
          undefined;

        const containerText = nameContainer?.textContent?.trim() || '';
        if (containerText) {
          // Remove the name itself to isolate suffix like "• 2nd"
          const withoutName = containerText.replace(name, '').trim();
          networkDistanceText = withoutName;
        }
      }
      const networkDistance = this.parseNetworkDistance(networkDistanceText);

      // Extract headline/title (e.g., "Associate Director at KPMG")
      // Strategy:
      // - Look for the first <p> inside the card whose text:
      //   - is non-empty
      //   - is not a "Current:" snippet
      //   - is not just a location (no "Current:" and typically contains " at " for title)
      const allParagraphs = Array.from(card.querySelectorAll('p'));
      let headline = '';

      for (const p of allParagraphs) {
        const text = p.textContent?.trim() || '';
        if (!text) continue;
        // Skip obvious non-headline paragraphs
        if (/^Current:/i.test(text)) continue;
        if (/^Search with Sales Navigator/i.test(text)) continue;

        // Prefer paragraphs that look like "Title at Company"
        if (/\sat\s.+/i.test(text)) {
          headline = text;
          break;
        }

        // Fallback: take the first non-empty paragraph after the name container
        if (!headline && nameLink && p.compareDocumentPosition(nameLink) & Node.DOCUMENT_POSITION_FOLLOWING) {
          headline = text;
          // Don't break yet; we may still find a better "Title at Company" match
        }
      }

      // Extract location
      // Strategy:
      // - Look for a <p> whose text:
      //   - does not start with "Current:"
      //   - does not contain "Search with"
      //   - often contains a comma-separated city/region string
      let location: string | null = null;
      for (const p of allParagraphs) {
        const text = p.textContent?.trim() || '';
        if (!text) continue;
        if (/^Current:/i.test(text)) continue;
        if (/^Search with/i.test(text)) continue;

        // Heuristic: location lines often have commas and no " at "
        const hasComma = text.includes(',');
        const hasAtKeyword = /\sat\s.+/i.test(text);
        if (hasComma && !hasAtKeyword) {
          location = text;
          break;
        }
      }

      // Extract current job snippet (e.g., "Current: Associate Director at KPMG - ...the NBFC...")
      const currentJobSnippet =
        allParagraphs
          .map(p => p.textContent?.trim() || '')
          .find(text => /^Current:/i.test(text)) || null;

      // Extract profile picture URL
      // Strategy:
      // - Prefer <img> inside a <figure>
      // - Fallback to any element with an inline background-image style
      const profilePictureElement =
        card.querySelector('figure img') ||
        card.querySelector('figure [style*="background-image"]') ||
        card.querySelector('[style*="background-image"]');
      let profilePictureUrl: string | null = null;
      if (profilePictureElement) {
        profilePictureUrl = profilePictureElement.getAttribute('src') || 
                          profilePictureElement.getAttribute('data-src') ||
                          this.extractBackgroundImageUrl(profilePictureElement);
      }

      // Extract name parts
      const nameParts = this.parseName(name);
      const firstName = nameParts.firstName;
      const lastName = nameParts.lastName;

      // Extract company and title from headline
      const { title, company } = this.extractTitleAndCompany(headline);

      // Build LinkedInPeopleSearchResult
      const result: LinkedInPeopleSearchResult = {
        object: 'SearchResult',
        type: 'PEOPLE',
        id: publicIdentifier || `parsed_${index}_${Date.now()}`,
        public_identifier: publicIdentifier,
        public_profile_url: profileUrl ? `https://www.linkedin.com${profileUrl}` : null,
        profile_url: profileUrl ? `https://www.linkedin.com${profileUrl}` : null,
        profile_picture_url: profilePictureUrl,
        profile_picture_url_large: profilePictureUrl,
        member_urn: null,
        name: name || `${firstName} ${lastName}`.trim(),
        first_name: firstName,
        last_name: lastName,
        network_distance: networkDistance,
        location: location,
        industry: null,
        keywords_match: '',
        headline: headline || title || '',
        connections_count: 0,
        followers_count: 0,
        pending_invitation: false,
        can_send_inmail: false,
        hiddenCandidate: false,
        interestLikelihood: '',
        privacySettings: {
          allowConnectionsBrowse: false,
          showPremiumSubscriberIcon: false,
        },
        skills: [],
        premium: false,
        verified: false,
        open_profile: false,
        shared_connections_count: 0,
        recent_posts_count: 0,
        recently_hired: false,
        mentioned_in_the_news: false,
        current_positions: company ? [{
          company: company,
          company_id: null,
          description: currentJobSnippet || null,
          role: title || headline,
          location: location,
          industry: [],
          tenure_at_role: { years: 0, months: 0 },
          tenure_at_company: { years: 0, months: 0 },
          start: { year: new Date().getFullYear() },
          skills: null,
        }] : [],
        education: [],
        work_experience: [],
        certifications: [],
        projects: [],
      };

      return result;
    } catch (error) {
      this.logger.warn(`Error parsing result card ${index}: ${error}`);
      return null;
    }
  }

  /**
   * Extract public identifier from LinkedIn profile URL
   */
  private extractPublicIdentifier(url: string): string | null {
    const match = url.match(/\/in\/([^\/\?]+)/);
    return match ? match[1] : null;
  }

  /**
   * Parse network distance from text like "• 2nd" or "2nd"
   */
  private parseNetworkDistance(text: string): 'SELF' | 'DISTANCE_1' | 'DISTANCE_2' | 'DISTANCE_3' | 'OUT_OF_NETWORK' {
    const cleaned = text.replace(/[•\s]/g, '').toLowerCase();
    
    if (cleaned.includes('1st') || cleaned === '1') {
      return 'DISTANCE_1';
    } else if (cleaned.includes('2nd') || cleaned === '2') {
      return 'DISTANCE_2';
    } else if (cleaned.includes('3rd') || cleaned === '3') {
      return 'DISTANCE_3';
    } else if (cleaned.includes('self') || cleaned === '0') {
      return 'SELF';
    }
    
    return 'OUT_OF_NETWORK';
  }

  /**
   * Parse name into first and last name
   */
  private parseName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 0) {
      return { firstName: '', lastName: '' };
    } else if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' };
    } else {
      return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' '),
      };
    }
  }

  /**
   * Extract title and company from headline
   * Handles formats like "Associate Director at KPMG" or "Director"
   */
  private extractTitleAndCompany(headline: string): { title: string; company: string | null } {
    if (!headline) {
      return { title: '', company: null };
    }

    // Pattern: "Title at Company" or "Title AT Company"
    const atPattern = /\s+(?:at|AT)\s+(.+)$/i;
    const match = headline.match(atPattern);
    
    if (match) {
      const title = headline.substring(0, match.index).trim();
      const company = match[1].trim();
      return { title, company };
    }

    // If no "at" pattern, use entire headline as title
    return { title: headline.trim(), company: null };
  }

  /**
   * Extract background image URL from style attribute
   */
  private extractBackgroundImageUrl(element: Element): string | null {
    const style = element.getAttribute('style');
    if (!style) return null;

    const match = style.match(/background-image:\s*url\(['"]?([^'"]+)['"]?\)/);
    return match ? match[1] : null;
  }
}
