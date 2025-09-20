import { Injectable } from '@nestjs/common';
import { UserProfile } from 'twenty-shared';
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

  transformToUserProfile(
    candidateData: any,
    context: TransformationContext
  ): UserProfile {
    const userProfile = this.createBaseUserProfile(candidateData, context);
    
    // Process name
    this.processNameData(candidateData, userProfile);
    
    // Process profile information
    this.processLinkedInRecruiterProfileData(candidateData, userProfile);
    
    // Process contact information
    this.processLinkedInRecruiterContactData(candidateData, userProfile);
    
    // Process skills
    this.processSkillsData(candidateData, userProfile);
    
    // Process education
    this.processLinkedInRecruiterEducationData(candidateData, userProfile);
    
    // Process experience
    this.processLinkedInRecruiterExperienceData(candidateData, userProfile);
    
    // Process location
    this.processLinkedInRecruiterLocationData(candidateData, userProfile);
    
    // Process LinkedIn Recruiter specific data
    this.processLinkedInRecruiterSpecificData(candidateData, userProfile);
    
    return userProfile;
  }

  private processLinkedInRecruiterProfileData(candidateData: any, userProfile: UserProfile): void {
    const recruiterProfileUrl = candidateData.recruiter_profile_url;
    const publicLinkedInUrl = candidateData.public_linkedin_url || candidateData.linkedin_url || candidateData.linkedinUrl;
    const title = candidateData.title || candidateData.profile_headline || '';

    if (publicLinkedInUrl || recruiterProfileUrl) {
      userProfile.profileUrl = publicLinkedInUrl || recruiterProfileUrl || '';
      userProfile.linkedinUrl = publicLinkedInUrl || '';
      userProfile.profileTitle = title;
    }
  }

  private processLinkedInRecruiterContactData(candidateData: any, userProfile: UserProfile): void {
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
      
      userProfile.phoneNumbers = cleanedPhones;
      userProfile.phoneNumber = cleanedPhones[0] || '';
    }

    // Process email addresses
    if (candidateData.contact_email) {
      const cleanedEmails = this.dataProcessingUtils.cleanEmailAddresses(candidateData.contact_email);
      
      userProfile.emailAddresses = cleanedEmails;
      userProfile.emailAddress = cleanedEmails[0] || '';
      

    }
  }

  private processLinkedInRecruiterEducationData(candidateData: any, userProfile: UserProfile): void {
    const education = candidateData.education;
    
    if (education) {
      const educationArray: any[] = [];
      
      // PG Education
      if (education.pg) {
        educationArray.push({
          institute: {
            name: education.pg.institute || null,
            type: 'pg',
            location: null,
            profiles: [],
            website: null,
          },
          degrees: education.pg.course || null,
          start_date: null,
          end_date: education.pg.year || null,
          gpa: null,
          majors: [],
          minors: [],
          locations: null,
        });
      }
      
      // UG Education
      if (education.ug) {
        educationArray.push({
          institute: {
            name: education.ug.institute || null,
            type: 'ug',
            location: null,
            profiles: [],
            website: null,
          },
          degrees: education.ug.course || null,
          start_date: null,
          end_date: education.ug.year || null,
          gpa: null,
          majors: [],
          minors: [],
          locations: null,
        });
      }
      
      userProfile.education = educationArray;
    }
  }

  private processLinkedInRecruiterExperienceData(candidateData: any, userProfile: UserProfile): void {
    const experience = candidateData.experience;
    
    if (experience && Array.isArray(experience)) {
      const experienceArray = experience.map((exp, index) => ({
        title: {
          name: exp.job_title || '',
        },
        company: {
          name: exp.company_name || '',
        },
        startDate: exp.startDate || exp.start_date || null,
        endDate: exp.endDate || exp.end_date || null,
      }));

      userProfile.experience = experienceArray;
      
      // Set top-level fields from first experience
      if (experience.length > 0) {
        userProfile.jobCompanyName = experience[0].company_name || '';
        userProfile.jobTitle = experience[0].job_title || '';
      }
      
      // Set salary and experience to null as per Python code
      userProfile.inferredSalary = null;
      userProfile.inferredYearsExperience = null;
    }
  }

  private processLinkedInRecruiterLocationData(candidateData: any, userProfile: UserProfile): void {
    const locationName = candidateData.location_name || candidateData.profile_location;
    
    if (locationName) {
      userProfile.locations = [{
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
      
      userProfile.locationName = locationName;
    }
  }

  private processLinkedInRecruiterSpecificData(candidateData: any, userProfile: UserProfile): void {
    // Process industry
    if (candidateData.industry) {
      userProfile.industries = [{
        name: candidateData.industry,
        is_primary: true,
      }];
    }

    // Process notice period
    if (candidateData.noticePeriod) {
      // this.addJobProcessEvent(userProfile, 'notice_period', candidateData.noticePeriod);
    }

    // Process social profiles
    if (candidateData.recruiter_profile_url) {
      // this.addJobProcessEvent(userProfile, 'linkedin_recruiter_profile', candidateData.recruiter_profile_url);
    }

    if (candidateData.public_linkedin_url) {
      // this.addJobProcessEvent(userProfile, 'linkedin_public_profile', candidateData.public_linkedin_url);
    }

    // Process standardization data
    const jobTitle = userProfile.jobTitle;
    if (jobTitle) {
      // this.addJobProcessEvent(userProfile, 'job_title_standardization', {
      //   std_function: '', // Will be filled by standardization service
      //   std_grade: '', // Will be filled by standardization service
      //   std_function_root: '', // Will be filled by standardization service
      // });
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
