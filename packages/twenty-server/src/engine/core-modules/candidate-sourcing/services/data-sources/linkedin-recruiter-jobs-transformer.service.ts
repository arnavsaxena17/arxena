import { Injectable } from '@nestjs/common';
import { MasterDataEducation, MasterDataFormat, MasterDataProfile } from '../../types/master-data.types';
import { DataProcessingUtils } from '../../utils/data-processing.utils';
import { BaseDataSourceTransformerService, TransformationContext } from './base-data-source-transformer.service';

@Injectable()
export class LinkedinRecruiterJobsTransformerService extends BaseDataSourceTransformerService {
  constructor(dataProcessingUtils: DataProcessingUtils) {
    super(dataProcessingUtils);
  }

  getDataSourceIdentifier(): string {
    return 'linkedin_recruiter_jobs';
  }

  transformToMasterFormat(
    candidateData: any,
    context: TransformationContext
  ): MasterDataFormat {
    const masterData = this.createBaseMasterData(candidateData, context);
    
    // Process name
    this.processNameData(candidateData, masterData);
    
    // Process profile information
    this.processLinkedInRecruiterProfileData(candidateData, masterData);
    
    // Process contact information
    this.processLinkedInRecruiterContactData(candidateData, masterData);
    
    // Process skills
    this.processSkillsData(candidateData, masterData);
    
    // Process education
    this.processLinkedInRecruiterEducationData(candidateData, masterData);
    
    // Process experience
    this.processLinkedInRecruiterExperienceData(candidateData, masterData);
    
    // Process location
    this.processLinkedInRecruiterLocationData(candidateData, masterData);
    
    // Process LinkedIn Recruiter specific data
    this.processLinkedInRecruiterSpecificData(candidateData, masterData);
    
    return masterData;
  }

  private processLinkedInRecruiterProfileData(candidateData: any, masterData: MasterDataFormat): void {
    const recruiterProfileUrl = candidateData.recruiter_profile_url;
    const publicLinkedInUrl = candidateData.public_linkedin_url;
    const title = candidateData.title || candidateData.profile_headline || '';

    const profiles: MasterDataProfile[] = [];

    // Add recruiter profile
    if (recruiterProfileUrl) {
      profiles.push({
        title: title,
        network: 'linkedin_recruiter',
        connections: null,
        username: publicLinkedInUrl || recruiterProfileUrl,
        is_primary: false,
        url: publicLinkedInUrl || recruiterProfileUrl,
      });
    }

    // Add public LinkedIn profile
    if (publicLinkedInUrl) {
      profiles.push({
        title: title,
        network: 'linkedin_recruiter',
        connections: null,
        username: publicLinkedInUrl,
        is_primary: false,
        url: publicLinkedInUrl,
      });
    }

    if (profiles.length > 0) {
      masterData.profiles = profiles;
      masterData.profile_url = publicLinkedInUrl || recruiterProfileUrl || '';
      masterData.profile_title = title;
    }
  }

  private processLinkedInRecruiterContactData(candidateData: any, masterData: MasterDataFormat): void {
    // Process phone numbers
    const phoneNumbers = candidateData.phone_numbers;
    
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
        masterData.phone_numbers = cleanedPhones;
        masterData.all_numbers = cleanedPhones;
      }
    }

    // Process email addresses
    if (candidateData.contact_email) {
      const cleanedEmails = this.dataProcessingUtils.cleanEmailAddresses(candidateData.contact_email);
      
      masterData.email_address = cleanedEmails;
      masterData.all_mails = cleanedEmails;
      
      // Categorize emails
      masterData.emails.personal = cleanedEmails.filter(email => 
        !email.includes('@company.') && !email.includes('@corp.')
      );
    }
  }

  private processLinkedInRecruiterEducationData(candidateData: any, masterData: MasterDataFormat): void {
    const education = candidateData.education;
    
    if (education) {
      const educationArray: MasterDataEducation[] = [];
      
      // PG Education
      if (education.pg) {
        educationArray.push({
          school: {
            name: education.pg.institute || null,
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
          degrees: [education.pg.course || ''],
          start_date: null,
          end_date: education.pg.year || null,
          gpa: null,
          summary: null,
          is_primary: true,
        });
      }
      
      // UG Education
      if (education.ug) {
        educationArray.push({
          school: {
            name: education.ug.institute || null,
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
          degrees: [education.ug.course || ''],
          start_date: null,
          end_date: education.ug.year || null,
          gpa: null,
          summary: null,
          is_primary: false,
        });
      }
      
      masterData.education = educationArray;
    }
  }

  private processLinkedInRecruiterExperienceData(candidateData: any, masterData: MasterDataFormat): void {
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

  private processLinkedInRecruiterLocationData(candidateData: any, masterData: MasterDataFormat): void {
    const locationName = candidateData.location_name || candidateData.profile_location;
    
    if (locationName) {
      masterData.locations = [{
        name: locationName,
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
      
      masterData.location_name = locationName;
    }
  }

  private processLinkedInRecruiterSpecificData(candidateData: any, masterData: MasterDataFormat): void {
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

    // Process additional LinkedIn Recruiter specific fields
    const recruiterSpecificFields = [
      'candidate_id',
      'search_id',
      'recruiter_id',
      'connection_degree',
      'profile_views',
      'saved_date',
      'contacted_date',
    ];

    recruiterSpecificFields.forEach(field => {
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
