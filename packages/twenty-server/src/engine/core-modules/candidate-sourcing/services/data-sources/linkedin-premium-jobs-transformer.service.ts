import { Injectable } from '@nestjs/common';
import { MasterDataEducation, MasterDataFormat, MasterDataProfile } from '../../types/master-data.types';
import { DataProcessingUtils } from '../../utils/data-processing.utils';
import { BaseDataSourceTransformerService, TransformationContext } from './base-data-source-transformer.service';

@Injectable()
export class LinkedinPremiumJobsTransformerService extends BaseDataSourceTransformerService {
  constructor(dataProcessingUtils: DataProcessingUtils) {
    super(dataProcessingUtils);
  }

  getDataSourceIdentifier(): string {
    return 'linkedin_premium_jobs';
  }

  transformToMasterFormat(
    candidateData: any,
    context: TransformationContext
  ): MasterDataFormat {
    const masterData = this.createBaseMasterData(candidateData, context);
    
    // Process name - LinkedIn Premium Jobs uses 'name_person' field
    this.processLinkedInPremiumJobsNameData(candidateData, masterData);
    
    // Process profile information
    this.processLinkedInPremiumJobsProfileData(candidateData, masterData);
    
    // Process contact information
    this.processLinkedInPremiumJobsContactData(candidateData, masterData);
    
    // Process skills
    this.processSkillsData(candidateData, masterData);
    
    // Process education
    this.processLinkedInPremiumJobsEducationData(candidateData, masterData);
    
    // Process experience
    this.processLinkedInPremiumJobsExperienceData(candidateData, masterData);
    
    // Process location
    this.processLinkedInPremiumJobsLocationData(candidateData, masterData);
    
    // Process LinkedIn Premium Jobs specific data
    this.processLinkedInPremiumJobsSpecificData(candidateData, masterData);
    
    return masterData;
  }

  private processLinkedInPremiumJobsNameData(candidateData: any, masterData: MasterDataFormat): void {
    const namePerson = candidateData.name_person;
    
    if (!namePerson) {
      // Set empty name fields if no name_person
      masterData.names = {
        first_name: '',
        last_name: '',
        title: null,
        middle_name: '',
        middle_initial: '',
        name: '',
        is_primary: true,
      };
      
      masterData.first_name = '';
      masterData.last_name = '';
      masterData.full_name = '';
      masterData.middle_name = '';
      masterData.middle_initial = '';
      return;
    }

    const fullNameSplit = namePerson.trim().split(' ');
    let firstName = '';
    let middleName = '';
    let middleInitial = '';
    let lastName = '';

    if (fullNameSplit.length === 2) {
      firstName = fullNameSplit[0];
      lastName = fullNameSplit[1];
    } else if (fullNameSplit.length === 3) {
      firstName = fullNameSplit[0];
      middleName = fullNameSplit[1];
      middleInitial = middleName.charAt(0);
      lastName = fullNameSplit[2];
    } else if (fullNameSplit.length === 1) {
      firstName = fullNameSplit[0];
    } else {
      // Handle cases with more than 3 names - take first and last
      firstName = fullNameSplit[0];
      lastName = fullNameSplit[fullNameSplit.length - 1];
    }

    // Update master data with processed name information
    masterData.names = {
      first_name: firstName,
      last_name: lastName,
      title: null,
      middle_name: middleName,
      middle_initial: middleInitial,
      name: namePerson,
      is_primary: true,
    };
    
    masterData.first_name = firstName;
    masterData.last_name = lastName;
    masterData.middle_name = middleName;
    masterData.full_name = namePerson;
    masterData.middle_initial = middleInitial;
  }

  private processLinkedInPremiumJobsProfileData(candidateData: any, masterData: MasterDataFormat): void {
    const profileTitle = candidateData.profile_title;
    const jobsProfileUrlLocation = candidateData.jobs_profile_url_location;
    const linkedinUrl = candidateData.linkedin_url;

    const profiles: MasterDataProfile[] = [];

    // Add jobs profile
    if (profileTitle && jobsProfileUrlLocation) {
      profiles.push({
        title: profileTitle,
        network: 'linkedin_premium_jobs',
        connections: null,
        username: jobsProfileUrlLocation,
        is_primary: false,
        url: linkedinUrl ? `https://linkedin.com/${linkedinUrl}` : '',
      });
      
      masterData.profile_title = profileTitle;
      
      if (jobsProfileUrlLocation) {
        masterData.job_process.events.push({
          type: 'jobs_profile_url',
          value: jobsProfileUrlLocation,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Add LinkedIn profile
    if (linkedinUrl) {
      const linkedinFullUrl = `https://linkedin.com/${linkedinUrl}`;
      
      profiles.push({
        title: profileTitle || '',
        network: 'linkedin',
        connections: null,
        username: linkedinFullUrl,
        is_primary: false,
        url: linkedinFullUrl,
      });
      
      masterData.profile_url = linkedinFullUrl;
    }

    if (profiles.length > 0) {
      masterData.profiles = profiles;
    }
  }

  private processLinkedInPremiumJobsContactData(candidateData: any, masterData: MasterDataFormat): void {
    // Process phone numbers
    const phoneNumbers = candidateData.phone_number;
    
    if (phoneNumbers && Array.isArray(phoneNumbers)) {
      const cleanedPhones: string[] = [];
      
      phoneNumbers.forEach(phone => {
        const cleanedPhone = this.dataProcessingUtils.cleanPhoneNumbers(phone);
        if (Array.isArray(cleanedPhone)) {
          cleanedPhones.push(...cleanedPhone);
        } else if (cleanedPhone) {
          cleanedPhones.push(cleanedPhone);
        }
      });
      
      masterData.phone_numbers = cleanedPhones;
      masterData.all_numbers = cleanedPhones;
      
      if (cleanedPhones.length > 0) {
        if (cleanedPhones.length > 0) {
          masterData.phone_numbers = cleanedPhones;
          masterData.all_numbers = cleanedPhones;
        }
      }
    }

    // Process email addresses
    if (candidateData.email_address) {
      const cleanedEmails = this.dataProcessingUtils.cleanEmailAddresses(candidateData.email_address);
      
      masterData.email_address = cleanedEmails;
      masterData.all_mails = cleanedEmails;
      
      // Categorize emails
      masterData.emails.personal = cleanedEmails.filter(email => 
        !email.includes('@company.') && !email.includes('@corp.')
      );
    }
  }

  private processLinkedInPremiumJobsEducationData(candidateData: any, masterData: MasterDataFormat): void {
    const education = candidateData.education;
    
    if (education && Array.isArray(education)) {
      const educationArray: MasterDataEducation[] = [];
      
      // PG Education (first item)
      if (education[0]) {
        const pgEducation = education[0];
        educationArray.push({
          school: {
            name: pgEducation.institute || null,
            type: 'pg',
            id: null,
            location: {
              name: null,
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
              most_recent: null,
              is_primary: null,
              last_updated: null,
            },
            linkedin_url: null,
            facebook_url: null,
            twitter_url: null,
            linkedin_id: null,
            website: null,
            domain: null,
            raw: [],
          },
          degrees: [pgEducation.degree || ''],
          start_date: null,
          end_date: pgEducation.duration || null,
          gpa: null,
          summary: null,
          is_primary: true,
        });
        
        // Set PG specific fields
        masterData.job_process.events.push({
          type: 'education_institute_pg',
          value: pgEducation.institute || '',
          timestamp: new Date().toISOString(),
        });
        
        masterData.job_process.events.push({
          type: 'pg_degree',
          value: pgEducation.degree || '',
          timestamp: new Date().toISOString(),
        });
      }
      
      // UG Education (second item)
      if (education[1]) {
        const ugEducation = education[1];
        educationArray.push({
          school: {
            name: ugEducation.institute || null,
            type: 'ug',
            id: null,
            location: {
              name: null,
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
              most_recent: null,
              is_primary: null,
              last_updated: null,
            },
            linkedin_url: null,
            facebook_url: null,
            twitter_url: null,
            linkedin_id: null,
            website: null,
            domain: null,
            raw: [],
          },
          degrees: [ugEducation.degree || ''],
          start_date: null,
          end_date: ugEducation.duration || null,
          gpa: null,
          summary: null,
          is_primary: false,
        });
        
        // Set UG specific fields
        masterData.job_process.events.push({
          type: 'education_institute_ug',
          value: ugEducation.institute || '',
          timestamp: new Date().toISOString(),
        });
        
        masterData.job_process.events.push({
          type: 'ug_degree',
          value: ugEducation.degree || '',
          timestamp: new Date().toISOString(),
        });
      }
      
      masterData.education = educationArray;
    }
  }

  private processLinkedInPremiumJobsExperienceData(candidateData: any, masterData: MasterDataFormat): void {
    const experience = candidateData.experience;
    
    if (experience && Array.isArray(experience)) {
      const experienceArray = experience.map((exp, index) => ({
        title: {
          name: exp.job_title || null,
          raw: exp.job_title || null,
          role: exp.job_title || null,
          sub_role: null,
          levels: [],
        },
        company: {
          name: exp.company_name || null,
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
          is_primary: index === 0,
        },
        locations: [],
        start_date: null,
        end_date: null,
        summary: null,
        is_primary: index === 0,
      }));

      masterData.experience = experienceArray;
      
      // Set top-level fields from first experience
      if (experience.length > 0) {
        masterData.job_company_name = experience[0].company_name || null;
        masterData.job_title = experience[0].job_title || null;
      }
      
      // Set salary and experience to null as per Python code
      masterData.inferred_salary = null;
      masterData.inferred_years_experience = null;
    }
  }

  private processLinkedInPremiumJobsLocationData(candidateData: any, masterData: MasterDataFormat): void {
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

  private processLinkedInPremiumJobsSpecificData(candidateData: any, masterData: MasterDataFormat): void {
    // Process industry
    if (candidateData.industry) {
      masterData.industries = [{
        name: candidateData.industry,
        is_primary: true,
      }];
    }

    // Process notice period
    if (candidateData.noticePeriod) {
      masterData.job_process.events.push({
        type: 'notice_period',
        value: candidateData.noticePeriod,
        timestamp: new Date().toISOString(),
      });
    }

    // Process social profiles
    if (candidateData.recruiter_profile_url) {
      masterData.job_process.events.push({
        type: 'linkedin_recruiter_profile',
        value: candidateData.recruiter_profile_url,
        timestamp: new Date().toISOString(),
      });
    }

    if (candidateData.public_linkedin_url) {
      masterData.job_process.events.push({
        type: 'linkedin_public_profile',
        value: candidateData.public_linkedin_url,
        timestamp: new Date().toISOString(),
      });
    }

    // Process standardization data
    const jobTitle = masterData.job_title;
    if (jobTitle) {
      masterData.job_process.events.push({
        type: 'job_title_standardization',
        value: {
          std_function: '', // Will be filled by standardization service
          std_grade: '', // Will be filled by standardization service
          std_function_root: '', // Will be filled by standardization service
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Process additional LinkedIn Premium Jobs specific fields
    const premiumJobsSpecificFields = [
      'candidate_id',
      'search_id',
      'connection_degree',
      'profile_views',
      'saved_date',
      'contacted_date',
      'response_rate',
      'profile_match_score',
    ];

    premiumJobsSpecificFields.forEach(field => {
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
