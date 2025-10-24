import { Injectable } from '@nestjs/common';
import { LinkedInPeopleSearchResult, LinkedInSearchResult } from '../../linkedin-search/types/linkedin-search-response.type';

export interface TransformedCandidateForTable {
  // Core LinkedIn fields
  id: string;
  name: string;
  jobTitle: string;
  company: string;
  location: string;
  headline: string;
  linkedinUrl: { primaryLinkUrl: string } | undefined;
  profilePictureUrl: string;
  networkDistance: string;
  premium: boolean;
  verified: boolean;
  sharedConnectionsCount?: number;
  followersCount?: number;
  keywordsMatch: string;
  
  // Database candidate fields (matching CandidateNode structure)
  source: string;
  campaign: string;
  status: string;
  candConversationStatus: string;
  startChat: boolean;
  stopChat: boolean;
  startChatCompleted: boolean;
  startVideoInterviewChat: boolean;
  startVideoInterviewChatCompleted: boolean;
  startMeetingSchedulingChat: boolean;
  startMeetingSchedulingChatCompleted: boolean;
  engagementStatus: boolean;
  messagingChannel: string;
  phoneNumber: { primaryPhoneNumber: string };
  email: { primaryEmail: string };
  peopleId: string | null; // null for unsaved LinkedIn candidates
  updatedAt: string;
  createdAt: string;
  whatsappMessages: { edges: any[] };
  emailMessages: { edges: any[] };
  candidateFieldValues: { edges: any[] };
  candidateReminders: { edges: any[] };
  jobs: { id: string; name: string };
  people: { id: string };
  hiringNaukriUrl?: { primaryLinkUrl: string };
  resdexNaukriUrl?: { primaryLinkUrl: string };
  displayPicture?: { primaryLinkUrl: string };
  attachments: any;
  chatCount: number;
  lastEngagementChatControl: any;
  videoInterview: any;
  whatsappProvider: string;
  input: string;
  clientInterview?: any;
  remarks?: string;
  
  // DataTable-specific fields
  __isFetched?: boolean;
  tempId?: string;
}

@Injectable()
export class LinkedInSearchResultTransformerService {
  
  /**
   * Transform LinkedIn search results into DataTable-compatible format
   */
  transformSearchResultsToTableFormat(
    searchResults: LinkedInSearchResult[],
    jobId: string,
    jobName: string = 'LinkedIn Search Results'
  ): TransformedCandidateForTable[] {
    return searchResults.map((result, index) => {
      // Cast to LinkedInPeopleSearchResult since we're only dealing with people search results
      const peopleResult = result as LinkedInPeopleSearchResult;
      const timestamp = new Date().toISOString();
      const candidateId = `linkedin_search_${peopleResult.id}_${Date.now()}_${index}`;
      const peopleId = `people_${peopleResult.id}_${Date.now()}_${index}`;
      
      return {
        // Core LinkedIn fields
        id: '',
        name: peopleResult.name || 'Unknown',
        jobTitle: this.extractJobTitleFromHeadline(peopleResult.headline) || 'Not specified',
        company: this.extractCompanyFromHeadline(peopleResult.headline) || 'Not specified',
        location: peopleResult.location || 'Not specified',
        headline: peopleResult.headline || '',
        linkedinUrl: peopleResult.public_profile_url ? { primaryLinkUrl: peopleResult.public_profile_url } : undefined,
        profilePictureUrl: peopleResult.profile_picture_url || '',
        networkDistance: peopleResult.network_distance || 'UNKNOWN',
        premium: peopleResult.premium || false,
        verified: peopleResult.verified || false,
        sharedConnectionsCount: peopleResult.shared_connections_count,
        followersCount: peopleResult.followers_count,
        keywordsMatch: peopleResult.keywords_match || '',
        // Database candidate fields (matching CandidateNode structure)
        source: 'linkedin_search',
        campaign: 'linkedin_search',
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
        messagingChannel: '',
        phoneNumber: { primaryPhoneNumber: '' },
        email: { primaryEmail: '' },
        peopleId: null, // null for unsaved LinkedIn candidates
        updatedAt: timestamp,
        createdAt: timestamp,
        whatsappMessages: { edges: [] },
        emailMessages: { edges: [] },
        candidateFieldValues: { edges: [] },
        candidateReminders: { edges: [] },
        jobs: { id: jobId, name: jobName },
        people: { id: peopleId },
        hiringNaukriUrl: undefined,
        resdexNaukriUrl: undefined,
        displayPicture: peopleResult.profile_picture_url ? { primaryLinkUrl: peopleResult.profile_picture_url } : undefined,
        attachments: { edges: [] },
        chatCount: 0,
        lastEngagementChatControl: 'startChat',
        videoInterview: { edges: [] },
        whatsappProvider: 'application03',
        input: '',
        clientInterview: undefined,
        remarks: '',
        
        // DataTable-specific fields
        __isFetched: true,
        tempId: peopleResult.id,
      };
    });
  }

  /**
   * Extract job title from LinkedIn headline
   */
  private extractJobTitleFromHeadline(headline?: string): string | null {
    if (!headline) return null;
    
    // Common patterns for job titles in headlines
    const patterns = [
      /^([^|]+)/, // Everything before first pipe
      /^([^-]+)/, // Everything before first dash
      /^([^at]+)/, // Everything before "at"
      /^([^@]+)/, // Everything before "@"
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
    
    // Common patterns for company names in headlines
    const patterns = [
      /at\s+([^|]+)/i, // "at Company Name"
      /@\s+([^|]+)/i, // "@ Company Name"
      /\|\s*([^|]+)/, // "| Company Name"
      /-\s*([^-]+)$/, // "- Company Name" at end
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
      // Add search metadata to campaign or source
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
