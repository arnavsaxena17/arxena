import { Injectable } from '@nestjs/common';
import { UserProfile } from 'twenty-shared';
import { LinkedInSearchResult } from '../../../candidate-search/types/linkedin-search-result.type';
import { BaseDataSourceTransformerService, TransformationContext } from './base-data-source-transformer.service';

@Injectable()
export class LinkedInSearchTransformerService extends BaseDataSourceTransformerService {
  
  getDataSourceIdentifier(): string {
    return 'linkedin_search';
  }

  transformToUserProfile(
    candidateData: LinkedInSearchResult,
    context: TransformationContext
  ): UserProfile {
    const userProfile = this.createBaseUserProfile(candidateData, context);
    
    // Process LinkedIn-specific data
    this.processLinkedInProfileData(candidateData, userProfile);
    this.processLinkedInContactData(candidateData, userProfile);
    this.processLinkedInExperienceData(candidateData, userProfile);
    this.processLinkedInEducationData(candidateData, userProfile);
    this.processLinkedInSkillsData(candidateData, userProfile);
    
    return userProfile;
  }

  private processLinkedInProfileData(candidateData: LinkedInSearchResult, userProfile: UserProfile): void {
    // Basic profile information
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

  private processLinkedInContactData(candidateData: LinkedInSearchResult, userProfile: UserProfile): void {
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

  private processLinkedInExperienceData(candidateData: LinkedInSearchResult, userProfile: UserProfile): void {
    if (candidateData.current_positions && candidateData.current_positions.length > 0) {
      const currentPosition = candidateData.current_positions[0];
      
      userProfile.jobCompanyName = currentPosition.company;
      userProfile.jobTitle = currentPosition.role;
      userProfile.locationName = currentPosition.location || userProfile.locationName;
      
      // Store additional experience data in linkedinSpecificData
      userProfile.linkedinSpecificData = {
        ...userProfile.linkedinSpecificData,
        currentJobDescription: currentPosition.description,
        currentJobStartDate: currentPosition.start ? `${currentPosition.start.year}-${String(currentPosition.start.month).padStart(2, '0')}-01` : null,
        tenureAtCompany: currentPosition.tenure_at_company?.years,
        tenureAtRole: currentPosition.tenure_at_role?.years,
      };

      // Add job process event
      this.addJobProcessEvent(userProfile, 'current_position_processed', {
        company: currentPosition.company,
        role: currentPosition.role,
        tenure: currentPosition.tenure_at_company?.years,
      });
    }
  }

  private processLinkedInEducationData(candidateData: LinkedInSearchResult, userProfile: UserProfile): void {
    // LinkedIn search results typically don't include detailed education
    // This would be enriched through profile scraping or other means
    // For now, we'll add a placeholder
    this.addJobProcessEvent(userProfile, 'education_data_placeholder', {
      note: 'Education data not available in LinkedIn search results - requires profile enrichment',
    });
  }

  private processLinkedInSkillsData(candidateData: LinkedInSearchResult, userProfile: UserProfile): void {
    // LinkedIn search results typically don't include detailed skills
    // This would be enriched through profile scraping or other means
    // For now, we'll add a placeholder
    this.addJobProcessEvent(userProfile, 'skills_data_placeholder', {
      note: 'Skills data not available in LinkedIn search results - requires profile enrichment',
    });
  }
}
