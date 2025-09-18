import { Injectable } from '@nestjs/common';
import { UserProfile } from 'twenty-shared';
import { DataProcessingUtils } from '../../utils/data-processing.utils';
import { BaseDataSourceTransformerService, TransformationContext } from './base-data-source-transformer.service';

@Injectable()
export class LinkedinPremiumTransformerService extends BaseDataSourceTransformerService {
  constructor(dataProcessingUtils: DataProcessingUtils) {
    super(dataProcessingUtils);
  }

  getDataSourceIdentifier(): string {
    return 'linkedin_premium';
  }

  transformToUserProfile(
    candidateData: any,
    context: TransformationContext
  ): UserProfile {
    const userProfile = this.createBaseUserProfile(candidateData, context);
    
    // Use simplified base methods
    this.processNameData(candidateData, userProfile);
    this.processContactData(candidateData, userProfile);
    this.processLocationData(candidateData, userProfile);
    this.processSkillsData(candidateData, userProfile);
    this.processEducationData(candidateData, userProfile);
    this.processIndustryData(candidateData, userProfile);
    
    // Process LinkedIn-specific data
    this.processLinkedInProfileData(candidateData, userProfile);
    this.processLinkedInExperienceData(candidateData, userProfile);
    this.processLinkedInSpecificData(candidateData, userProfile);
    
    return userProfile;
  }

  private processLinkedInProfileData(candidateData: any, userProfile: UserProfile): void {
    const linkedinUrl = candidateData.linkedin_url || candidateData.linkedinUrl || candidateData.profile_url;
    const linkedinProfIdUrl = candidateData.linkedin_profile_id_url || candidateData.linkedinProfileIdUrl;
    
    if (linkedinUrl) {
      userProfile.linkedinUrl = linkedinUrl;
      userProfile.profileUrl = linkedinProfIdUrl;
    }

    // Use utility method for job info
    this.setJobInfo(candidateData, userProfile);
  }

  private processLinkedInExperienceData(candidateData: any, userProfile: UserProfile): void {
    const experience = candidateData.experience || candidateData.positions || candidateData.workExperience;
    
    if (experience && Array.isArray(experience)) {
      userProfile.experience = experience.map((exp, index) => {
        const company = exp.company || exp.companyName || exp.organization;
        
        return {
          company: {
            name: typeof company === 'object' ? company.name : company,
          },
          title: {
            name: exp.title || exp.position || exp.role || '',
          },
          startDate: exp.startDate || exp.start_date || null,
          endDate: exp.endDate || exp.end_date || null,
        };
      });
      
      // Calculate experience statistics
      this.calculateExperienceStats(userProfile);
      
      // Set current company information
      if (userProfile.experience.length > 0) {
        const currentJob = userProfile.experience[0];
        userProfile.jobCompanyName = currentJob.company.name;
      }
    }
  }

  private processLinkedInSpecificData(candidateData: any, userProfile: UserProfile): void {
    // Use utility method for LinkedIn events
    this.addJobProcessEvent(userProfile, 'linkedin_summary', candidateData.summary || candidateData.about);
    this.addJobProcessEvent(userProfile, 'linkedin_connections', candidateData.connections || candidateData.connectionCount);
    this.addJobProcessEvent(userProfile, 'linkedin_recommendations', candidateData.recommendations);
    this.addJobProcessEvent(userProfile, 'linkedin_followers', candidateData.followers || candidateData.followerCount);
    this.addJobProcessEvent(userProfile, 'last_activity', candidateData.lastActivity || candidateData.last_activity);
    
    // Process headline - specific to LinkedIn data structure
    const headline = candidateData.headline || candidateData.job_title;
    this.addJobProcessEvent(userProfile, 'linkedin_headline', headline);
    
    // Extract company from headline if it contains " at "
    if (headline?.includes(' at ')) {
      const companyFromHeadline = headline.split(' at ').pop();
      if (companyFromHeadline && !userProfile.jobCompanyName) {
        userProfile.jobCompanyName = companyFromHeadline.trim();
      }
    }
    
    // Process various LinkedIn fields using utility method
    this.addJobProcessEvent(userProfile, 'linkedin_full_name', candidateData.fullName || candidateData.name);
    this.addJobProcessEvent(userProfile, 'linkedin_company_name', candidateData.company_name);
    this.addJobProcessEvent(userProfile, 'linkedin_phone_number', candidateData['Phone Number'] || candidateData.phone_number);
    this.addJobProcessEvent(userProfile, 'linkedin_email_id', candidateData['Email ID'] || candidateData.email_address);
    
    // Process creation particulars
    const creationData = {
      created: Date.now(),
      creation_source: 'linkedin_premium',
      data_sources: ['linkedin_premium'],
    };
    
    this.addJobProcessEvent(userProfile, 'creation_particulars', creationData);
    
    // Process social profiles - LinkedIn specific
    if (candidateData.linkedin_url) {
      this.addJobProcessEvent(userProfile, 'linkedin_social_profile', candidateData.linkedin_url);
    }
    
    // Process certifications
    if (candidateData.certifications && Array.isArray(candidateData.certifications)) {
      const certifications = candidateData.certifications.map((cert, index) => ({
        name: cert.name || cert.title || null,
        organization: cert.organization || cert.authority || null,
        start_date: this.dataProcessingUtils.formatDate(cert.startDate || cert.issued),
        end_date: this.dataProcessingUtils.formatDate(cert.endDate || cert.expires),
        is_primary: index === 0,
      }));
      this.addJobProcessEvent(userProfile, 'certifications', certifications);
    }
    
    // Process languages
    if (candidateData.languages && Array.isArray(candidateData.languages)) {
      this.addJobProcessEvent(userProfile, 'languages', candidateData.languages);
    }
    
    // Set profile picture
    if (candidateData.profilePicture || candidateData.profile_picture || candidateData.photo) {
      userProfile.displayPicture = candidateData.profilePicture || candidateData.profile_picture || candidateData.photo;
      this.addJobProcessEvent(userProfile, 'profile_picture', candidateData.profilePicture || candidateData.profile_picture || candidateData.photo);
    }
    
    // Handle job title variations from LinkedIn Premium
    const jobTitle = candidateData.job_title || candidateData.headline;
    if (jobTitle && jobTitle !== candidateData.headline) {
      this.addJobProcessEvent(userProfile, 'linkedin_job_title', jobTitle);
    }
    
    // Process additional LinkedIn Premium specific fields
    const linkedinSpecificFields = [
      'positions',
      'workExperience',
      'connectionCount',
      'followerCount',
    ];
    
    linkedinSpecificFields.forEach(field => {
      if (candidateData[field]) {
        this.addJobProcessEvent(userProfile, field, candidateData[field]);
      }
    });
  }

  private extractLinkedInUsername(linkedinUrl: string): string | null {
    if (!linkedinUrl) return null;
    
    try {
      const url = new URL(linkedinUrl);
      const pathParts = url.pathname.split('/').filter(part => part.length > 0);
      
      // LinkedIn URLs typically follow /in/username format
      const inIndex = pathParts.indexOf('in');
      if (inIndex !== -1 && pathParts.length > inIndex + 1) {
        return pathParts[inIndex + 1];
      }
      
      return pathParts[pathParts.length - 1] || null;
    } catch (error) {
      return null;
    }
  }
}
