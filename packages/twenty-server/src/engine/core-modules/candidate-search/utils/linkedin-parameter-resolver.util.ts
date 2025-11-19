import { Injectable, Logger } from '@nestjs/common';
import { LinkedInSearchService } from '../../linkedin-search/services/linkedin-search.service';

@Injectable()
export class LinkedinParameterResolver {
  private readonly logger = new Logger(LinkedinParameterResolver.name);

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
      if (!searchParameters) {
        this.logger.warn('Search parameters are null or undefined, returning empty object');
        return {};
      }
      
      const resolvedParameters = { ...searchParameters } as any;
      
      // Check if parameters are already resolved (contain LinkedIn IDs)
      const areParametersResolved = this.checkIfParametersResolved(searchParameters);
      
      if (areParametersResolved) {
        this.logger.log('Parameters are already resolved, preserving display information');
        // If parameters are already resolved, we need to ensure display information is preserved
        // This happens when frontend sends already-resolved parameters
        return this.preserveDisplayInformation(searchParameters, accountId);
      }

      // Resolve industry parameters
      if (searchParameters.industry) {
        // Handle Classic format (flat array)
        if (Array.isArray(searchParameters.industry)) {
          const industryIds: string[] = [];
          const industryDisplay: Array<{ id: string; title: string }> = [];
          for (const industryName of searchParameters.industry) {
            try {
              const industryParams = await this.linkedInSearchService.getIndustryParameters(
                accountId,
                industryName,
                20
              );
              const matchingIndustry = this.findBestMatch(industryParams.items, industryName);
              if (matchingIndustry) {
                industryIds.push(matchingIndustry.id);
                industryDisplay.push({ id: matchingIndustry.id, title: matchingIndustry.title });
                this.logger.log(`Resolved industry "${industryName}" to "${matchingIndustry.title}" (${matchingIndustry.id})`);
              } else {
                this.logger.warn(`No match found for industry: ${industryName}`);
              }
            } catch (error) {
              this.logger.warn(`Failed to resolve industry: ${industryName}`, error);
            }
          }
          resolvedParameters.industry = industryIds.length > 0 ? industryIds : undefined;
          // Include display fields for frontend use (will be stripped before LinkedIn API calls)
          resolvedParameters.industry_display = industryDisplay.length > 0 ? industryDisplay : undefined;
        }
        // Handle Sales Navigator/Recruiter format (include/exclude objects)
        else if (searchParameters.industry.include || searchParameters.industry.exclude) {
          const resolvedIndustry = { ...searchParameters.industry };
          
          // Resolve include industries
          if (Array.isArray(searchParameters.industry.include) && searchParameters.industry.include.length > 0) {
            const industryIds: string[] = [];
            const industryDisplay: Array<{ id: string; title: string }> = [];
            for (const industryName of searchParameters.industry.include) {
              try {
                const industryParams = await this.linkedInSearchService.getIndustryParameters(
                  accountId,
                  industryName,
                  20
                );
                const matchingIndustry = this.findBestMatch(industryParams.items, industryName);
                if (matchingIndustry) {
                  industryIds.push(matchingIndustry.id);
                  industryDisplay.push({ id: matchingIndustry.id, title: matchingIndustry.title });
                  this.logger.log(`Resolved industry "${industryName}" to "${matchingIndustry.title}" (${matchingIndustry.id})`);
                } else {
                  this.logger.warn(`No match found for industry: ${industryName}`);
                }
              } catch (error) {
                this.logger.warn(`Failed to resolve industry: ${industryName}`, error);
              }
            }
            resolvedIndustry.include = industryIds.length > 0 ? industryIds : null;
            resolvedParameters.industry_display = industryDisplay.length > 0 ? industryDisplay : undefined;
          }
          
          // Resolve exclude industries
          if (Array.isArray(searchParameters.industry.exclude) && searchParameters.industry.exclude.length > 0) {
            const excludeIndustryIds: string[] = [];
            for (const industryName of searchParameters.industry.exclude) {
              try {
                const industryParams = await this.linkedInSearchService.getIndustryParameters(
                  accountId,
                  industryName,
                  20
                );
                const matchingIndustry = this.findBestMatch(industryParams.items, industryName);
                if (matchingIndustry) {
                  excludeIndustryIds.push(matchingIndustry.id);
                  this.logger.log(`Resolved exclude industry "${industryName}" to "${matchingIndustry.title}" (${matchingIndustry.id})`);
                } else {
                  this.logger.warn(`No match found for exclude industry: ${industryName}`);
                }
              } catch (error) {
                this.logger.warn(`Failed to resolve exclude industry: ${industryName}`, error);
              }
            }
            resolvedIndustry.exclude = excludeIndustryIds.length > 0 ? excludeIndustryIds : null;
          }
          
          resolvedParameters.industry = resolvedIndustry;
        }
      }

      // Resolve location parameters
      if (searchParameters.location) {
        // Handle Classic format (flat array)
        if (Array.isArray(searchParameters.location)) {
          const locationIds: string[] = [];
          const locationDisplay: Array<{ id: string; title: string }> = [];
          for (const locationName of searchParameters.location) {
            try {
              const locationParams = await this.linkedInSearchService.getLocationParameters(
                accountId,
                locationName,
                20
              );
              const matchingLocation = this.findBestMatch(locationParams.items, locationName);
              if (matchingLocation) {
                locationIds.push(matchingLocation.id);
                locationDisplay.push({ id: matchingLocation.id, title: matchingLocation.title });
                this.logger.log(`Resolved location "${locationName}" to "${matchingLocation.title}" (${matchingLocation.id})`);
              } else {
                this.logger.warn(`No match found for location: ${locationName}`);
              }
            } catch (error) {
              this.logger.warn(`Failed to resolve location: ${locationName}`, error);
            }
          }
          resolvedParameters.location = locationIds.length > 0 ? locationIds : undefined;
          // Include display fields for frontend use (will be stripped before LinkedIn API calls)
          resolvedParameters.location_display = locationDisplay.length > 0 ? locationDisplay : undefined;
        }
        // Handle Sales Navigator/Recruiter format (include/exclude objects)
        else if (searchParameters.location.include || searchParameters.location.exclude) {
          const resolvedLocation = { ...searchParameters.location };
          
          // Resolve include locations
          if (Array.isArray(searchParameters.location.include) && searchParameters.location.include.length > 0) {
            const locationIds: string[] = [];
            const locationDisplay: Array<{ id: string; title: string }> = [];
            for (const locationName of searchParameters.location.include) {
              try {
                const locationParams = await this.linkedInSearchService.getLocationParameters(
                  accountId,
                  locationName,
                  20
                );
                const matchingLocation = this.findBestMatch(locationParams.items, locationName);
                if (matchingLocation) {
                  locationIds.push(matchingLocation.id);
                  locationDisplay.push({ id: matchingLocation.id, title: matchingLocation.title });
                  this.logger.log(`Resolved location "${locationName}" to "${matchingLocation.title}" (${matchingLocation.id})`);
                } else {
                  this.logger.warn(`No match found for location: ${locationName}`);
                }
              } catch (error) {
                this.logger.warn(`Failed to resolve location: ${locationName}`, error);
              }
            }
            resolvedLocation.include = locationIds.length > 0 ? locationIds : null;
            resolvedParameters.location_display = locationDisplay.length > 0 ? locationDisplay : undefined;
          }
          
          // Resolve exclude locations
          if (Array.isArray(searchParameters.location.exclude) && searchParameters.location.exclude.length > 0) {
            const excludeLocationIds: string[] = [];
            for (const locationName of searchParameters.location.exclude) {
              try {
                const locationParams = await this.linkedInSearchService.getLocationParameters(
                  accountId,
                  locationName,
                  20
                );
                const matchingLocation = this.findBestMatch(locationParams.items, locationName);
                if (matchingLocation) {
                  excludeLocationIds.push(matchingLocation.id);
                  this.logger.log(`Resolved exclude location "${locationName}" to "${matchingLocation.title}" (${matchingLocation.id})`);
                } else {
                  this.logger.warn(`No match found for exclude location: ${locationName}`);
                }
              } catch (error) {
                this.logger.warn(`Failed to resolve exclude location: ${locationName}`, error);
              }
            }
            resolvedLocation.exclude = excludeLocationIds.length > 0 ? excludeLocationIds : null;
          }
          
          resolvedParameters.location = resolvedLocation;
        }
      }

      // Resolve company parameters
      if (searchParameters.company) {
        // Handle Classic format (flat array)
        if (Array.isArray(searchParameters.company)) {
          const companyIds: string[] = [];
          const companyDisplay: Array<{ id: string; title: string }> = [];
          for (const companyName of searchParameters.company) {
            try {
              const companyParams = await this.linkedInSearchService.getCompanyParameters(
                accountId,
                companyName,
                20
              );
              const matchingCompany = this.findBestMatch(companyParams.items, companyName);
              if (matchingCompany) {
                companyIds.push(matchingCompany.id);
                companyDisplay.push({ id: matchingCompany.id, title: matchingCompany.title });
                this.logger.log(`Resolved company "${companyName}" to "${matchingCompany.title}" (${matchingCompany.id})`);
              } else {
                this.logger.warn(`No match found for company: ${companyName}`);
              }
            } catch (error) {
              this.logger.warn(`Failed to resolve company: ${companyName}`, error);
            }
          }
          resolvedParameters.company = companyIds.length > 0 ? companyIds : undefined;
          // Include display fields for frontend use (will be stripped before LinkedIn API calls)
          resolvedParameters.company_display = companyDisplay.length > 0 ? companyDisplay : undefined;
        }
        // Handle Sales Navigator/Recruiter format (include/exclude objects)
        else if (searchParameters.company.include || searchParameters.company.exclude) {
          const resolvedCompany = { ...searchParameters.company };
          
          // Resolve include companies
          if (Array.isArray(searchParameters.company.include) && searchParameters.company.include.length > 0) {
            const companyIds: string[] = [];
            const companyDisplay: Array<{ id: string; title: string }> = [];
            for (const companyName of searchParameters.company.include) {
              try {
                const companyParams = await this.linkedInSearchService.getCompanyParameters(
                  accountId,
                  companyName,
                  20
                );
                const matchingCompany = this.findBestMatch(companyParams.items, companyName);
                if (matchingCompany) {
                  companyIds.push(matchingCompany.id);
                  companyDisplay.push({ id: matchingCompany.id, title: matchingCompany.title });
                  this.logger.log(`Resolved company "${companyName}" to "${matchingCompany.title}" (${matchingCompany.id})`);
                } else {
                  this.logger.warn(`No match found for company: ${companyName}`);
                }
              } catch (error) {
                this.logger.warn(`Failed to resolve company: ${companyName}`, error);
              }
            }
            resolvedCompany.include = companyIds.length > 0 ? companyIds : null;
            resolvedParameters.company_display = companyDisplay.length > 0 ? companyDisplay : undefined;
          }
          
          // Resolve exclude companies
          if (Array.isArray(searchParameters.company.exclude) && searchParameters.company.exclude.length > 0) {
            const excludeCompanyIds: string[] = [];
            for (const companyName of searchParameters.company.exclude) {
              try {
                const companyParams = await this.linkedInSearchService.getCompanyParameters(
                  accountId,
                  companyName,
                  20
                );
                const matchingCompany = this.findBestMatch(companyParams.items, companyName);
                if (matchingCompany) {
                  excludeCompanyIds.push(matchingCompany.id);
                  this.logger.log(`Resolved exclude company "${companyName}" to "${matchingCompany.title}" (${matchingCompany.id})`);
                } else {
                  this.logger.warn(`No match found for exclude company: ${companyName}`);
                }
              } catch (error) {
                this.logger.warn(`Failed to resolve exclude company: ${companyName}`, error);
              }
            }
            resolvedCompany.exclude = excludeCompanyIds.length > 0 ? excludeCompanyIds : null;
          }
          
          resolvedParameters.company = resolvedCompany;
        }
      }

      // Resolve school parameters
      if (searchParameters.school) {
        // Handle Classic format (flat array)
        if (Array.isArray(searchParameters.school)) {
          const schoolIds: string[] = [];
          const schoolDisplay: Array<{ id: string; title: string }> = [];
          for (const schoolName of searchParameters.school) {
            try {
              const schoolParams = await this.linkedInSearchService.getSchoolParameters(
                accountId,
                schoolName,
                20
              );
              const matchingSchool = this.findBestMatch(schoolParams.items, schoolName);
              if (matchingSchool) {
                schoolIds.push(matchingSchool.id);
                schoolDisplay.push({ id: matchingSchool.id, title: matchingSchool.title });
                this.logger.log(`Resolved school "${schoolName}" to "${matchingSchool.title}" (${matchingSchool.id})`);
              } else {
                this.logger.warn(`No match found for school: ${schoolName}`);
              }
            } catch (error) {
              this.logger.warn(`Failed to resolve school: ${schoolName}`, error);
            }
          }
          resolvedParameters.school = schoolIds.length > 0 ? schoolIds : undefined;
          // Include display fields for frontend use (will be stripped before LinkedIn API calls)
          resolvedParameters.school_display = schoolDisplay.length > 0 ? schoolDisplay : undefined;
        }
        // Handle Sales Navigator/Recruiter format (include/exclude objects)
        else if (searchParameters.school.include || searchParameters.school.exclude) {
          const resolvedSchool = { ...searchParameters.school };
          
          // Resolve include schools
          if (Array.isArray(searchParameters.school.include) && searchParameters.school.include.length > 0) {
            const schoolIds: string[] = [];
            const schoolDisplay: Array<{ id: string; title: string }> = [];
            for (const schoolName of searchParameters.school.include) {
              try {
                const schoolParams = await this.linkedInSearchService.getSchoolParameters(
                  accountId,
                  schoolName,
                  20
                );
                const matchingSchool = this.findBestMatch(schoolParams.items, schoolName);
                if (matchingSchool) {
                  schoolIds.push(matchingSchool.id);
                  schoolDisplay.push({ id: matchingSchool.id, title: matchingSchool.title });
                  this.logger.log(`Resolved school "${schoolName}" to "${matchingSchool.title}" (${matchingSchool.id})`);
                } else {
                  this.logger.warn(`No match found for school: ${schoolName}`);
                }
              } catch (error) {
                this.logger.warn(`Failed to resolve school: ${schoolName}`, error);
              }
            }
            resolvedSchool.include = schoolIds.length > 0 ? schoolIds : null;
            resolvedParameters.school_display = schoolDisplay.length > 0 ? schoolDisplay : undefined;
          }
          
          // Resolve exclude schools
          if (Array.isArray(searchParameters.school.exclude) && searchParameters.school.exclude.length > 0) {
            const excludeSchoolIds: string[] = [];
            for (const schoolName of searchParameters.school.exclude) {
              try {
                const schoolParams = await this.linkedInSearchService.getSchoolParameters(
                  accountId,
                  schoolName,
                  20
                );
                const matchingSchool = this.findBestMatch(schoolParams.items, schoolName);
                if (matchingSchool) {
                  excludeSchoolIds.push(matchingSchool.id);
                  this.logger.log(`Resolved exclude school "${schoolName}" to "${matchingSchool.title}" (${matchingSchool.id})`);
                } else {
                  this.logger.warn(`No match found for exclude school: ${schoolName}`);
                }
              } catch (error) {
                this.logger.warn(`Failed to resolve exclude school: ${schoolName}`, error);
              }
            }
            resolvedSchool.exclude = excludeSchoolIds.length > 0 ? excludeSchoolIds : null;
          }
          
          resolvedParameters.school = resolvedSchool;
        }
      }

      // Resolve past_company parameters
      if (searchParameters.past_company) {
        // Handle Classic format (flat array)
        if (Array.isArray(searchParameters.past_company)) {
          const pastCompanyIds: string[] = [];
          const pastCompanyDisplay: Array<{ id: string; title: string }> = [];
          for (const companyName of searchParameters.past_company) {
            try {
              const companyParams = await this.linkedInSearchService.getCompanyParameters(
                accountId,
                companyName,
                20
              );
              const matchingCompany = this.findBestMatch(companyParams.items, companyName);
              if (matchingCompany) {
                pastCompanyIds.push(matchingCompany.id);
                pastCompanyDisplay.push({ id: matchingCompany.id, title: matchingCompany.title });
                this.logger.log(`Resolved past company "${companyName}" to "${matchingCompany.title}" (${matchingCompany.id})`);
              } else {
                this.logger.warn(`No match found for past company: ${companyName}`);
              }
            } catch (error) {
              this.logger.warn(`Failed to resolve past company: ${companyName}`, error);
            }
          }
          resolvedParameters.past_company = pastCompanyIds.length > 0 ? pastCompanyIds : undefined;
          // Include display fields for frontend use (will be stripped before LinkedIn API calls)
          resolvedParameters.past_company_display = pastCompanyDisplay.length > 0 ? pastCompanyDisplay : undefined;
        }
        // Handle Sales Navigator/Recruiter format (include/exclude objects)
        else if (searchParameters.past_company.include || searchParameters.past_company.exclude) {
          const resolvedPastCompany = { ...searchParameters.past_company };
          
          // Resolve include past companies
          if (Array.isArray(searchParameters.past_company.include) && searchParameters.past_company.include.length > 0) {
            const pastCompanyIds: string[] = [];
            const pastCompanyDisplay: Array<{ id: string; title: string }> = [];
            for (const companyName of searchParameters.past_company.include) {
              try {
                const companyParams = await this.linkedInSearchService.getCompanyParameters(
                  accountId,
                  companyName,
                  20
                );
                const matchingCompany = this.findBestMatch(companyParams.items, companyName);
                if (matchingCompany) {
                  pastCompanyIds.push(matchingCompany.id);
                  pastCompanyDisplay.push({ id: matchingCompany.id, title: matchingCompany.title });
                  this.logger.log(`Resolved past company "${companyName}" to "${matchingCompany.title}" (${matchingCompany.id})`);
                } else {
                  this.logger.warn(`No match found for past company: ${companyName}`);
                }
              } catch (error) {
                this.logger.warn(`Failed to resolve past company: ${companyName}`, error);
              }
            }
            resolvedPastCompany.include = pastCompanyIds.length > 0 ? pastCompanyIds : null;
            resolvedParameters.past_company_display = pastCompanyDisplay.length > 0 ? pastCompanyDisplay : undefined;
          }
          
          // Resolve exclude past companies
          if (Array.isArray(searchParameters.past_company.exclude) && searchParameters.past_company.exclude.length > 0) {
            const excludePastCompanyIds: string[] = [];
            for (const companyName of searchParameters.past_company.exclude) {
              try {
                const companyParams = await this.linkedInSearchService.getCompanyParameters(
                  accountId,
                  companyName,
                  20
                );
                const matchingCompany = this.findBestMatch(companyParams.items, companyName);
                if (matchingCompany) {
                  excludePastCompanyIds.push(matchingCompany.id);
                  this.logger.log(`Resolved exclude past company "${companyName}" to "${matchingCompany.title}" (${matchingCompany.id})`);
                } else {
                  this.logger.warn(`No match found for exclude past company: ${companyName}`);
                }
              } catch (error) {
                this.logger.warn(`Failed to resolve exclude past company: ${companyName}`, error);
              }
            }
            resolvedPastCompany.exclude = excludePastCompanyIds.length > 0 ? excludePastCompanyIds : null;
          }
          
          resolvedParameters.past_company = resolvedPastCompany;
        }
      }

      return resolvedParameters;
    } catch (error) {
      this.logger.error('Failed to resolve parameter IDs', error);
      throw error;
    }
  }

  /**
   * Check if parameters are already resolved (contain LinkedIn IDs)
   */
  private checkIfParametersResolved(params: any): boolean {
    if (!params) return false;
    
    // Check if any parameter arrays contain LinkedIn IDs (typically numeric strings)
    const checkArray = (arr: any[]): boolean => {
      if (!Array.isArray(arr) || arr.length === 0) return false;
      return arr.some(item => 
        typeof item === 'string' && 
        (item.match(/^\d+$/) || item.includes('urn:li:'))
      );
    };
    
    // Check Classic format (flat arrays)
    const classicResolved = checkArray(params.industry) || 
                           checkArray(params.location) || 
                           checkArray(params.company) || 
                           checkArray(params.school) ||
                           checkArray(params.past_company);
    
    if (classicResolved) return true;
    
    // Check Sales Navigator/Recruiter format (include/exclude objects)
    const checkIncludeExclude = (param: any): boolean => {
      if (!param || typeof param !== 'object') return false;
      return checkArray(param.include) || checkArray(param.exclude);
    };
    
    const salesNavigatorResolved = checkIncludeExclude(params.industry) ||
                                  checkIncludeExclude(params.location) ||
                                  checkIncludeExclude(params.company) ||
                                  checkIncludeExclude(params.school) ||
                                  checkIncludeExclude(params.past_company);
    
    return salesNavigatorResolved;
  }

  /**
   * Preserve display information for already-resolved parameters
   */
  private async preserveDisplayInformation(params: any, accountId: string): Promise<any> {
    const preservedParams = { ...params };
    
    // If display information is missing, try to fetch it
    if (params.industry && Array.isArray(params.industry) && !params.industry_display) {
      const industryDisplay: Array<{ id: string; title: string }> = [];
      for (const industryId of params.industry) {
        try {
          // Try to get the industry name from LinkedIn API
          const industryParams = await this.linkedInSearchService.getIndustryParameters(
            accountId,
            '', // Empty search to get all industries
            1000 // Large limit to get all industries
          );
          const matchingIndustry = industryParams.items.find(item => item.id === industryId);
          if (matchingIndustry) {
            industryDisplay.push({ id: matchingIndustry.id, title: matchingIndustry.title });
          } else {
            // Fallback to using the ID as title
            industryDisplay.push({ id: industryId, title: industryId });
          }
        } catch (error) {
          this.logger.warn(`Failed to get industry display for ID ${industryId}:`, error);
          industryDisplay.push({ id: industryId, title: industryId });
        }
      }
      preservedParams.industry_display = industryDisplay;
    }
    
    // Similar logic for other parameter types...
    // For now, just preserve existing display information or use IDs as fallback
    if (params.location && Array.isArray(params.location) && !params.location_display) {
      preservedParams.location_display = params.location.map((id: string) => ({ id, title: id }));
    }
    if (params.company && Array.isArray(params.company) && !params.company_display) {
      preservedParams.company_display = params.company.map((id: string) => ({ id, title: id }));
    }
    if (params.school && Array.isArray(params.school) && !params.school_display) {
      preservedParams.school_display = params.school.map((id: string) => ({ id, title: id }));
    }
    
    return preservedParams;
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
