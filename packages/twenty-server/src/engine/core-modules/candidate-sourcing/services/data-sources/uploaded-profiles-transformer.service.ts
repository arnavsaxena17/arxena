import { Injectable } from '@nestjs/common';
import { MasterDataFormat } from '../../types/master-data.types';
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

  transformToMasterFormat(
    candidateData: any,
    context: TransformationContext
  ): MasterDataFormat {
    const masterData = this.createBaseMasterData(candidateData, context);
    
    // Process name
    this.processNameData(candidateData, masterData);
    
    // Process contact information
    this.processUploadedContactData(candidateData, masterData);
    
    // Process profile information
    this.processUploadedProfileData(candidateData, masterData);
    
    // Process location
    this.processUploadedLocationData(candidateData, masterData);
    
    // Process work experience
    this.processUploadedWorkExperience(candidateData, masterData);
    
    // Process uploaded-specific data
    this.processUploadedSpecificData(candidateData, masterData);
    
    return masterData;
  }

  private processUploadedContactData(candidateData: any, masterData: MasterDataFormat): void {
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

  private processUploadedProfileData(candidateData: any, masterData: MasterDataFormat): void {
    const fullName = candidateData.full_name;
    const jobCompanyName = candidateData.job_company_name;
    
    // Generate profile ID
    let profileId = '';
    if (fullName && jobCompanyName) {
      profileId = (fullName.replace(/\s/g, '').toLowerCase() + 
                   jobCompanyName.replace(/\s/g, '').toLowerCase());
    }

    masterData.profiles = [{
      title: '',
      network: 'data_upload',
      connections: null,
      username: profileId,
      is_primary: true,
      url: profileId,
    }];
    
    masterData.profile_url = profileId;
    masterData.profile_title = null;

    // Handle candidate profile (from resdex if present)
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

  private processUploadedLocationData(candidateData: any, masterData: MasterDataFormat): void {
    const location = candidateData.location;
    
    if (location) {
      masterData.locations = [{
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
      
      masterData.location_name = location;
    }
  }

  private processUploadedWorkExperience(candidateData: any, masterData: MasterDataFormat): void {
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

  private processUploadedSpecificData(candidateData: any, masterData: MasterDataFormat): void {
    // Process distance from job
    if (candidateData.distance_from_job) {
      masterData.job_process.events.push({
        type: 'distance_from_job',
        value: candidateData.distance_from_job,
        timestamp: new Date().toISOString(),
      });
    }

    // Process creation source and data sources
    const creationData = {
      created: Date.now(),
      creation_source: 'data_upload',
      data_sources: ['data_upload'],
    };
    
    masterData.job_process.events.push({
      type: 'creation_particulars',
      value: creationData,
      timestamp: new Date().toISOString(),
    });

    // Process social profiles
    masterData.job_process.events.push({
      type: 'linkedin_social_profile',
      value: null,
      timestamp: new Date().toISOString(),
    });

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
        masterData.job_process.events.push({
          type: field,
          value: candidateData[field],
          timestamp: new Date().toISOString(),
        });
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
        masterData.job_process.events.push({
          type: `uploaded_${key}`,
          value: candidateData[key],
          timestamp: new Date().toISOString(),
        });
      }
    });
  }
}
