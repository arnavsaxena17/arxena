import { Logger } from '@nestjs/common';
import {
    LinkedInClassicCompaniesSearchRequest,
    LinkedInClassicJobsSearchRequest,
    LinkedInClassicPeopleSearchRequest,
} from '../../linkedin-search/types/linkedin-search-request.type';

export class ParameterSanitizer {
  private readonly logger = new Logger(ParameterSanitizer.name);

  /**
   * Sanitize LinkedIn Classic People Search request to remove parameters that require numeric IDs
   */
  sanitizeClassicPeopleSearchRequest(
    request: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
  ): Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'> {
    const sanitized: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'> = {};

    // Only include keywords if present and non-empty
    if (typeof request.keywords === 'string' && request.keywords.trim().length > 0) {
      // sanitized.keywords = request.keywords;
    }

    // Only include industry if present and contains valid numeric IDs
    if (Array.isArray(request.industry) && request.industry.length > 0) {
      const validIndustryIds = request.industry.filter(id => /^\d+$/.test(id));
      if (validIndustryIds.length > 0) {
        sanitized.industry = validIndustryIds;
      }
    }

    // Only include location if present and contains valid numeric IDs
    if (Array.isArray(request.location) && request.location.length > 0) {
      const validLocationIds = request.location.filter(id => /^\d+$/.test(id));
      if (validLocationIds.length > 0) {
        sanitized.location = validLocationIds;
      }
    }

    // Always include network_distance if present and is a non-empty array
    if (Array.isArray(request.network_distance) && request.network_distance.length > 0) {
      sanitized.network_distance = request.network_distance;
    }

    // Only include company if present and contains valid numeric IDs
    if (Array.isArray(request.company) && request.company.length > 0) {
      const validCompanyIds = request.company.filter(id => /^\d+$/.test(id));
      if (validCompanyIds.length > 0) {
        sanitized.company = validCompanyIds;
      }
    }

    // Only include past_company if present and contains valid numeric IDs
    if (Array.isArray(request.past_company) && request.past_company.length > 0) {
      const validPastCompanyIds = request.past_company.filter(id => /^\d+$/.test(id));
      if (validPastCompanyIds.length > 0) {
        sanitized.past_company = validPastCompanyIds;
      }
    }

    // Only include school if present and contains valid numeric IDs
    if (Array.isArray(request.school) && request.school.length > 0) {
      const validSchoolIds = request.school.filter(id => /^\d+$/.test(id));
      if (validSchoolIds.length > 0) {
        sanitized.school = validSchoolIds;
      }
    }

    // Only include service if present and contains valid numeric IDs
    if (Array.isArray(request.service) && request.service.length > 0) {
      const validServiceIds = request.service.filter(id => /^\d+$/.test(id));
      if (validServiceIds.length > 0) {
        sanitized.service = validServiceIds;
      }
    }

    // Always include advanced_keywords if present
    if (request.advanced_keywords) {
      // sanitized.advanced_keywords = request.advanced_keywords;
    }

    // Only include profile_language if present and non-empty
    if (request.profile_language) {
      // sanitized.profile_language = request.profile_language;
    }

    // Only include connections_of if present and non-empty
    if (request.connections_of) {
      // sanitized.connections_of = request.connections_of;
    }

    // Only include followers_of if present and non-empty
    if (request.followers_of) {
      sanitized.followers_of = request.followers_of;
    }

    // Only include open_to if present and non-empty
    if (request.open_to) {
      sanitized.open_to = request.open_to;
    }
    
    this.logger.log('Sanitized LinkedIn Classic People Search request:', sanitized);
    return sanitized;
  }

  /**
   * Sanitize LinkedIn Classic Companies Search request to remove parameters that require numeric IDs
   */
  sanitizeClassicCompaniesSearchRequest(
    request: Omit<LinkedInClassicCompaniesSearchRequest, 'api' | 'category'>
  ): Omit<LinkedInClassicCompaniesSearchRequest, 'api' | 'category'> {
    const sanitized: Omit<LinkedInClassicCompaniesSearchRequest, 'api' | 'category'> = {};

    // Only include keywords if present and non-empty
    if (typeof request.keywords === 'string' && request.keywords.trim().length > 0) {
      sanitized.keywords = request.keywords;
    }

    // Only include industry if present and contains valid numeric IDs
    if (Array.isArray(request.industry) && request.industry.length > 0) {
      const validIndustryIds = request.industry.filter(id => /^\d+$/.test(id));
      if (validIndustryIds.length > 0) {
        sanitized.industry = validIndustryIds;
      }
    }

    // Only include location if present and contains valid numeric IDs
    if (Array.isArray(request.location) && request.location.length > 0) {
      const validLocationIds = request.location.filter(id => /^\d+$/.test(id));
      if (validLocationIds.length > 0) {
        sanitized.location = validLocationIds;
      }
    }

    // Only include non-null parameters
    if (request.has_job_offers !== undefined && request.has_job_offers !== null) {
      sanitized.has_job_offers = request.has_job_offers;
    }
    if (request.headcount) {
      sanitized.headcount = request.headcount;
    }
    if (request.network_distance) {
      sanitized.network_distance = request.network_distance;
    }
    
    this.logger.log('Sanitized LinkedIn Classic Companies Search request:', sanitized);
    return sanitized;
  }

  /**
   * Sanitize LinkedIn Classic Jobs Search request to remove parameters that require numeric IDs
   */
  sanitizeClassicJobsSearchRequest(
    request: Omit<LinkedInClassicJobsSearchRequest, 'api' | 'category'>
  ): Omit<LinkedInClassicJobsSearchRequest, 'api' | 'category'> {
    const sanitized: Omit<LinkedInClassicJobsSearchRequest, 'api' | 'category'> = {};

    // Only include keywords if present and non-empty
    if (typeof request.keywords === 'string' && request.keywords.trim().length > 0) {
      sanitized.keywords = request.keywords;
    }

    // Only include region if present and is a valid numeric ID
    if (typeof request.region === 'string' && /^\d+$/.test(request.region)) {
      sanitized.region = request.region;
    }

    // Only include location if present and contains valid numeric IDs
    if (Array.isArray(request.location) && request.location.length > 0) {
      const validLocationIds = request.location.filter(id => /^\d+$/.test(id));
      if (validLocationIds.length > 0) {
        sanitized.location = validLocationIds;
      }
    }

    // Only include industry if present and contains valid numeric IDs
    if (Array.isArray(request.industry) && request.industry.length > 0) {
      const validIndustryIds = request.industry.filter(id => /^\d+$/.test(id));
      if (validIndustryIds.length > 0) {
        sanitized.industry = validIndustryIds;
      }
    }

    // Only include function if present and contains valid IDs (alphanumeric pattern)
    if (Array.isArray(request.function) && request.function.length > 0) {
      const validFunctionIds = request.function.filter(id => /^[a-z]+$/.test(id));
      if (validFunctionIds.length > 0) {
        sanitized.function = validFunctionIds;
      }
    }

    // Only include role if present and contains valid numeric IDs
    if (Array.isArray(request.role) && request.role.length > 0) {
      const validRoleIds = request.role.filter(id => /^\d+$/.test(id));
      if (validRoleIds.length > 0) {
        sanitized.role = validRoleIds;
      }
    }

    // Only include company if present and contains valid numeric IDs
    if (Array.isArray(request.company) && request.company.length > 0) {
      const validCompanyIds = request.company.filter(id => /^\d+$/.test(id));
      if (validCompanyIds.length > 0) {
        sanitized.company = validCompanyIds;
      }
    }

    // Only include non-null parameters
    if (request.sort_by) {
      sanitized.sort_by = request.sort_by;
    }
    if (request.date_posted !== undefined && request.date_posted !== null) {
      sanitized.date_posted = request.date_posted;
    }
    if (request.location_within_area !== undefined && request.location_within_area !== null) {
      sanitized.location_within_area = request.location_within_area;
    }
    if (request.seniority) {
      sanitized.seniority = request.seniority;
    }
    if (request.job_type) {
      sanitized.job_type = request.job_type;
    }
    if (request.presence) {
      sanitized.presence = request.presence;
    }
    if (request.easy_apply !== undefined && request.easy_apply !== null) {
      sanitized.easy_apply = request.easy_apply;
    }
    if (request.has_verifications !== undefined && request.has_verifications !== null) {
      sanitized.has_verifications = request.has_verifications;
    }
    if (request.under_10_applicants !== undefined && request.under_10_applicants !== null) {
      sanitized.under_10_applicants = request.under_10_applicants;
    }
    if (request.in_your_network !== undefined && request.in_your_network !== null) {
      sanitized.in_your_network = request.in_your_network;
    }
    if (request.fair_chance_employer !== undefined && request.fair_chance_employer !== null) {
      sanitized.fair_chance_employer = request.fair_chance_employer;
    }
    if (request.benefits) {
      sanitized.benefits = request.benefits;
    }
    if (request.commitments) {
      sanitized.commitments = request.commitments;
    }
    if (request.minimum_salary) {
      sanitized.minimum_salary = request.minimum_salary;
    }
    
    this.logger.log('Sanitized LinkedIn Classic Jobs Search request:', sanitized);
    return sanitized;
  }
}
