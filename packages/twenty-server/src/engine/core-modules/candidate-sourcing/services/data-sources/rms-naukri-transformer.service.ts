import { Injectable } from '@nestjs/common';
import { UserProfile } from 'twenty-shared';
import { DataProcessingUtils } from '../../utils/data-processing.utils';
import { BaseDataSourceTransformerService, TransformationContext } from './base-data-source-transformer.service';

@Injectable()
export class RmsNaukriTransformerService extends BaseDataSourceTransformerService {
  constructor(dataProcessingUtils: DataProcessingUtils) {
    super(dataProcessingUtils);
  }

  getDataSourceIdentifier(): string {
    return 'rms_naukri';
  }

  transformToUserProfile(
    candidateData: any,
    context: TransformationContext
  ): UserProfile {
    const userProfile = this.createBaseUserProfile(candidateData, context);
    
    // Process name - RMS uses 'full_name' field
    this.processRmsNameData(candidateData, userProfile);
    
    // Process contact information
    this.processContactData(candidateData, userProfile);
    
    // Process profile information
    this.processRmsProfileData(candidateData, userProfile);
    
    // Process location
    this.processRmsLocationData(candidateData, userProfile);
    
    // Process skills
    this.processRmsSkillsData(candidateData, userProfile);
    
    // Process experience
    this.processRmsExperienceData(candidateData, userProfile);
    
    // Process education
    this.processRmsEducationData(candidateData, userProfile);
    
    // Process RMS-specific data
    this.processRmsSpecificData(candidateData, userProfile);
    
    return userProfile;
  }

  private processRmsNameData(candidateData: any, userProfile: UserProfile): void {
    const fullName = candidateData.full_name || candidateData.fullName || '';
    
    if (fullName) {
      const nameResult = this.dataProcessingUtils.processName(fullName);
      
      // Update user profile with processed name information
      userProfile.names = {
        firstName: nameResult.first_name,
        lastName: nameResult.last_name,
      };
      
      userProfile.firstName = nameResult.first_name;
      userProfile.lastName = nameResult.last_name;
      userProfile.middleName = nameResult.middle_name;
      userProfile.fullName = nameResult.full_name;
      userProfile.middleInitial = nameResult.middle_initial;
    }
  }

  private processRmsProfileData(candidateData: any, userProfile: UserProfile): void {
    const profileIntro = candidateData.profile_intro;
    const profileId = candidateData.id;
    
    if (profileIntro && profileId) {
      userProfile.profileTitle = profileIntro;
      userProfile.profileUrl = profileId;
    }
  }

  private processRmsLocationData(candidateData: any, userProfile: UserProfile): void {
    const currentLocation = candidateData.current_location;
    
    if (currentLocation) {
      userProfile.locations = [{
        name: currentLocation,
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
      
      userProfile.locationName = currentLocation;
    }
  }

  private processRmsSkillsData(candidateData: any, userProfile: UserProfile): void {
    const keySkills = candidateData.keySkills;
    
    if (keySkills) {
      const skillsArray = keySkills.split(',  ').map((skill: string) => skill.trim());
      userProfile.skills = skillsArray.join(', ');
      userProfile.keySkills = skillsArray.join(', ');
    }
  }

  private processRmsEducationData(candidateData: any, userProfile: UserProfile): void {
    const education = candidateData.education;
    
    if (education) {
      const educationArray: any[] = [];
      
      // PG Education
      if (education.pg_institute) {
        educationArray.push({
          institute: {
            name: education.pg_institute,
            type: 'pg',
            location: null,
            profiles: [],
            website: null,
          },
          degrees: education.pg_institute,
          start_date: null,
          end_date: null,
          gpa: null,
          majors: [],
          minors: [],
          locations: null,
        });
      }
      
      // UG Education
      if (education.ug_institute) {
        educationArray.push({
          institute: {
            name: education.ug_institute,
            type: 'ug',
            location: null,
            profiles: [],
            website: null,
          },
          degrees: education.ug_institute,
          start_date: null,
          end_date: null,
          gpa: null,
          majors: [],
          minors: [],
          locations: null,
        });
      }
      
      userProfile.education = educationArray;
    }
  }

  private processRmsExperienceData(candidateData: any, userProfile: UserProfile): void {
    const currentCompany = candidateData.current_company;
    const currentDesignation = candidateData.current_designation;
    const previousCompany = candidateData.previous_company;
    const previousDesignation = candidateData.previous_designation;
    const experienceInYears = candidateData.experience_in_years;
    const ctc = candidateData.ctc;

    const experienceArray: any[] = [];

    // Current designation
    if (currentCompany || currentDesignation) {
      experienceArray.push({
        title: {
          name: currentDesignation || '',
        },
        company: {
          name: currentCompany || '',
        },
      });
    }

    // Previous designation
    if (previousCompany || previousDesignation) {
      experienceArray.push({
        title: {
          name: previousDesignation || '',
        },
        company: {
          name: previousCompany || '',
        },
      });
    }

    userProfile.experience = experienceArray;
    
    // Set top-level fields
    userProfile.jobCompanyName = currentCompany || '';
    userProfile.jobTitle = currentDesignation || '';
    userProfile.inferredSalary = this.dataProcessingUtils.extractSalaryNumber(ctc);
    userProfile.inferredYearsExperience = experienceInYears || null;
  }

  private processRmsSpecificData(candidateData: any, userProfile: UserProfile): void {
    // Process industry
    if (candidateData.industry) {
      userProfile.industries = [{
        name: candidateData.industry,
        is_primary: true,
      }];
    }

    // Process job application specific data
    const appliedOnDate = candidateData.applied_on_date;
    const activeDate = candidateData.active_date;
    const modifiedDate = candidateData.modified_date;

    if (appliedOnDate) {
      // this.addProjectProcessEvent(userProfile, 'job_application_date', appliedOnDate);
    }

    if (activeDate) {
      // this.addProjectProcessEvent(userProfile, 'rms_active_date', activeDate);
    }

    if (modifiedDate) {
      // this.addProjectProcessEvent(userProfile, 'rms_modified_date', modifiedDate);
    }

    // Process social profiles
    if (candidateData.profile_url) {
      // this.addProjectProcessEvent(userProfile, 'rms_profile_url', candidateData.profile_url);
    }

    // Process additional RMS specific fields
    const rmsSpecificFields = [
      'candidate_id',
      'recruiter_id',
      'source_type',
    ];

    rmsSpecificFields.forEach(field => {
      if (candidateData[field]) {
        // this.addProjectProcessEvent(userProfile, field, candidateData[field]);
      }
    });
  }

  /**
   * Add event to job process - utility method for UserProfile
   */
  // protected addProjectProcessEvent(userProfile: UserProfile, type: string, value: any): void {
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
