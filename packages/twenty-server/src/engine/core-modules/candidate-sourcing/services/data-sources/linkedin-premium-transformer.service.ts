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
    
    this.processNameData(candidateData, userProfile);
    this.processContactData(candidateData, userProfile);
    this.processLocationData(candidateData, userProfile);
    this.processSkillsData(candidateData, userProfile);
    this.processEducationData(candidateData, userProfile);
    this.processIndustryData(candidateData, userProfile);
    this.processLinkedInProfileData(candidateData, userProfile);
    this.processLinkedInExperienceData(candidateData, userProfile);
    this.processLinkedInSpecificData(candidateData, userProfile);
    return userProfile;
  }

  private processLinkedInProfileData(candidateData: any, userProfile: UserProfile): void {
    const linkedinUrl = candidateData.linkedin_profile_id_url || '';
    const linkedinProfIdUrl = candidateData.linkedinUrl || '';
    
    if (linkedinUrl) {
      userProfile.linkedinUrl = linkedinUrl;
      userProfile.profileUrl = linkedinProfIdUrl;
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
    // Set LinkedIn-specific fields
    if (candidateData.summary || candidateData.about) {
      userProfile.linkedinSummary = candidateData.summary || candidateData.about;
    }
    if (candidateData.connections || candidateData.connectionCount) {
      userProfile.linkedinConnections = candidateData.connections || candidateData.connectionCount;
    }
    if (candidateData.recommendations) {
      userProfile.linkedinRecommendations = candidateData.recommendations;
    }
    if (candidateData.followers || candidateData.followerCount) {
      userProfile.linkedinFollowers = candidateData.followers || candidateData.followerCount;
    }
    if (candidateData.lastActivity || candidateData.last_activity) {
      userProfile.lastActivity = candidateData.lastActivity || candidateData.last_activity;
    }
    
    // Process headline - specific to LinkedIn data structure
    const headline = candidateData.headline || candidateData.job_title;
    if (headline) {
      userProfile.linkedinHeadline = headline;
    }
    
    // Extract company from headline if it contains " at "
    // Extract company from headline if it contains ' at ' (lowercase) or ' AT ' (uppercase, used in all-caps headlines)
    if ((typeof headline === 'string') && (headline.includes(' at ') || headline.includes(' AT '))) {
      // Prefer lower-case ' at ', else fallback to upper-case ' AT '
      let companyFromHeadline: string | undefined;
      if (headline.includes(' at ')) {
        companyFromHeadline = headline.split(' at ').pop();
      } else if (headline.includes(' AT ')) {
        companyFromHeadline = headline.split(' AT ').pop();
      }
      if (companyFromHeadline && !userProfile.jobCompanyName) {
        userProfile.jobCompanyName = companyFromHeadline.trim();
      }
    }
    // Process various LinkedIn fields
    if (candidateData.fullName || candidateData.name) {
      userProfile.fullName = candidateData.fullName || candidateData.name;
    }
    if (candidateData.company_name) {
      userProfile.jobCompanyName = candidateData.company_name || '';
    }
    if (candidateData['Phone Number'] || candidateData.phone_number) {
      userProfile.phoneNumber = candidateData['Phone Number'] || candidateData.phone_number || '';
      userProfile.phoneNumbers = [candidateData['Phone Number'] || candidateData.phone_number];
    }
    if (candidateData['Email ID'] || candidateData.email_address) {
      userProfile.emailAddress = candidateData['Email ID'] || candidateData.email_address || '' ;
      userProfile.emailAddresses = [candidateData['Email ID'] || candidateData.email_address];
    }
    
    // Process creation particulars
    const creationData = {
      created: Date.now(),
      creation_source: 'linkedin_premium',
      data_sources: ['linkedin_premium'],
    };
    
    userProfile.creationParticulars = creationData;
    
    // Process social profiles - LinkedIn specific
    const linkedinUrl = candidateData?.profileUrl || '';
    if (linkedinUrl) {
      userProfile.linkedinUrl = linkedinUrl;
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
      userProfile.certifications = certifications;
    }
    
    // Process languages
    if (candidateData.languages && Array.isArray(candidateData.languages)) {
      userProfile.languages = candidateData.languages;
    }
    
    // Set profile picture
    if (candidateData.profilePicture || candidateData.profile_picture || candidateData.photo) {
      userProfile.displayPicture = candidateData.profilePicture || candidateData.profile_picture || candidateData.photo;
    }
    
    // Handle job title variations from LinkedIn Premium
    const jobTitle = candidateData.job_title || candidateData.headline;
    if (jobTitle && jobTitle !== candidateData.headline) {
      userProfile.jobTitle = jobTitle;
    }
    
    // Process additional LinkedIn Premium specific fields
    const linkedinSpecificFields = [
      'positions',
      'workExperience',
      'connectionCount',
      'followerCount',
    ];
    
    const linkedinSpecificData: Record<string, any> = {};
    linkedinSpecificFields.forEach(field => {
      if (candidateData[field]) {
        linkedinSpecificData[field] = candidateData[field];
      }
    });
    if (Object.keys(linkedinSpecificData).length > 0) {
      userProfile.linkedinSpecificData = linkedinSpecificData;
    }
  }

}
