import { Injectable, Logger } from '@nestjs/common';
import { JSDOM } from 'jsdom';
import {
  LinkedInPeopleSearchResult,
  LinkedInWorkExperience,
} from '../types/linkedin-search-response.type';

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
          const cardElement = card as Element;
          // this.logger.log(`[Profile ${index} HTML]\n${cardElement.outerHTML}`);
          const result = this.parseResultCard(cardElement, index);
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
   * Parse a single result card element using stable selectors and relative structure.
   * Structure: name container (p with name + "• 2nd"), then headline (p), then location (p), then Current: / followers / mutual.
   */
  private parseResultCard(card: Element, index: number): LinkedInPeopleSearchResult | null {
    try {
      // Stable selector: name and profile URL (data-view-name is not dynamically generated)
      const nameLink = card.querySelector('a[data-view-name="search-result-lockup-title"]');
      let name = nameLink?.textContent?.trim() || '';
      let profileUrlRaw = nameLink?.getAttribute('href') || null;
      const profileUrl = profileUrlRaw
        ? (profileUrlRaw.startsWith('http') ? profileUrlRaw : `https://www.linkedin.com${profileUrlRaw}`)
        : null;

      const publicIdentifier = profileUrl
        ? this.extractPublicIdentifier(profileUrl)
        : null;

      // Name container = <p> containing the name link (or first <p> if no link, e.g. "LinkedIn Member")
      const nameContainer =
        nameLink?.closest('p') || card.querySelector('p');
      const containerText = nameContainer?.textContent?.trim() || '';
      if (!name && containerText && /^LinkedIn Member$/i.test(containerText.trim())) {
        name = 'LinkedIn Member';
      }
      const networkDistanceText = name ? containerText.replace(name, '').trim() : containerText;
      const networkDistance = this.parseNetworkDistance(networkDistanceText);

      // All <p> in document order (stable: tag-based)
      const allParagraphs = Array.from(card.querySelectorAll('p'));
      const nameContainerIndex = nameContainer ? allParagraphs.indexOf(nameContainer) : -1;

      // Content paragraphs = every <p> after the name container with non-empty text, excluding boilerplate
      const contentParagraphs: string[] = [];
      for (let i = nameContainerIndex + 1; i < allParagraphs.length; i++) {
        const text = allParagraphs[i].textContent?.trim() || '';
        if (!text) continue;
        if (/^Search with/i.test(text)) continue;
        contentParagraphs.push(text);
      }

      // Position-based: first content p = headline, second = location (per LinkedIn card structure)
      const headline = contentParagraphs.length > 0 ? contentParagraphs[0] : '';
      const location =
        contentParagraphs.length > 1
          ? contentParagraphs[1]
          : contentParagraphs.find(t => this.looksLikeLocation(t)) || null;

      // Position snippets: Current:, Former:, Previous:, Past: (all in content paragraphs)
      const positionPrefixes = /^(Current|Former|Previous|Past):\s*/i;
      const currentJobSnippet =
        contentParagraphs.find(t => /^Current:/i.test(t)) ||
        allParagraphs
          .map(p => p.textContent?.trim() || '')
          .find(text => /^Current:/i.test(text)) ||
        null;
      const allPositionSnippets = contentParagraphs.filter(t => positionPrefixes.test(t));

      // Followers = "3K followers" or "1K followers"
      const followersCount = this.parseFollowersFromCard(card);

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

      const nameParts = this.parseName(name);
      const firstName = nameParts.firstName;
      const lastName = nameParts.lastName;

      // Current position: parse "Current: Title at Company" into role and company
      let currentRole = '';
      let currentCompany: string | null = null;
      if (currentJobSnippet) {
        const afterCurrent = currentJobSnippet.replace(/^Current:\s*/i, '').trim();
        const parsed = this.extractTitleAndCompany(afterCurrent);
        currentRole = parsed.title;
        currentCompany = parsed.company;
      }

      // Past positions: "Former:", "Previous:", "Past:" → work_experience
      const workExperience = this.parsePastPositionsFromSnippets(allPositionSnippets);

      const result: LinkedInPeopleSearchResult = {
        object: 'SearchResult',
        type: 'PEOPLE',
        id: publicIdentifier || `parsed_${index}_${Date.now()}`,
        public_identifier: publicIdentifier,
        public_profile_url: profileUrl,
        profile_url: profileUrl,
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
        headline: headline,
        connections_count: 0,
        followers_count: followersCount,
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
        current_positions: currentCompany || currentRole ? [{
          company: currentCompany || '',
          company_id: null,
          description: currentJobSnippet || null,
          role: currentRole,
          location: location,
          industry: [],
          tenure_at_role: { years: 0, months: 0 },
          tenure_at_company: { years: 0, months: 0 },
          start: { year: new Date().getFullYear() },
          skills: null,
        }] : [],
        education: [],
        work_experience: workExperience,
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

  /**
   * Heuristic: text looks like a location (e.g. "Mumbai, Maharashtra, India" or "Washim, India").
   * Avoids credential lines like "DM (Pulmonary...), DNB, EDARM..." which also have commas.
   */
  private looksLikeLocation(text: string): boolean {
    if (!text || text.length > 120) return false;
    if (/^Current:/i.test(text)) return false;
    if (/\bat\s+/i.test(text)) return false;
    if (/^\d+K?\s+followers?/i.test(text)) return false;
    if (/is a mutual connection/i.test(text)) return false;
    if (/\(.*\).*\(.*\)/.test(text) && /,/.test(text)) return false;
    const hasComma = text.includes(',');
    const looksLikePlace = /^[\w\s,.]+(?:India|USA|UK|United States|Maharashtra|California)$/i.test(text.trim()) ||
      (hasComma && text.split(',').length >= 2 && text.split(',')[0].trim().length < 50);
    return hasComma && looksLikePlace;
  }

  /**
   * Parse past position snippets ("Former:", "Previous:", "Past:") into work_experience entries.
   * Ignores "Current:" (handled separately as current_positions).
   */
  private parsePastPositionsFromSnippets(snippets: string[]): LinkedInWorkExperience[] {
    const pastPrefixes = /^(Former|Previous|Past):\s*/i;
    const result: LinkedInWorkExperience[] = [];
    const placeholderDate = { year: new Date().getFullYear() };
    for (const text of snippets) {
      if (/^Current:/i.test(text)) continue;
      const match = text.match(pastPrefixes);
      if (!match) continue;
      const afterPrefix = text.slice(match[0].length).trim();
      if (!afterPrefix) continue;
      const { title, company } = this.extractTitleAndCompany(afterPrefix);
      if (!title && !company) continue;
      result.push({
        company: company || '',
        company_id: null,
        role: title || '',
        industry: null,
        start: placeholderDate,
        skills: null,
      });
    }
    return result;
  }

  /**
   * Parse followers count from card text (e.g. "3K followers", "1K followers", "500 followers").
   * Uses tag-based traversal and text content only.
   */
  private parseFollowersFromCard(card: Element): number {
    const paragraphs = Array.from(card.querySelectorAll('p'));
    for (const p of paragraphs) {
      const text = p.textContent?.trim() || '';
      const match = text.match(/^(\d+)([KkMm])?\s+followers?/i);
      if (match) {
        const num = parseInt(match[1], 10);
        const suffix = (match[2] || '').toLowerCase();
        if (suffix === 'k') return num * 1000;
        if (suffix === 'm') return num * 1000000;
        return num;
      }
    }
    return 0;
  }
}
