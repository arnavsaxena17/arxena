import { Injectable } from '@nestjs/common';
import { UserProfile } from 'twenty-shared';
import { DataProcessingUtils } from '../../utils/data-processing.utils';
import { BaseDataSourceTransformerService, TransformationContext } from './base-data-source-transformer.service';

@Injectable()
export class UploadedProfilesTransformerService extends BaseDataSourceTransformerService {
  constructor(dataProcessingUtils: DataProcessingUtils) {
    super(dataProcessingUtils);
  }

  getDataSourceIdentifier(): string {
    return 'data_upload';
  }

  transformToUserProfile(
    candidateData: any,
    context: TransformationContext
  ): UserProfile {
    const userProfile = this.createBaseUserProfile(candidateData, context);
    
    // Process name
    this.processNameData(candidateData, userProfile);
    
    // Process contact information
    this.processUploadedContactData(candidateData, userProfile);
    
    // Process profile information
    this.processUploadedProfileData(candidateData, userProfile);
    
    // Process location
    this.processUploadedLocationData(candidateData, userProfile);
    
    // Process work experience
    this.processUploadedWorkExperience(candidateData, userProfile);
    
    // Process uploaded-specific data
    this.processUploadedSpecificData(candidateData, userProfile);
    
    return userProfile;
  }

  private processUploadedContactData(candidateData: any, userProfile: UserProfile): void {
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
        const cleanedPhones: string[] = [];
        
        phoneNumbers.forEach(phone => {
          const cleanedPhone = this.dataProcessingUtils.cleanPhoneNumbers(phone.toString());
          if (Array.isArray(cleanedPhone)) {
            cleanedPhones.push(...cleanedPhone);
          } else if (cleanedPhone) {
            cleanedPhones.push(cleanedPhone);
          }
        });
        
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

  private processUploadedProfileData(candidateData: any, userProfile: UserProfile): void {
    const fullName = candidateData.full_name;
    const jobCompanyName = candidateData.job_company_name;
    
    // Generate profile ID
    let profileId = '';
    if (fullName && jobCompanyName) {
      profileId = (fullName.replace(/\s/g, '').toLowerCase() + 
                   jobCompanyName.replace(/\s/g, '').toLowerCase());
    }

    userProfile.profileUrl = profileId;
    userProfile.profileTitle = '';

    // Handle candidate profile (from resdex if present)
    if (candidateData.candidate_profile) {
      userProfile.profileUrl = candidateData.candidate_profile;
      userProfile.profileTitle = candidateData.candidate_profile;
    }
  }

  private processUploadedLocationData(candidateData: any, userProfile: UserProfile): void {
    const location = candidateData.location;
    
    if (location) {
      userProfile.locations = [{
        name: location,
        locality: null,
        region: null,
        subregion: null,
        country: null,
        continent: null,
        type: null,
        geo: null,
        postal_code: null,
        zip_plus_4: null,
        street_address: null,
        address_line_2: null,
        most_recent: true,
        is_primary: true,
        last_updated: null,
      }];
      
      userProfile.locationName = location;
    }
  }

  private processUploadedWorkExperience(candidateData: any, userProfile: UserProfile): void {
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

  private processUploadedSpecificData(candidateData: any, userProfile: UserProfile): void {
    // Process distance from job
    if (candidateData.distance_from_job) {
      // this.addJobProcessEvent(userProfile, 'distance_from_job', candidateData.distance_from_job);
    }

    // Process creation source and data sources
    const creationData = {
      created: Date.now(),
      creation_source: 'data_upload',
      data_sources: ['data_upload'],
    };
    
    // this.addJobProcessEvent(userProfile, 'creation_particulars', creationData);

    // Process social profiles
    // this.addJobProcessEvent(userProfile, 'linkedin_social_profile', null);

    // Process uploaded file specific fields
    const uploadedSpecificFields = [
      'file_name',
      'file_type',
      'upload_date',
      'source_file',
      'parsed_data',
      'resume_text',
      'parse_confidence',
    ];

    uploadedSpecificFields.forEach(field => {
      if (candidateData[field]) {
        // this.addJobProcessEvent(userProfile, field, candidateData[field]);
      }
    });

    // Process any custom fields that might be in uploaded data
    Object.keys(candidateData).forEach(key => {
      // Skip standard fields we've already processed
      const standardFields = [
        'full_name', 'job_title', 'job_company_name', 'phone_number', 
        'email_address', 'location', 'distance_from_job'
      ];
      
      if (!standardFields.includes(key) && candidateData[key] !== null && candidateData[key] !== undefined) {
        // this.addJobProcessEvent(userProfile, `uploaded_${key}`, candidateData[key]);
      }
    });
  }

  /**
   * Add event to job process - utility method for UserProfile
   */
  // protected addJobProcessEvent(userProfile: UserProfile, type: string, value: any): void {
  //   if (value !== null && value !== undefined && value !== '') {
  //     if (!userProfile.job_process_events) {
  //       userProfile.job_process_events = [];
  //     }
  //     userProfile.job_process_events.push({
  //       type,
  //       value,
  //       timestamp: new Date().toISOString(),
  //     });
  //   }
  // }
}
