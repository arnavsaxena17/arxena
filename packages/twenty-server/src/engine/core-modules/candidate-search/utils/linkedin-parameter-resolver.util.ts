import { Injectable, Logger } from '@nestjs/common';
import { LinkedInSearchService } from '../../linkedin-search/services/linkedin-search.service';

@Injectable()
export class LinkedinParameterResolver {
  private readonly logger = new Logger(LinkedinParameterResolver.name);

  constructor(private readonly linkedInSearchService: LinkedInSearchService) {}

  /**
   * Check if a parameter value is already a LinkedIn ID (numeric string or URN)
   */
  private isAlreadyResolvedId(value: any): boolean {
    return typeof value === 'string' && 
           (!!value.match(/^\d+$/) || value.includes('urn:li:'));
  }

  /**
   * Resolve parameter names to LinkedIn IDs for search parameters
   */
  async resolveParameterIds(
    searchParameters: any,
    accountId: string,
    strategyId?: string,
  ): Promise<any> {
    try {
      this.logger.log(`[Strategy: ${strategyId}] Resolving parameter IDs for search parameters`);
      
      if (!searchParameters) {
        this.logger.warn(`[Strategy: ${strategyId}] Search parameters are null or undefined, returning empty object`);
        return {};
      }
      
      const resolvedParameters = { ...searchParameters } as any;
      
      // Check if parameters are already resolved (contain LinkedIn IDs)
      const areParametersResolved = this.checkIfParametersResolved(searchParameters);
      
      if (areParametersResolved) {
        this.logger.log(`[Strategy: ${strategyId}] Parameters are already resolved, preserving display information`);
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
          for (const industryItem of searchParameters.industry) {
            // Skip if already an ID (from cache)
            if (this.isAlreadyResolvedId(industryItem)) {
              industryIds.push(industryItem);
              // Try to preserve existing display info or use ID as fallback
              const existingDisplay = (searchParameters as any).industry_display?.find(
                (d: { id: string }) => d.id === industryItem
              );
              industryDisplay.push(existingDisplay || { id: industryItem, title: industryItem });
              continue;
            }

            // Only resolve if it's a name (not an ID)
            try {
              const industryParams = await this.linkedInSearchService.getIndustryParameters(
                accountId,
                industryItem,
                20
              );
              const matchingIndustry = this.findBestMatch(industryParams.items, industryItem);
              if (matchingIndustry) {
                industryIds.push(matchingIndustry.id);
                industryDisplay.push({ id: matchingIndustry.id, title: matchingIndustry.title });
                this.logger.log(`[Strategy: ${strategyId}] Resolved industry "${industryItem}" to "${matchingIndustry.title}" (${matchingIndustry.id})`);
              } else {
                this.logger.warn(`[Strategy: ${strategyId}] No match found for industry: ${industryItem}`);
              }
            } catch (error) {
              this.logger.warn(`[Strategy: ${strategyId}] Failed to resolve industry: ${industryItem}`, error);
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
            for (const industryItem of searchParameters.industry.include) {
              if (this.isAlreadyResolvedId(industryItem)) {
                industryIds.push(industryItem);
                const existingDisplay = (searchParameters as any).industry_display?.find(
                  (d: { id: string }) => d.id === industryItem
                );
                industryDisplay.push(existingDisplay || { id: industryItem, title: industryItem });
                continue;
              }

              try {
                const industryParams = await this.linkedInSearchService.getIndustryParameters(
                  accountId,
                  industryItem,
                  20
                );
              const matchingIndustry = this.findBestMatch(industryParams.items, industryItem);
              if (matchingIndustry) {
                industryIds.push(matchingIndustry.id);
                industryDisplay.push({ id: matchingIndustry.id, title: matchingIndustry.title });
                this.logger.log(`[Strategy: ${strategyId}] Resolved industry "${industryItem}" to "${matchingIndustry.title}" (${matchingIndustry.id})`);
              } else {
                this.logger.warn(`[Strategy: ${strategyId}] No match found for industry: ${industryItem}`);
              }
            } catch (error) {
              this.logger.warn(`[Strategy: ${strategyId}] Failed to resolve industry: ${industryItem}`, error);
              }
            }
            resolvedIndustry.include = industryIds.length > 0 ? industryIds : null;
            resolvedParameters.industry_display = industryDisplay.length > 0 ? industryDisplay : undefined;
          }
          
          // Resolve exclude industries
          if (Array.isArray(searchParameters.industry.exclude) && searchParameters.industry.exclude.length > 0) {
            const excludeIndustryIds: string[] = [];
            for (const industryItem of searchParameters.industry.exclude) {
              if (this.isAlreadyResolvedId(industryItem)) {
                excludeIndustryIds.push(industryItem);
                continue;
              }

              try {
                const industryParams = await this.linkedInSearchService.getIndustryParameters(
                  accountId,
                  industryItem,
                  20
                );
                const matchingIndustry = this.findBestMatch(industryParams.items, industryItem);
                if (matchingIndustry) {
                  excludeIndustryIds.push(matchingIndustry.id);
                  this.logger.log(`[Strategy: ${strategyId}] Resolved exclude industry "${industryItem}" to "${matchingIndustry.title}" (${matchingIndustry.id})`);
                } else {
                  this.logger.warn(`[Strategy: ${strategyId}] No match found for exclude industry: ${industryItem}`);
                }
              } catch (error) {
                this.logger.warn(`[Strategy: ${strategyId}] Failed to resolve exclude industry: ${industryItem}`, error);
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
          for (const locationItem of searchParameters.location) {
            // Skip if already an ID (from cache)
            if (this.isAlreadyResolvedId(locationItem)) {
              locationIds.push(locationItem);
              const existingDisplay = (searchParameters as any).location_display?.find(
                (d: { id: string }) => d.id === locationItem
              );
              locationDisplay.push(existingDisplay || { id: locationItem, title: locationItem });
              continue;
            }

            // Only resolve if it's a name (not an ID)
            try {
              const locationParams = await this.linkedInSearchService.getLocationParameters(
                accountId,
                locationItem,
                20
              );
              const matchingLocation = this.findBestMatch(locationParams.items, locationItem);
              if (matchingLocation) {
                locationIds.push(matchingLocation.id);
                locationDisplay.push({ id: matchingLocation.id, title: matchingLocation.title });
                this.logger.log(`[Strategy: ${strategyId}] Resolved location "${locationItem}" to "${matchingLocation.title}" (${matchingLocation.id})`);
              } else {
                this.logger.warn(`[Strategy: ${strategyId}] No match found for location: ${locationItem}`);
              }
              } catch (error) {
                this.logger.warn(`[Strategy: ${strategyId}] Failed to resolve location: ${locationItem}`, error);
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
            for (const locationItem of searchParameters.location.include) {
              if (this.isAlreadyResolvedId(locationItem)) {
                locationIds.push(locationItem);
                const existingDisplay = (searchParameters as any).location_display?.find(
                  (d: { id: string }) => d.id === locationItem
                );
                locationDisplay.push(existingDisplay || { id: locationItem, title: locationItem });
                continue;
              }

              try {
                const locationParams = await this.linkedInSearchService.getLocationParameters(
                  accountId,
                  locationItem,
                  20
                );
                const matchingLocation = this.findBestMatch(locationParams.items, locationItem);
                if (matchingLocation) {
                  locationIds.push(matchingLocation.id);
                  locationDisplay.push({ id: matchingLocation.id, title: matchingLocation.title });
                  this.logger.log(`[Strategy: ${strategyId}] Resolved location "${locationItem}" to "${matchingLocation.title}" (${matchingLocation.id})`);
                } else {
                  this.logger.warn(`[Strategy: ${strategyId}] No match found for location: ${locationItem}`);
                }
              } catch (error) {
                this.logger.warn(`[Strategy: ${strategyId}] Failed to resolve location: ${locationItem}`, error);
              }
            }
            resolvedLocation.include = locationIds.length > 0 ? locationIds : null;
            resolvedParameters.location_display = locationDisplay.length > 0 ? locationDisplay : undefined;
          }
          
          // Resolve exclude locations
          if (Array.isArray(searchParameters.location.exclude) && searchParameters.location.exclude.length > 0) {
            const excludeLocationIds: string[] = [];
            for (const locationItem of searchParameters.location.exclude) {
              if (this.isAlreadyResolvedId(locationItem)) {
                excludeLocationIds.push(locationItem);
                continue;
              }

              try {
                const locationParams = await this.linkedInSearchService.getLocationParameters(
                  accountId,
                  locationItem,
                  20
                );
                const matchingLocation = this.findBestMatch(locationParams.items, locationItem);
                if (matchingLocation) {
                  excludeLocationIds.push(matchingLocation.id);
                  this.logger.log(`[Strategy: ${strategyId}] Resolved exclude location "${locationItem}" to "${matchingLocation.title}" (${matchingLocation.id})`);
                } else {
                  this.logger.warn(`[Strategy: ${strategyId}] No match found for exclude location: ${locationItem}`);
                }
              } catch (error) {
                this.logger.warn(`[Strategy: ${strategyId}] Failed to resolve exclude location: ${locationItem}`, error);
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
          for (const companyItem of searchParameters.company) {
            // Skip if already an ID (from cache)
            if (this.isAlreadyResolvedId(companyItem)) {
              companyIds.push(companyItem);
              const existingDisplay = (searchParameters as any).company_display?.find(
                (d: { id: string }) => d.id === companyItem
              );
              companyDisplay.push(existingDisplay || { id: companyItem, title: companyItem });
              continue;
            }

            // Only resolve if it's a name (not an ID)
            try {
              const companyParams = await this.linkedInSearchService.getCompanyParameters(
                accountId,
                companyItem,
                20
              );
              const matchingCompany = this.findBestMatch(companyParams.items, companyItem);
              if (matchingCompany) {
                companyIds.push(matchingCompany.id);
                companyDisplay.push({ id: matchingCompany.id, title: matchingCompany.title });
                this.logger.log(`[Strategy: ${strategyId}] Resolved company "${companyItem}" to "${matchingCompany.title}" (${matchingCompany.id})`);
              } else {
                this.logger.warn(`[Strategy: ${strategyId}] No match found for company: ${companyItem}`);
              }
            } catch (error) {
              this.logger.warn(`[Strategy: ${strategyId}] Failed to resolve company: ${companyItem}`, error);
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
            for (const companyItem of searchParameters.company.include) {
              if (this.isAlreadyResolvedId(companyItem)) {
                companyIds.push(companyItem);
                const existingDisplay = (searchParameters as any).company_display?.find(
                  (d: { id: string }) => d.id === companyItem
                );
                companyDisplay.push(existingDisplay || { id: companyItem, title: companyItem });
                continue;
              }

              try {
                const companyParams = await this.linkedInSearchService.getCompanyParameters(
                  accountId,
                  companyItem,
                  20
                );
                const matchingCompany = this.findBestMatch(companyParams.items, companyItem);
                if (matchingCompany) {
                  companyIds.push(matchingCompany.id);
                  companyDisplay.push({ id: matchingCompany.id, title: matchingCompany.title });
                  this.logger.log(`[Strategy: ${strategyId}] Resolved company "${companyItem}" to "${matchingCompany.title}" (${matchingCompany.id})`);
                } else {
                  this.logger.warn(`[Strategy: ${strategyId}] No match found for company: ${companyItem}`);
                }
              } catch (error) {
                this.logger.warn(`[Strategy: ${strategyId}] Failed to resolve company: ${companyItem}`, error);
              }
            }
            resolvedCompany.include = companyIds.length > 0 ? companyIds : null;
            resolvedParameters.company_display = companyDisplay.length > 0 ? companyDisplay : undefined;
          }
          
          // Resolve exclude companies
          if (Array.isArray(searchParameters.company.exclude) && searchParameters.company.exclude.length > 0) {
            const excludeCompanyIds: string[] = [];
            for (const companyItem of searchParameters.company.exclude) {
              if (this.isAlreadyResolvedId(companyItem)) {
                excludeCompanyIds.push(companyItem);
                continue;
              }

              try {
                const companyParams = await this.linkedInSearchService.getCompanyParameters(
                  accountId,
                  companyItem,
                  20
                );
                const matchingCompany = this.findBestMatch(companyParams.items, companyItem);
                if (matchingCompany) {
                  excludeCompanyIds.push(matchingCompany.id);
                  this.logger.log(`[Strategy: ${strategyId}] Resolved exclude company "${companyItem}" to "${matchingCompany.title}" (${matchingCompany.id})`);
                } else {
                  this.logger.warn(`[Strategy: ${strategyId}] No match found for exclude company: ${companyItem}`);
                }
              } catch (error) {
                this.logger.warn(`[Strategy: ${strategyId}] Failed to resolve exclude company: ${companyItem}`, error);
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
          for (const schoolItem of searchParameters.school) {
            // Skip if already an ID (from cache)
            if (this.isAlreadyResolvedId(schoolItem)) {
              schoolIds.push(schoolItem);
              const existingDisplay = (searchParameters as any).school_display?.find(
                (d: { id: string }) => d.id === schoolItem
              );
              schoolDisplay.push(existingDisplay || { id: schoolItem, title: schoolItem });
              continue;
            }

            // Only resolve if it's a name (not an ID)
            try {
              const schoolParams = await this.linkedInSearchService.getSchoolParameters(
                accountId,
                schoolItem,
                20
              );
              const matchingSchool = this.findBestMatch(schoolParams.items, schoolItem);
              if (matchingSchool) {
                schoolIds.push(matchingSchool.id);
                schoolDisplay.push({ id: matchingSchool.id, title: matchingSchool.title });
                this.logger.log(`[Strategy: ${strategyId}] Resolved school "${schoolItem}" to "${matchingSchool.title}" (${matchingSchool.id})`);
              } else {
                this.logger.warn(`[Strategy: ${strategyId}] No match found for school: ${schoolItem}`);
              }
            } catch (error) {
              this.logger.warn(`[Strategy: ${strategyId}] Failed to resolve school: ${schoolItem}`, error);
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
            for (const schoolItem of searchParameters.school.include) {
              if (this.isAlreadyResolvedId(schoolItem)) {
                schoolIds.push(schoolItem);
                const existingDisplay = (searchParameters as any).school_display?.find(
                  (d: { id: string }) => d.id === schoolItem
                );
                schoolDisplay.push(existingDisplay || { id: schoolItem, title: schoolItem });
                continue;
              }

              try {
                const schoolParams = await this.linkedInSearchService.getSchoolParameters(
                  accountId,
                  schoolItem,
                  20
                );
                const matchingSchool = this.findBestMatch(schoolParams.items, schoolItem);
                if (matchingSchool) {
                  schoolIds.push(matchingSchool.id);
                  schoolDisplay.push({ id: matchingSchool.id, title: matchingSchool.title });
                  this.logger.log(`[Strategy: ${strategyId}] Resolved school "${schoolItem}" to "${matchingSchool.title}" (${matchingSchool.id})`);
                } else {
                  this.logger.warn(`[Strategy: ${strategyId}] No match found for school: ${schoolItem}`);
                }
              } catch (error) {
                this.logger.warn(`[Strategy: ${strategyId}] Failed to resolve school: ${schoolItem}`, error);
              }
            }
            resolvedSchool.include = schoolIds.length > 0 ? schoolIds : null;
            resolvedParameters.school_display = schoolDisplay.length > 0 ? schoolDisplay : undefined;
          }
          
          // Resolve exclude schools
          if (Array.isArray(searchParameters.school.exclude) && searchParameters.school.exclude.length > 0) {
            const excludeSchoolIds: string[] = [];
            for (const schoolItem of searchParameters.school.exclude) {
              if (this.isAlreadyResolvedId(schoolItem)) {
                excludeSchoolIds.push(schoolItem);
                continue;
              }

              try {
                const schoolParams = await this.linkedInSearchService.getSchoolParameters(
                  accountId,
                  schoolItem,
                  20
                );
                const matchingSchool = this.findBestMatch(schoolParams.items, schoolItem);
                if (matchingSchool) {
                  excludeSchoolIds.push(matchingSchool.id);
                  this.logger.log(`[Strategy: ${strategyId}] Resolved exclude school "${schoolItem}" to "${matchingSchool.title}" (${matchingSchool.id})`);
                } else {
                  this.logger.warn(`[Strategy: ${strategyId}] No match found for exclude school: ${schoolItem}`);
                }
              } catch (error) {
                this.logger.warn(`[Strategy: ${strategyId}] Failed to resolve exclude school: ${schoolItem}`, error);
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
          for (const companyItem of searchParameters.past_company) {
            // Skip if already an ID (from cache)
            if (this.isAlreadyResolvedId(companyItem)) {
              pastCompanyIds.push(companyItem);
              const existingDisplay = (searchParameters as any).past_company_display?.find(
                (d: { id: string }) => d.id === companyItem
              );
              pastCompanyDisplay.push(existingDisplay || { id: companyItem, title: companyItem });
              continue;
            }

            // Only resolve if it's a name (not an ID)
            try {
              const companyParams = await this.linkedInSearchService.getCompanyParameters(
                accountId,
                companyItem,
                20
              );
              const matchingCompany = this.findBestMatch(companyParams.items, companyItem);
              if (matchingCompany) {
                pastCompanyIds.push(matchingCompany.id);
                pastCompanyDisplay.push({ id: matchingCompany.id, title: matchingCompany.title });
                this.logger.log(`[Strategy: ${strategyId}] Resolved past company "${companyItem}" to "${matchingCompany.title}" (${matchingCompany.id})`);
              } else {
                this.logger.warn(`[Strategy: ${strategyId}] No match found for past company: ${companyItem}`);
              }
            } catch (error) {
              this.logger.warn(`[Strategy: ${strategyId}] Failed to resolve past company: ${companyItem}`, error);
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
            for (const companyItem of searchParameters.past_company.include) {
              if (this.isAlreadyResolvedId(companyItem)) {
                pastCompanyIds.push(companyItem);
                const existingDisplay = (searchParameters as any).past_company_display?.find(
                  (d: { id: string }) => d.id === companyItem
                );
                pastCompanyDisplay.push(existingDisplay || { id: companyItem, title: companyItem });
                continue;
              }

              try {
                const companyParams = await this.linkedInSearchService.getCompanyParameters(
                  accountId,
                  companyItem,
                  20
                );
                const matchingCompany = this.findBestMatch(companyParams.items, companyItem);
                if (matchingCompany) {
                  pastCompanyIds.push(matchingCompany.id);
                  pastCompanyDisplay.push({ id: matchingCompany.id, title: matchingCompany.title });
                  this.logger.log(`[Strategy: ${strategyId}] Resolved past company "${companyItem}" to "${matchingCompany.title}" (${matchingCompany.id})`);
                } else {
                  this.logger.warn(`[Strategy: ${strategyId}] No match found for past company: ${companyItem}`);
                }
              } catch (error) {
                this.logger.warn(`[Strategy: ${strategyId}] Failed to resolve past company: ${companyItem}`, error);
              }
            }
            resolvedPastCompany.include = pastCompanyIds.length > 0 ? pastCompanyIds : null;
            resolvedParameters.past_company_display = pastCompanyDisplay.length > 0 ? pastCompanyDisplay : undefined;
          }
          
          // Resolve exclude past companies
          if (Array.isArray(searchParameters.past_company.exclude) && searchParameters.past_company.exclude.length > 0) {
            const excludePastCompanyIds: string[] = [];
            for (const companyItem of searchParameters.past_company.exclude) {
              if (this.isAlreadyResolvedId(companyItem)) {
                excludePastCompanyIds.push(companyItem);
                continue;
              }

              try {
                const companyParams = await this.linkedInSearchService.getCompanyParameters(
                  accountId,
                  companyItem,
                  20
                );
                const matchingCompany = this.findBestMatch(companyParams.items, companyItem);
                if (matchingCompany) {
                  excludePastCompanyIds.push(matchingCompany.id);
                  this.logger.log(`[Strategy: ${strategyId}] Resolved exclude past company "${companyItem}" to "${matchingCompany.title}" (${matchingCompany.id})`);
                } else {
                  this.logger.warn(`[Strategy: ${strategyId}] No match found for exclude past company: ${companyItem}`);
                }
              } catch (error) {
                this.logger.warn(`[Strategy: ${strategyId}] Failed to resolve exclude past company: ${companyItem}`, error);
              }
            }
            resolvedPastCompany.exclude = excludePastCompanyIds.length > 0 ? excludePastCompanyIds : null;
          }
          
          resolvedParameters.past_company = resolvedPastCompany;
        }
      }

      this.logger.log(`[Strategy: ${strategyId}] Completed resolving parameter IDs`);
      return resolvedParameters;
    } catch (error) {
      this.logger.error(`[Strategy: ${strategyId}] Failed to resolve parameter IDs`, error);
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
          // Note: LinkedIn API has a maximum limit of 100
          const industryParams = await this.linkedInSearchService.getIndustryParameters(
            accountId,
            '', // Empty search to get all industries
            10 // Maximum allowed limit
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
