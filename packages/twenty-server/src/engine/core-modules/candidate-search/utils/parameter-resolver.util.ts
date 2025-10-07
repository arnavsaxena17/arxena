import { Logger } from '@nestjs/common';
import { LinkedInSearchService } from '../../linkedin-search/services/linkedin-search.service';

export class ParameterResolver {
  private readonly logger = new Logger(ParameterResolver.name);

  constructor(private readonly linkedInSearchService: LinkedInSearchService) {}

  /**
   * Resolve parameter names to LinkedIn IDs for search parameters
   */
  async resolveParameterIds(
    searchParameters: any,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    accountId: string,
  ): Promise<any> {
    try {
      this.logger.log('Resolving parameter IDs for search parameters:', searchParameters);
      
      const resolvedParameters = { ...searchParameters };

      // Resolve industry parameters
      if (searchParameters.industry && Array.isArray(searchParameters.industry)) {
        const industryResolutions: Array<{id: string, name: string}> = [];
        for (const industryName of searchParameters.industry) {
          try {
            const industryParams = await this.linkedInSearchService.getIndustryParameters(
              accountId,
              industryName,
              20
            );
            const matchingIndustry = this.findBestMatch(industryParams.items, industryName);
            if (matchingIndustry) {
              industryResolutions.push({
                id: matchingIndustry.id,
                name: matchingIndustry.title
              });
              this.logger.log(`Resolved industry "${industryName}" to "${matchingIndustry.title}" (${matchingIndustry.id})`);
            } else {
              this.logger.warn(`No match found for industry: ${industryName}`);
            }
          } catch (error) {
            this.logger.warn(`Failed to resolve industry: ${industryName}`, error);
          }
        }
        resolvedParameters.industry = industryResolutions.length > 0 ? industryResolutions : undefined;
      }

      // Resolve location parameters
      if (searchParameters.location && Array.isArray(searchParameters.location)) {
        const locationResolutions: Array<{id: string, name: string}> = [];
        for (const locationName of searchParameters.location) {
          try {
            const locationParams = await this.linkedInSearchService.getLocationParameters(
              accountId,
              locationName,
              20
            );
            const matchingLocation = this.findBestMatch(locationParams.items, locationName);
            if (matchingLocation) {
              locationResolutions.push({
                id: matchingLocation.id,
                name: matchingLocation.title
              });
              this.logger.log(`Resolved location "${locationName}" to "${matchingLocation.title}" (${matchingLocation.id})`);
            } else {
              this.logger.warn(`No match found for location: ${locationName}`);
            }
          } catch (error) {
            this.logger.warn(`Failed to resolve location: ${locationName}`, error);
          }
        }
        resolvedParameters.location = locationResolutions.length > 0 ? locationResolutions : undefined;
      }

      // Resolve company parameters
      if (searchParameters.company && Array.isArray(searchParameters.company)) {
        const companyResolutions: Array<{id: string, name: string}> = [];
        for (const companyName of searchParameters.company) {
          try {
            const companyParams = await this.linkedInSearchService.getCompanyParameters(
              accountId,
              companyName,
              20
            );
            const matchingCompany = this.findBestMatch(companyParams.items, companyName);
            if (matchingCompany) {
              companyResolutions.push({
                id: matchingCompany.id,
                name: matchingCompany.title
              });
              this.logger.log(`Resolved company "${companyName}" to "${matchingCompany.title}" (${matchingCompany.id})`);
            } else {
              this.logger.warn(`No match found for company: ${companyName}`);
            }
          } catch (error) {
            this.logger.warn(`Failed to resolve company: ${companyName}`, error);
          }
        }
        resolvedParameters.company = companyResolutions.length > 0 ? companyResolutions : undefined;
      }

      // Resolve school parameters
      if (searchParameters.school && Array.isArray(searchParameters.school)) {
        const schoolResolutions: Array<{id: string, name: string}> = [];
        for (const schoolName of searchParameters.school) {
          try {
            const schoolParams = await this.linkedInSearchService.getSchoolParameters(
              accountId,
              schoolName,
              20
            );
            const matchingSchool = this.findBestMatch(schoolParams.items, schoolName);
            if (matchingSchool) {
              schoolResolutions.push({
                id: matchingSchool.id,
                name: matchingSchool.title
              });
              this.logger.log(`Resolved school "${schoolName}" to "${matchingSchool.title}" (${matchingSchool.id})`);
            } else {
              this.logger.warn(`No match found for school: ${schoolName}`);
            }
          } catch (error) {
            this.logger.warn(`Failed to resolve school: ${schoolName}`, error);
          }
        }
        resolvedParameters.school = schoolResolutions.length > 0 ? schoolResolutions : undefined;
      }

      // Resolve past_company parameters
      if (searchParameters.past_company && Array.isArray(searchParameters.past_company)) {
        const pastCompanyResolutions: Array<{id: string, name: string}> = [];
        for (const companyName of searchParameters.past_company) {
          try {
            const companyParams = await this.linkedInSearchService.getCompanyParameters(
              accountId,
              companyName,
              20
            );
            const matchingCompany = this.findBestMatch(companyParams.items, companyName);
            if (matchingCompany) {
              pastCompanyResolutions.push({
                id: matchingCompany.id,
                name: matchingCompany.title
              });
              this.logger.log(`Resolved past company "${companyName}" to "${matchingCompany.title}" (${matchingCompany.id})`);
            } else {
              this.logger.warn(`No match found for past company: ${companyName}`);
            }
          } catch (error) {
            this.logger.warn(`Failed to resolve past company: ${companyName}`, error);
          }
        }
        resolvedParameters.past_company = pastCompanyResolutions.length > 0 ? pastCompanyResolutions : undefined;
      }

      this.logger.log('Resolved search parameters:', resolvedParameters);
      return resolvedParameters;
    } catch (error) {
      this.logger.error('Failed to resolve parameter IDs', error);
      throw error;
    }
  }

  /**
   * Find the best matching parameter from a list of LinkedIn parameters
   */
  private findBestMatch(items: any[], searchTerm: string): any | null {
    if (!items || items.length === 0) {
      return null;
    }

    const normalizedSearchTerm = searchTerm.toLowerCase().trim();
    
    // First, try exact match
    let exactMatch = items.find(item => 
      item.title.toLowerCase() === normalizedSearchTerm
    );
    if (exactMatch) {
      return exactMatch;
    }

    // Then try starts with match
    let startsWithMatch = items.find(item => 
      item.title.toLowerCase().startsWith(normalizedSearchTerm) ||
      normalizedSearchTerm.startsWith(item.title.toLowerCase())
    );
    if (startsWithMatch) {
      return startsWithMatch;
    }

    // Then try contains match
    let containsMatch = items.find(item => 
      item.title.toLowerCase().includes(normalizedSearchTerm) ||
      normalizedSearchTerm.includes(item.title.toLowerCase())
    );
    if (containsMatch) {
      return containsMatch;
    }

    // Finally, try fuzzy matching with word boundaries
    const searchWords = normalizedSearchTerm.split(/\s+/);
    let bestMatch = null;
    let bestScore = 0;

    for (const item of items) {
      const itemWords = item.title.toLowerCase().split(/\s+/);
      let score = 0;
      
      for (const searchWord of searchWords) {
        for (const itemWord of itemWords) {
          if (itemWord.includes(searchWord) || searchWord.includes(itemWord)) {
            score += 1;
          }
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }

    // Only return if we have a reasonable match (at least 1 word match)
    return bestScore > 0 ? bestMatch : null;
  }
}
