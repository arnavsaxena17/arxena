import { Injectable } from '@nestjs/common';
import { UserProfile } from 'twenty-shared';
import { DataProcessingUtils } from '../../utils/data-processing.utils';
import { BaseDataSourceTransformerService, TransformationContext } from './base-data-source-transformer.service';

@Injectable()
export class NaukriProfileDataTransformerService extends BaseDataSourceTransformerService {
  constructor(dataProcessingUtils: DataProcessingUtils) {
    super(dataProcessingUtils);
  }

  getDataSourceIdentifier(): string {
    return 'profile_data_naukri';
  }

  transformToUserProfile(
    candidateData: any,
    context: TransformationContext
  ): UserProfile {
    const userProfile = this.createBaseUserProfile(candidateData, context);
    
    // Map company and job title fields
    this.mapJobFields(candidateData);
    
    // Process name
    this.processNameData(candidateData, userProfile);
    
    // Process contact information
    this.processNaukriContactData(candidateData, userProfile);
    
    // Process profile information
    this.processNaukriProfileData(candidateData, userProfile);
    
    // Process location
    this.processLocationData(candidateData, userProfile);
    
    // Process work experience
    this.processNaukriWorkExperience(candidateData, userProfile);
    
    // Process Naukri-specific data
    this.processNaukriSpecificData(candidateData, userProfile);
    
    return userProfile;
  }

  private mapJobFields(candidateData: any): void {
    // Map company and job title fields as done in Python
    candidateData.job_company_name = candidateData.company_name || '';
    candidateData.job_title = candidateData.current_designation || '';
    candidateData.url = candidateData.profile_url || '';
  }

  private processNaukriContactData(candidateData: any, userProfile: UserProfile): void {
    // Process phone numbers
    let phoneNumbers = candidateData.phone_number;
    
    if (phoneNumbers) {
      // Normalize phone numbers to array
      if (typeof phoneNumbers === 'string') {
        phoneNumbers = [phoneNumbers];
      } else if (typeof phoneNumbers === 'number') {
        phoneNumbers = [phoneNumbers.toString()];
      }
      
      if (Array.isArray(phoneNumbers)) {
        const cleanedPhones = phoneNumbers
          .map(phone => this.dataProcessingUtils.cleanPhoneNumbers(phone.toString()))
          .flat()
          .filter(phone => phone);
        
        userProfile.phoneNumbers = cleanedPhones;
        userProfile.phoneNumber = cleanedPhones[0] || '';
      }
    }

    // Process email addresses
    if (candidateData.email_address) {
      let email = candidateData.email_address;
      
      // Handle comma-separated emails
      if (email.includes(', ')) {
        email = email.split(', ')[0];
      }
      
      const cleanedEmails = this.dataProcessingUtils.cleanEmailAddresses(email);
      
      userProfile.emailAddresses = cleanedEmails;
      userProfile.emailAddress = cleanedEmails[0] || '';

    }
  }

  private processNaukriProfileData(candidateData: any, userProfile: UserProfile): void {
    const fullName = candidateData.full_name;
    const jobCompanyName = candidateData.job_company_name;
    
    // Generate profile ID
    let profileId = '';
    if (fullName && jobCompanyName) {
      profileId = (fullName.replace(/\s/g, '').toLowerCase() + 
                   jobCompanyName.replace(/\s/g, '').toLowerCase());
    }
    
    let profileUrl = candidateData.profile_url || '';
    
    // Handle hiring URLs
    if (candidateData.profile_url && candidateData.profile_url.includes('hiring')) {
      profileUrl = candidateData.profile_url;
    }
    
    // Clean profile URL (remove query parameters)
    if (profileUrl.includes('?')) {
      profileUrl = profileUrl.split('?')[0];
    }

    userProfile.profileUrl = profileUrl;
    userProfile.profileTitle = '';

    // Handle candidate profile (from resdex)
    if (candidateData.candidate_profile) {
      userProfile.profileUrl = candidateData.candidate_profile;
      userProfile.profileTitle = candidateData.candidate_profile;
    }
  }

  private processNaukriWorkExperience(candidateData: any, userProfile: UserProfile): void {
    const jobTitle = candidateData.job_title || '';
    const jobCompanyName = candidateData.job_company_name || '';

    if (jobTitle || jobCompanyName) {
      const experience = {
        title: {
          name: jobTitle,
        },
        company: {
          name: jobCompanyName,
        },
        startDate: null,
        endDate: null,
      };

      userProfile.experience = [experience];
      userProfile.jobCompanyName = jobCompanyName;
      userProfile.jobTitle = jobTitle;
    }
  }

  private processNaukriSpecificData(candidateData: any, userProfile: UserProfile): void {
    // Process distance from job
    if (candidateData.distance_from_job) {
      // this.addJobProcessEvent(userProfile, 'distance_from_job', candidateData.distance_from_job);
    }

    // Process profile image
    const profileImage = candidateData.profileImageUrl || candidateData.photo;
    if (profileImage) {
      // this.addJobProcessEvent(userProfile, 'profile_picture', profileImage);
    }

    // Process social profiles based on URL type
    const url = candidateData.url || '';
    
    if (url.includes('resdex')) {
      // this.addJobProcessEvent(userProfile, 'resdex_profile_url', url);
    } else if (url.includes('hiring')) {
      // this.addJobProcessEvent(userProfile, 'hiring_naukri_url', url);
    } else if (url) {
      // this.addJobProcessEvent(userProfile, 'naukri_profile_url', url);
    }

    // Process additional fields that might be present
    const additionalFields = [
      'candidateId',
      'recruiterId',
      'sourceType',
      'appliedDate',
      'lastActive',
      'resumeScore',
      'matchScore',
    ];

    additionalFields.forEach(field => {
      if (candidateData[field]) {
        // this.addJobProcessEvent(userProfile, field, candidateData[field]);
      }
    });
  }

  /**
   * Add event to job process - utility method for UserProfile
   */
  // protected addJobProcessEvent(userProfile: UserProfile, type: string, value: any): void {
    // if (value !== null && value !== undefined && value !== '') {
    //   if (!userProfile.job_process_events) {
    //     userProfile.job_process_events = [];
    //   }
    //   userProfile.job_process_events.push({
    //     type,
    //     value,
    //     timestamp: new Date().toISOString(),
    //   });
    // }
  // }
}
