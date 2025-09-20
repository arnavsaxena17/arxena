import { Injectable } from '@nestjs/common';
import { UserProfile } from 'twenty-shared';
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

  transformToUserProfile(
    candidateData: any,
    context: TransformationContext
  ): UserProfile {
    const userProfile = this.createBaseUserProfile(candidateData, context);
    
    // Process name - LinkedIn Premium Jobs uses 'name_person' field
    this.processLinkedInPremiumJobsNameData(candidateData, userProfile);
    
    // Process profile information
    this.processLinkedInPremiumJobsProfileData(candidateData, userProfile);
    
    // Process contact information
    this.processLinkedInPremiumJobsContactData(candidateData, userProfile);
    
    // Process skills
    this.processSkillsData(candidateData, userProfile);
    
    // Process education
    this.processLinkedInPremiumJobsEducationData(candidateData, userProfile);
    
    // Process experience
    this.processLinkedInPremiumJobsExperienceData(candidateData, userProfile);
    
    // Process location
    this.processLinkedInPremiumJobsLocationData(candidateData, userProfile);
    
    // Process LinkedIn Premium Jobs specific data
    this.processLinkedInPremiumJobsSpecificData(candidateData, userProfile);
    
    return userProfile;
  }

  private processLinkedInPremiumJobsNameData(candidateData: any, userProfile: UserProfile): void {
    const namePerson = candidateData.name_person;
    
    if (!namePerson) {
      // Set empty name fields if no name_person
      userProfile.names = {
        firstName: '',
        lastName: '',
      };
      
      userProfile.firstName = '';
      userProfile.lastName = '';
      userProfile.fullName = '';
      userProfile.middleName = '';
      userProfile.middleInitial = '';
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

    // Update user profile with processed name information
    userProfile.names = {
      firstName: firstName,
      lastName: lastName,
    };
    
    userProfile.firstName = firstName;
    userProfile.lastName = lastName;
    userProfile.middleName = middleName;
    userProfile.fullName = namePerson;
    userProfile.middleInitial = middleInitial;
  }

  private processLinkedInPremiumJobsProfileData(candidateData: any, userProfile: UserProfile): void {
    const profileTitle = candidateData.profile_title;
    const jobsProfileUrlLocation = candidateData.jobs_profile_url_location;
    const linkedinUrl = candidateData.linkedin_url || candidateData.linkedinUrl;

    // Add jobs profile
    if (profileTitle && jobsProfileUrlLocation) {
      userProfile.profileTitle = profileTitle;
      
      if (jobsProfileUrlLocation) {
        // this.addJobProcessEvent(userProfile, 'jobs_profile_url', jobsProfileUrlLocation);
      }
    }

    // Add LinkedIn profile
    if (linkedinUrl) {
      const linkedinFullUrl = `https://linkedin.com/${linkedinUrl}`;
      userProfile.profileUrl = linkedinFullUrl;
      userProfile.linkedinUrl = linkedinFullUrl;
    }
  }

  private processLinkedInPremiumJobsContactData(candidateData: any, userProfile: UserProfile): void {
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
      
      userProfile.phoneNumbers = cleanedPhones;
      userProfile.phoneNumber = cleanedPhones[0] || '';
    }

    // Process email addresses
    if (candidateData.email_address) {
      const cleanedEmails = this.dataProcessingUtils.cleanEmailAddresses(candidateData.email_address);
      
      userProfile.emailAddresses = cleanedEmails;
      userProfile.emailAddress = cleanedEmails[0] || '';
      
      // Categorize emails

    }
  }

  private processLinkedInPremiumJobsEducationData(candidateData: any, userProfile: UserProfile): void {
    const education = candidateData.education;
    
    if (education && Array.isArray(education)) {
      const educationArray: any[] = [];
      
      // PG Education (first item)
      if (education[0]) {
        const pgEducation = education[0];
        educationArray.push({
          institute: {
            name: pgEducation.institute || null,
            type: 'pg',
            location: null,
            profiles: [],
            website: null,
          },
          degrees: pgEducation.degree || null,
          start_date: null,
          end_date: pgEducation.duration || null,
          gpa: null,
          majors: [],
          minors: [],
          locations: null,
        });
        
        // Set PG specific fields
        // this.addJobProcessEvent(userProfile, 'education_institute_pg', pgEducation.institute || '');
        // this.addJobProcessEvent(userProfile, 'pg_degree', pgEducation.degree || '');
      }
      
      // UG Education (second item)
      if (education[1]) {
        const ugEducation = education[1];
        educationArray.push({
          institute: {
            name: ugEducation.institute || null,
            type: 'ug',
            location: null,
            profiles: [],
            website: null,
          },
          degrees: ugEducation.degree || null,
          start_date: null,
          end_date: ugEducation.duration || null,
          gpa: null,
          majors: [],
          minors: [],
          locations: null,
        });
        
        // Set UG specific fields
        // this.addJobProcessEvent(userProfile, 'education_institute_ug', ugEducation.institute || '');
        
        // this.addJobProcessEvent(userProfile, 'ug_degree', ugEducation.degree || '');
      }
      
      userProfile.education = educationArray;
    }
  }

  private processLinkedInPremiumJobsExperienceData(candidateData: any, userProfile: UserProfile): void {
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
        userProfile.jobCompanyName = experience[0].company_name || null;
        userProfile.jobTitle = experience[0].job_title || null;
      }
      
      // Set salary and experience to null as per Python code
      userProfile.inferredSalary = null;
      userProfile.inferredYearsExperience = null;
    }
  }

  private processLinkedInPremiumJobsLocationData(candidateData: any, userProfile: UserProfile): void {
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

  private processLinkedInPremiumJobsSpecificData(candidateData: any, userProfile: UserProfile): void {
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
        // std_function: '', // Will be filled by standardization service
        // std_grade: '', // Will be filled by standardization service
        // std_function_root: '', // Will be filled by standardization service
      // });
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
        // this.addJobProcessEvent(userProfile, field, candidateData[field]);
      }
    });
  }
}
