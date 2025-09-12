import { Injectable } from '@nestjs/common';
import { MasterDataFormat } from '../../types/master-data.types';
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

  transformToMasterFormat(
    candidateData: any,
    context: TransformationContext
  ): MasterDataFormat {
    const masterData = this.createBaseMasterData(candidateData, context);
    
    // Map company and job title fields
    this.mapJobFields(candidateData);
    
    // Process name
    this.processNameData(candidateData, masterData);
    
    // Process contact information
    this.processNaukriContactData(candidateData, masterData);
    
    // Process profile information
    this.processNaukriProfileData(candidateData, masterData);
    
    // Process location
    this.processLocationData(candidateData, masterData);
    
    // Process work experience
    this.processNaukriWorkExperience(candidateData, masterData);
    
    // Process Naukri-specific data
    this.processNaukriSpecificData(candidateData, masterData);
    
    return masterData;
  }

  private mapJobFields(candidateData: any): void {
    // Map company and job title fields as done in Python
    candidateData.job_company_name = candidateData.company_name || '';
    candidateData.job_title = candidateData.current_designation || '';
    candidateData.url = candidateData.profile_url || '';
  }

  private processNaukriContactData(candidateData: any, masterData: MasterDataFormat): void {
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
        
        masterData.phone_numbers = cleanedPhones;
        masterData.all_numbers = cleanedPhones;
        
        if (cleanedPhones.length > 0) {
          masterData.phone_numbers = cleanedPhones;
          masterData.all_numbers = cleanedPhones;
        }
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
      
      masterData.email_address = cleanedEmails;
      masterData.all_mails = cleanedEmails;
      
      // Categorize emails
      masterData.emails.personal = cleanedEmails.filter(emailAddr => 
        !emailAddr.includes('@company.') && !emailAddr.includes('@corp.')
      );
    }
  }

  private processNaukriProfileData(candidateData: any, masterData: MasterDataFormat): void {
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

    masterData.profiles = [{
      title: '',
      network: 'data_upload',
      connections: null,
      username: profileId,
      is_primary: true,
      url: profileId,
    }];
    
    masterData.profile_url = profileUrl;
    masterData.profile_title = null;

    // Handle candidate profile (from resdex)
    if (candidateData.candidate_profile) {
      const candidateProfile = {
        title: candidateData.candidate_profile,
        network: 'resdex_naukri',
        connections: null,
        username: candidateData.uniqueId || '',
        is_primary: false,
        url: candidateData.candidate_profile,
      };
      
      masterData.profiles.push(candidateProfile);
      masterData.profile_url = candidateData.candidate_profile;
      masterData.profile_title = candidateData.candidate_profile;
    }
  }

  private processNaukriWorkExperience(candidateData: any, masterData: MasterDataFormat): void {
    const jobTitle = candidateData.job_title || '';
    const jobCompanyName = candidateData.job_company_name || '';

    if (jobTitle || jobCompanyName) {
      const experience = {
        title: {
          name: jobTitle,
          raw: jobTitle,
          role: jobTitle,
          sub_role: null,
          levels: [],
        },
        company: {
          name: jobCompanyName,
          size: null,
          founded: null,
          industry: null,
          linkedin_url: null,
          linkedin_id: null,
          facebook_url: null,
          twitter_url: null,
          website: null,
          ticker: null,
          type: null,
          raw: [],
          fuzzy_match: null,
          is_primary: true,
        },
        locations: [],
        start_date: null,
        end_date: null,
        summary: null,
        is_primary: true,
      };

      masterData.experience = [experience];
      masterData.job_company_name = jobCompanyName;
      masterData.job_title = jobTitle;
    }
  }

  private processNaukriSpecificData(candidateData: any, masterData: MasterDataFormat): void {
    // Process distance from job
    if (candidateData.distance_from_job) {
      masterData.job_process.events.push({
        type: 'distance_from_job',
        value: candidateData.distance_from_job,
        timestamp: new Date().toISOString(),
      });
    }

    // Process profile image
    const profileImage = candidateData.profileImageUrl || candidateData.photo;
    if (profileImage) {
      masterData.job_process.events.push({
        type: 'profile_picture',
        value: profileImage,
        timestamp: new Date().toISOString(),
      });
    }

    // Process social profiles based on URL type
    const url = candidateData.url || '';
    
    if (url.includes('resdex')) {
      masterData.job_process.events.push({
        type: 'resdex_profile_url',
        value: url,
        timestamp: new Date().toISOString(),
      });
    } else if (url.includes('hiring')) {
      masterData.job_process.events.push({
        type: 'hiring_naukri_url',
        value: url,
        timestamp: new Date().toISOString(),
      });
    } else if (url) {
      masterData.job_process.events.push({
        type: 'naukri_profile_url',
        value: url,
        timestamp: new Date().toISOString(),
      });
    }

    // Process unique key string if provided
    if (candidateData.unique_key_string) {
      masterData.unique_key_string = candidateData.unique_key_string;
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
        masterData.job_process.events.push({
          type: field,
          value: candidateData[field],
          timestamp: new Date().toISOString(),
        });
      }
    });
  }
}
