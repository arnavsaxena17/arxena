import { Injectable } from '@nestjs/common';
import { UserProfile } from 'twenty-shared';
import { LinkedInPeopleSearchResult, LinkedInSearchResult } from '../../../linkedin-search/types/linkedin-search-response.type';
import { DataProcessingUtils } from '../../utils/data-processing.utils';
import { BaseDataSourceTransformerService, TransformationContext } from './base-data-source-transformer.service';

/**
 * Extended UserProfile type for DataTable display with UI-specific fields
 * Omits conflicting fields from UserProfile and redefines them for Handsontable compatibility
 */
export type TransformedCandidateForTable = Omit<
  UserProfile,
  'phoneNumber' | 'emailAddress' | 'linkedinUrl'
> & {
  // DataTable UI-specific fields
  __isFetched?: boolean;
  tempId?: string;
  
  // Handsontable-compatible field overrides (wrap strings in objects for consistency)
  phoneNumber: string;
  email: string;
  linkedinUrl?: string;
  hiringNaukriUrl?: string;
  resdexNaukriUrl?: string;
  displayPicture?: string;
  
  // UI state fields
  candConversationStatus: string;
  status: string;
  startChat: boolean;
  stopChat: boolean;
  startChatCompleted: boolean;
  startVideoInterviewChat: boolean;
  startVideoInterviewChatCompleted: boolean;
  startMeetingSchedulingChat: boolean;
  startMeetingSchedulingChatCompleted: boolean;
  engagementStatus: boolean;
  messagingChannel: string;
  chatCount: number;
  lastEngagementChatControl: any;
  
  // Relationship edges
  whatsappMessages: { edges: any[] };
  emailMessages: { edges: any[] };
  otherFields?: Record<string, unknown>;
  candidateReminders: { edges: any[] };
  jobs: { id: string; name: string };
  people: { id: string };
  attachments: any;
  videoInterview: any;
  whatsappProvider: string;
  input: string;
  clientInterview?: any;
  remarks?: string;
  
  // LinkedIn-specific display fields
  name: string;
  headline?: string;
  profilePictureUrl?: string;
  networkDistance?: string;
  premium?: boolean;
  verified?: boolean;
  sharedConnectionsCount?: number;
  followersCount?: number;
  keywordsMatch?: string;
  
  // Relevance scoring fields
  relevanceScore?: number; // 0-1 relevance score
  relevanceLabel?: 'highly_relevant' | 'somewhat_relevant' | 'less_relevant';
  matchReasons?: string[];
  mismatchReasons?: string[];
  
  // Naming aliases for backwards compatibility
  jobTitle: string;
  company: string;
  location: string;
  peopleId: string | null;
  updatedAt: string;
  createdAt: string;

  /** Set by addMetadataToCandidates (LinkedIn search / org-chart pipelines). */
  campaign?: string;
  source?: string;

  /**
   * Opaque contact hints from the active provider (public slug, e.g. m7kqHasEmail).
   * @see orgChartProviderContactHintRowKeys in merge-orgchart-profile-source-slugs.util
   */
  m7kqHasEmail?: boolean;
  m7kqHasDirectPhone?: boolean;
  m7kqHasOrgPhone?: boolean;
}

@Injectable()
export class LinkedInSearchTransformerService extends BaseDataSourceTransformerService {
  constructor(dataProcessingUtils: DataProcessingUtils) {
    super(dataProcessingUtils);
  }
  
  getDataSourceIdentifier(): string {
    return 'linkedin_search';
  }

  transformToUserProfile(
    candidateData: LinkedInSearchResult,
    context: TransformationContext
  ): UserProfile {
    // Cast to LinkedInPeopleSearchResult since this transformer handles people search results
    const peopleData = candidateData as LinkedInPeopleSearchResult;
    const userProfile = this.createBaseUserProfile(peopleData, context);
    
    // Process LinkedIn-specific data
    this.processLinkedInProfileData(peopleData, userProfile);
    this.processLinkedInContactData(peopleData, userProfile);
    this.processLinkedInExperienceData(peopleData, userProfile);
    this.processLinkedInEducationData(peopleData, userProfile);
    this.processLinkedInSkillsData(peopleData, userProfile);
    
    // Ensure uniqueStringKey is properly generated after all data is processed
    this.ensureUniqueStringKey(userProfile, peopleData);
    return userProfile;
  }

  private processLinkedInProfileData(candidateData: LinkedInPeopleSearchResult, userProfile: UserProfile): void {
    if (candidateData.name) {
      const nameParts = candidateData.name.split(' ');
      userProfile.firstName = nameParts[0] || '';
      userProfile.lastName = nameParts.slice(1).join(' ') || '';
    }

    if (candidateData.first_name) {
      userProfile.firstName = candidateData.first_name;
    }

    if (candidateData.last_name) {
      userProfile.lastName = candidateData.last_name;
    }

    if (candidateData.headline) {
      userProfile.linkedinHeadline = candidateData.headline;
    }

    if (candidateData.location) {
      userProfile.locationName = candidateData.location;
    }

    if (candidateData.industry) {
      userProfile.industry = candidateData.industry;
    }

    // LinkedIn-specific fields
    if (candidateData.public_identifier) {
      userProfile.linkedinUrl = `https://www.linkedin.com/in/${candidateData.public_identifier}`;
    } else if (candidateData.profile_url) {
      userProfile.linkedinUrl = candidateData.profile_url;
    }

    if (candidateData.public_profile_url) {
      userProfile.profileUrl = candidateData.public_profile_url;
    }

    if (candidateData.profile_picture_url) {
      userProfile.displayPicture = candidateData.profile_picture_url;
    }

    // Store LinkedIn-specific data in linkedinSpecificData
    if (candidateData.network_distance || candidateData.premium || candidateData.open_profile) {
      userProfile.linkedinSpecificData = {
        ...userProfile.linkedinSpecificData,
        networkDistance: candidateData.network_distance,
        isPremium: candidateData.premium,
        isOpenProfile: candidateData.open_profile,
      };
    }

    // Add job process event
    this.addJobProcessEvent(userProfile, 'linkedin_profile_processed', {
      profileUrl: candidateData.profile_url,
      publicProfileUrl: candidateData.public_profile_url,
      memberUrn: candidateData.member_urn,
    });
  }

  private processLinkedInContactData(candidateData: LinkedInPeopleSearchResult, userProfile: UserProfile): void {
    // LinkedIn doesn't provide direct contact info in search results
    // This would typically be enriched later through other means
    if (candidateData.can_send_inmail || candidateData.recruiter_candidate_id) {
      userProfile.linkedinSpecificData = {
        ...userProfile.linkedinSpecificData,
        canSendInmail: candidateData.can_send_inmail,
        recruiterCandidateId: candidateData.recruiter_candidate_id,
      };
    }
  }

  private processLinkedInExperienceData(candidateData: LinkedInPeopleSearchResult, userProfile: UserProfile): void {
    if (candidateData.current_positions && candidateData.current_positions.length > 0) {
      const currentPosition = candidateData.current_positions[0];

      userProfile.jobCompanyName = currentPosition.company;
      userProfile.jobTitle = currentPosition.role;
      userProfile.locationName = currentPosition.location || userProfile.locationName;

      // Store additional experience data in linkedinSpecificData
      userProfile.linkedinSpecificData = {
        ...userProfile.linkedinSpecificData,
        currentJobDescription: currentPosition.description,
        currentJobStartDate: currentPosition.start
          ? `${currentPosition.start.year}-${String(currentPosition.start.month).padStart(2, '0')}-01`
          : null,
        tenureAtCompany: currentPosition.tenure_at_company?.years,
        tenureAtRole: currentPosition.tenure_at_role?.years,
      };

      // Add job process event
      this.addJobProcessEvent(userProfile, 'current_position_processed', {
        company: currentPosition.company,
        role: currentPosition.role,
        tenure: currentPosition.tenure_at_company?.years,
      });
    } else {
      // If no current positions, try to extract job title and company from headline
      if (typeof candidateData.headline === 'string' && candidateData.headline.trim()) {
        // Extract company from headline if it contains ' at ' (lowercase) or ' AT ' (uppercase, used in all-caps headlines)
        if (candidateData.headline.includes(' at ') || candidateData.headline.includes(' AT ')) {
          let jobTitleFromHeadline: string | undefined;
          let companyFromHeadline: string | undefined;
          
          if (candidateData.headline.includes(' at ')) {
            const parts = candidateData.headline.split(' at ');
            jobTitleFromHeadline = parts[0]?.trim();
            companyFromHeadline = parts.slice(1).join(' at ').trim();
          } else if (candidateData.headline.includes(' AT ')) {
            const parts = candidateData.headline.split(' AT ');
            jobTitleFromHeadline = parts[0]?.trim();
            companyFromHeadline = parts.slice(1).join(' AT ').trim();
          }
          
          if (jobTitleFromHeadline) {
            userProfile.jobTitle = jobTitleFromHeadline;
            userProfile.profileTitle = jobTitleFromHeadline;
          }
          
          if (companyFromHeadline) {
            userProfile.jobCompanyName = companyFromHeadline;
          }
        } else {
          // If headline doesn't contain " at ", use the entire headline as job title
          // This handles cases like "Pulmonologist" where there's no company mentioned
          userProfile.jobTitle = candidateData.headline.trim();
          userProfile.profileTitle = candidateData.headline.trim();
        }
      }
    }

    // Map LinkedIn experience (current + past) into the normalized experience array
    const experienceForBase: Array<{
      company: string;
      role: string;
      startDate: string | null;
      endDate: string | null;
      isCurrent?: boolean;
    }> = [];

    // Current positions (if any) are marked as isCurrent: true
    if (candidateData.current_positions && candidateData.current_positions.length > 0) {
      for (const currentPosition of candidateData.current_positions) {
        const startDate = currentPosition.start
          ? `${currentPosition.start.year}-${String(currentPosition.start.month ?? 1).padStart(2, '0')}-01`
          : null;

        const endDate = currentPosition.end
          ? `${currentPosition.end.year}-${String(currentPosition.end.month ?? 1).padStart(2, '0')}-01`
          : null;

        experienceForBase.push({
          company: currentPosition.company,
          role: currentPosition.role,
          startDate,
          endDate,
          isCurrent: true,
        });
      }
    }

    // Past work_experience (e.g. "Past:" roles) are marked as isCurrent: false
    if (candidateData.work_experience && candidateData.work_experience.length > 0) {
      for (const exp of candidateData.work_experience) {
        const startDate = exp.start
          ? `${exp.start.year}-${String(exp.start.month ?? 1).padStart(2, '0')}-01`
          : null;

        const endDate = exp.end
          ? `${exp.end.year}-${String(exp.end.month ?? 1).padStart(2, '0')}-01`
          : null;

        experienceForBase.push({
          company: exp.company,
          role: exp.role,
          startDate,
          endDate,
          isCurrent: false,
        });
      }
    }

    if (experienceForBase.length > 0) {
      // Reuse the base transformer logic to populate userProfile.experience and experienceStats
      this.processExperienceData({ experience: experienceForBase }, userProfile);
    }
  }

  private processLinkedInEducationData(candidateData: LinkedInPeopleSearchResult, userProfile: UserProfile): void {
    // LinkedIn search results typically don't include detailed education
    // This would be enriched through profile scraping or other means
    // For now, we'll add a placeholder
    this.addJobProcessEvent(userProfile, 'education_data_placeholder', {
      note: 'Education data not available in LinkedIn search results - requires profile enrichment',
    });
  }

  private processLinkedInSkillsData(candidateData: LinkedInPeopleSearchResult, userProfile: UserProfile): void {
    // LinkedIn search results typically don't include detailed skills
    // This would be enriched through profile scraping or other means
    // For now, we'll add a placeholder
    this.addJobProcessEvent(userProfile, 'skills_data_placeholder', {
      note: 'Skills data not available in LinkedIn search results - requires profile enrichment',
    });
  }

  private ensureUniqueStringKey(userProfile: UserProfile, candidateData: LinkedInPeopleSearchResult): void {
    // If uniqueStringKey is empty or invalid, regenerate it with the processed data
    if (!userProfile.uniqueStringKey || userProfile.uniqueStringKey === '') {
      const fullName = userProfile.fullName || candidateData.name || '';
      const companyName = userProfile.jobCompanyName || '';
      
      console.log(`Regenerating uniqueStringKey for LinkedIn search result: fullName="${fullName}", companyName="${companyName}"`);
      
      userProfile.uniqueStringKey = this.dataProcessingUtils.generateUniqueStringKey(
        {
          name: fullName,
          companyName: companyName,
        },
        'linkedin_search'
      );
      
      console.log(`Generated new uniqueStringKey: "${userProfile.uniqueStringKey}"`);
    }
  }

  /**
   * Transform LinkedIn search results into DataTable-compatible format
   * This creates a UserProfile with UI-specific extensions for DataTable display
   */
  transformSearchResultsToTableFormat(
    searchResults: LinkedInSearchResult[],
    jobId: string,
    jobName: string = 'LinkedIn Search Results'
  ): TransformedCandidateForTable[] {
    return searchResults.map((result, index) => {
      const peopleResult = result as LinkedInPeopleSearchResult;
      const timestamp = new Date().toISOString();
      const peopleId = `people_${peopleResult.id}_${Date.now()}_${index}`;
      const stableSourcePersonId =
        peopleResult.id !== undefined && peopleResult.id !== null
          ? String(peopleResult.id)
          : '';
      
      // Create base UserProfile using the standard transformation
      const context: TransformationContext = {
        jobId,
        jobName,
        userId: 'linkedin_search_user',
        dataSource: 'linkedin_search',
        timestamp,
      };
      
      const userProfile = this.transformToUserProfile(result, context);
      
      // Extend with DataTable UI-specific fields
      const currentPosition = peopleResult.current_positions && peopleResult.current_positions.length > 0
        ? peopleResult.current_positions[0]
        : undefined;

      const jobTitleFromCurrentPosition = currentPosition?.role?.trim() || '';
      const companyFromCurrentPosition = currentPosition?.company?.trim() || '';

      const resolvedJobTitle =
        jobTitleFromCurrentPosition ||
        (userProfile.jobTitle ? userProfile.jobTitle.trim() : '') ||
        this.extractJobTitleFromHeadline(peopleResult.headline) ||
        'Not specified';

      const resolvedCompany =
        companyFromCurrentPosition ||
        (userProfile.jobCompanyName ? userProfile.jobCompanyName.trim() : '') ||
        this.extractCompanyFromHeadline(peopleResult.headline) ||
        'Not specified';

      const transformedCandidate: TransformedCandidateForTable = {
        ...userProfile,
        
        // DataTable UI fields
        __isFetched: true,
        tempId: peopleResult.id,
        
        // Override string fields for Handsontable compatibility
        phoneNumber: userProfile.phoneNumber || '',
        email: userProfile.emailAddress || '',
        linkedinUrl:
          peopleResult.public_profile_url ||
          peopleResult.profile_url ||
          userProfile.linkedinUrl ||
          '',
        hiringNaukriUrl: userProfile.linkedinSpecificData?.hiringNaukriUrl || '',
        resdexNaukriUrl: '',
        displayPicture: peopleResult.profile_picture_url || '',
        
        // UI state fields
        status: 'No Status',
        candConversationStatus: 'No Conversation',
        startChat: false,
        stopChat: false,
        startChatCompleted: false,
        startVideoInterviewChat: false,
        startVideoInterviewChatCompleted: false,
        startMeetingSchedulingChat: false,
        startMeetingSchedulingChatCompleted: false,
        engagementStatus: false,
        messagingChannel: 'linkedin',
        chatCount: 0,
        lastEngagementChatControl: 'startChat',
        
        // Relationship edges
        whatsappMessages: { edges: [] },
        emailMessages: { edges: [] },
        otherFields: {},
        candidateReminders: { edges: [] },
        attachments: { edges: [] },
        videoInterview: { edges: [] },
        jobs: { id: jobId, name: jobName },
        people: { id: peopleId },
        whatsappProvider: 'application03',
        input: '',
        clientInterview: undefined,
        remarks: '',
        
        // LinkedIn-specific display fields
        name: peopleResult.name || userProfile.fullName || 'Unknown',
        headline: peopleResult.headline || userProfile.linkedinHeadline || '',
        profilePictureUrl: peopleResult.profile_picture_url || '',
        networkDistance: peopleResult.network_distance || 'UNKNOWN',
        premium: peopleResult.premium || false,
        verified: peopleResult.verified || false,
        sharedConnectionsCount: peopleResult.shared_connections_count,
        followersCount: peopleResult.followers_count,
        keywordsMatch: peopleResult.keywords_match || '',
        
        // Naming aliases for DataTable compatibility
        jobTitle: resolvedJobTitle,
        company: resolvedCompany,
        location: peopleResult.location || userProfile.locationName || 'Not specified',
        peopleId: stableSourcePersonId.length > 0 ? stableSourcePersonId : null,
        updatedAt: timestamp,
        createdAt: timestamp,
      };
      return transformedCandidate;
    });
  }

  /**
   * Extract job title from LinkedIn headline
   */
  private extractJobTitleFromHeadline(headline?: string): string | null {
    if (!headline) return null;
    
    const patterns = [
      /^([^|]+)/,
      /^([^-]+)/,
      /^([^at]+)/,
      /^([^@]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = headline.match(pattern);
      if (match && match[1]) {
        const title = match[1].trim();
        if (title.length > 0 && title.length < 100) {
          return title;
        }
      }
    }
    
    return headline.length > 100 ? headline.substring(0, 100) + '...' : headline;
  }

  /**
   * Extract company name from LinkedIn headline
   */
  private extractCompanyFromHeadline(headline?: string): string | null {
    if (!headline) return null;
    
    const patterns = [
      /at\s+([^|]+)/i,
      /@\s+([^|]+)/i,
      /\|\s*([^|]+)/,
      /-\s*([^-]+)$/,
    ];
    
    for (const pattern of patterns) {
      const match = headline.match(pattern);
      if (match && match[1]) {
        const company = match[1].trim();
        if (company.length > 0 && company.length < 100) {
          return company;
        }
      }
    }
    
    return null;
  }

  /**
   * Add additional metadata to transformed candidates
   */
  addMetadataToCandidates(
    candidates: TransformedCandidateForTable[],
    searchMetadata: {
      searchType: string;
      searchCategory: string;
      timestamp: string;
      processingTime: number;
    }
  ): TransformedCandidateForTable[] {
    return candidates.map(candidate => ({
      ...candidate,
      campaign: `linkedin_${searchMetadata.searchType}_${searchMetadata.searchCategory}`,
      source: `linkedin_${searchMetadata.searchType}`,
    }));
  }

  /**
   * Filter candidates based on criteria
   */
  filterCandidates(
    candidates: TransformedCandidateForTable[],
    filters: {
      hasProfilePicture?: boolean;
      isPremium?: boolean;
      isVerified?: boolean;
      minSharedConnections?: number;
    }
  ): TransformedCandidateForTable[] {
    return candidates.filter(candidate => {
      if (filters.hasProfilePicture && !candidate.profilePictureUrl) {
        return false;
      }
      
      if (filters.isPremium !== undefined && candidate.premium !== filters.isPremium) {
        return false;
      }
      
      if (filters.isVerified !== undefined && candidate.verified !== filters.isVerified) {
        return false;
      }
      
      if (filters.minSharedConnections !== undefined && 
          (candidate.sharedConnectionsCount || 0) < filters.minSharedConnections) {
        return false;
      }
      
      return true;
    });
  }
}
