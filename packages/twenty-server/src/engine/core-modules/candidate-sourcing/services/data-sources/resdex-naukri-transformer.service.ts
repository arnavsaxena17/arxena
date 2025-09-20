import { Injectable } from '@nestjs/common';
import { UserProfile } from 'twenty-shared';
import { DataProcessingUtils } from '../../utils/data-processing.utils';
import { BaseDataSourceTransformerService, TransformationContext } from './base-data-source-transformer.service';

@Injectable()
export class ResdexNaukriTransformerService extends BaseDataSourceTransformerService {
  constructor(dataProcessingUtils: DataProcessingUtils) {
    super(dataProcessingUtils);
  }

  getDataSourceIdentifier(): string {
    return 'resdex_naukri';
  }

  transformToUserProfile(
    candidateData: any,
    context: TransformationContext
  ): UserProfile {
    const userProfile = this.createBaseUserProfile(candidateData, context);
    
    // Process name - Resdex uses 'jsUserName' field
    this.processResdexNameData(candidateData, userProfile);
    
    // Process contact information
    this.processContactData(candidateData, userProfile);
    
    // Process profile information
    this.processResdexProfileData(candidateData, userProfile);
    
    // Process location
    this.processResdexLocationData(candidateData, userProfile);
    
    // Process skills
    this.processResdexSkillsData(candidateData, userProfile);
    
    // Process experience
    this.processResdexExperienceData(candidateData, userProfile);
    
    // Process education
    this.processResdexEducationData(candidateData, userProfile);
    
    // Process salary
    this.processResdexSalaryData(candidateData, userProfile);
    
    // Process other Resdex-specific fields
    this.processResdexSpecificData(candidateData, userProfile);
    
    return userProfile;
  }

  private processResdexNameData(candidateData: any, userProfile: UserProfile): void {
    const fullName = candidateData.jsUserName || candidateData.name || '';
    const nameInfo = this.dataProcessingUtils.processName(fullName);
    
    userProfile.names = {
      firstName: nameInfo.first_name,
      lastName: nameInfo.last_name,
    };
    
    userProfile.firstName = nameInfo.first_name;
    userProfile.lastName = nameInfo.last_name;
    userProfile.middleName = nameInfo.middle_name;
    userProfile.middleInitial = nameInfo.middle_initial;
    userProfile.fullName = nameInfo.full_name;
  }

  private processResdexProfileData(candidateData: any, userProfile: UserProfile): void {
    const profileUrl = candidateData.profile_url || candidateData.profileUrl;
    
    if (profileUrl) {
      userProfile.profileUrl = profileUrl;
    }

    // Set job title
    userProfile.jobTitle = candidateData.jobTitle || candidateData.current_designation || '';
    userProfile.profileTitle = candidateData.jobTitle || candidateData.current_designation || '';
  }

  private processResdexLocationData(candidateData: any, userProfile: UserProfile): void {
    const currentLocation = candidateData.currentLocation || candidateData.current_location;
    const preferredLocations = candidateData.preferredLocations || candidateData.preferred_locations;
    
    if (currentLocation) {
      userProfile.locationName = currentLocation;
      userProfile.locations = [{
        name: currentLocation,
        locality: null,
        region: null,
        subregion: null,
        country: null,
        continent: null,
        type: 'current',
        geo: null,
        postal_code: null,
        zip_plus_4: null,
        street_address: null,
        address_line_2: null,
        most_recent: true,
        is_primary: true,
        last_updated: new Date().toISOString(),
      }];
      
      // Add preferred locations
      if (preferredLocations) {
        const preferredLocationsList = Array.isArray(preferredLocations) 
          ? preferredLocations 
          : preferredLocations.split(',').map((loc: string) => loc.trim());
          
        preferredLocationsList.forEach((loc: string) => {
          if (loc && loc !== currentLocation) {
            userProfile.locations.push({
              name: loc,
              locality: null,
              region: null,
              subregion: null,
              country: null,
              continent: null,
              type: 'preferred',
              geo: null,
              postal_code: null,
              zip_plus_4: null,
              street_address: null,
              address_line_2: null,
              most_recent: false,
              is_primary: false,
              last_updated: new Date().toISOString(),
            });
          }
        });
      }
    }
  }

  private processResdexSkillsData(candidateData: any, userProfile: UserProfile): void {
    // Resdex has both keySkills and focusedSkills
    const keySkills = this.dataProcessingUtils.extractSkills(candidateData.keySkills || candidateData.key_skills);
    const focusedSkills = this.dataProcessingUtils.extractSkills(candidateData.focusedSkills || candidateData.focused_skills);
    
    const allSkills = [...keySkills, ...focusedSkills];
    const uniqueSkills = [...new Set(allSkills)];
    
    userProfile.skills = uniqueSkills.join(', ');
    userProfile.keySkills = uniqueSkills.join(', ');
  }

  private processResdexExperienceData(candidateData: any, userProfile: UserProfile): void {
    // Resdex provides experience in years and months separately
    const experienceYears = parseInt(candidateData.experience_years || '0', 10);
    const experienceMonths = parseInt(candidateData.experience_months || '0', 10);
    const totalExperienceInYears = experienceYears + (experienceMonths / 12);
    
    userProfile.inferredYearsExperience = Math.round(totalExperienceInYears * 10) / 10;
    
    // Create experience entries based on current and previous organizations
    const experienceEntries: any[] = [];
    
    if (candidateData.current_organization) {
      experienceEntries.push({
        company: {
          name: candidateData.current_organization,
        },
        title: {
          name: candidateData.current_designation || '',
        },
      });
    }
    
    if (candidateData.previous_organization && candidateData.previous_organization !== candidateData.current_organization) {
      experienceEntries.push({
        company: {
          name: candidateData.previous_organization,
        },
        title: {
          name: candidateData.previous_designation || '',
        },
      });
    }
    
    userProfile.experience = experienceEntries;
    
    // Set basic experience stats
    userProfile.experienceStats = {
      totalYearsExperience: { 
        years: totalExperienceInYears, 
        months: null 
      },
      currentSalary: { 
        type: null, 
        ctc: null 
      }
    };
  }

  private processResdexEducationData(candidateData: any, userProfile: UserProfile): void {
    const educationEntries: any[] = [];
    
    // Process UG education
    if (candidateData.ug_institute) {
      educationEntries.push({
        institute: {
          name: candidateData.ug_institute,
          type: 'undergraduate',
          location: null,
          profiles: [],
          website: null,
        },
        degrees: candidateData.ug_course || candidateData.ug_degree || null,
        start_date: candidateData.ug_year ? `${candidateData.ug_year}-01-01` : null,
        end_date: candidateData.ug_year ? `${parseInt(candidateData.ug_year) + 4}-01-01` : null,
        gpa: null,
        majors: [],
        minors: [],
        locations: null,
      });
      
      userProfile.educationInstituteUg = candidateData.ug_institute;
      userProfile.educationCourseUg = candidateData.ug_course || candidateData.ug_degree || '';
    }
    
    // Process PG education
    if (candidateData.pg_institute) {
      educationEntries.push({
        institute: {
          name: candidateData.pg_institute,
          type: 'postgraduate',
          location: null,
          profiles: [],
          website: null,
        },
        degrees: candidateData.pg_course || null,
        start_date: candidateData.pg_year ? `${candidateData.pg_year}-01-01` : null,
        end_date: candidateData.pg_year ? `${parseInt(candidateData.pg_year) + 2}-01-01` : null,
        gpa: null,
        majors: [],
        minors: [],
        locations: null,
      });
    }
    
    userProfile.education = educationEntries;
  }

  private processResdexSalaryData(candidateData: any, userProfile: UserProfile): void {
    // Resdex provides salary in lakhs and thousands
    const ctcLacs = parseInt(candidateData.ctc_lacs || '0', 10);
    const ctcThousands = parseInt(candidateData.ctc_thousands || '0', 10);
    const ctcCurrency = candidateData.ctc_currency || 'INR';
    
    if (ctcLacs > 0 || ctcThousands > 0) {
      const totalSalary = (ctcLacs * 100000) + (ctcThousands * 1000);
      userProfile.inferredSalary = totalSalary;
    }
  }

  private processResdexSpecificData(candidateData: any, userProfile: UserProfile): void {
    // Add notice period information if available
    if (candidateData.noticePeriod || candidateData.notice_period) {
      // this.addJobProcessEvent(userProfile, 'notice_period', candidateData.noticePeriod || candidateData.notice_period);
    }
    
    // Add last modified date
    if (candidateData.modifyDateLabel || candidateData.modify_date_label) {
      const formattedDate = this.dataProcessingUtils.formatDate(
        candidateData.modifyDateLabel || candidateData.modify_date_label
      );
      if (formattedDate) {
        userProfile.lastUpdated = formattedDate;
      }
      // this.addJobProcessEvent(userProfile, 'naukri_modified_date', candidateData.modifyDateLabel || candidateData.modify_date_label);
    }
    
    // Add active date from Naukri
    if (candidateData.activeDateLabel || candidateData.active_date_label) {
      // this.addJobProcessEvent(userProfile, 'naukri_active_date', candidateData.activeDateLabel || candidateData.active_date_label);
    }
    
    // Process industry information
    if (candidateData.industry) {
      userProfile.industry = candidateData.industry;
      userProfile.industries = [{
        name: candidateData.industry,
        is_primary: true,
      }];
    }
    
    // Process photo information
    const photoUrl = candidateData.photoIdHash ? 
      `https://p.naukri.com/jphoto/${candidateData.photoIdHash}` :
      candidateData.photo ? 
        `https://p.naukri.com/jphoto/${candidateData.photo}` : null;
    
    if (photoUrl) {
      userProfile.displayPicture = photoUrl;
      // this.addJobProcessEvent(userProfile, 'profile_picture', photoUrl);
    }
    
    // Process dynamic encrypted unique ID for profile URL
    if (candidateData.dynamicEncryptedUniqueId) {
      const resdexProfileUrl = `https://resdex.naukri.com/v3/preview?uniqId=${candidateData.dynamicEncryptedUniqueId}`;
      // this.addJobProcessEvent(userProfile, 'resdex_profile_url', resdexProfileUrl);
    }
    
    // Process candidate profile URL if available
    if (candidateData.candidate_profile) {
      // this.addJobProcessEvent(userProfile, 'candidate_profile_url', candidateData.candidate_profile);
    }
    
    // Set unique ID if available
    if (candidateData.uniqueId || candidateData.unique_id) {
      userProfile.id = candidateData.uniqueId || candidateData.unique_id;
    }
    
    // Process employment details
    const currentEmployment = candidateData.employment?.current;
    const previousEmployment = candidateData.employment?.previous;
    
    if (currentEmployment) {
      // this.addJobProcessEvent(userProfile, 'current_employment', {
      //   organization: currentEmployment.organization,
      //   designation: currentEmployment.designation,
      // });
    }
    
    if (previousEmployment) {
      // this.addJobProcessEvent(userProfile, 'previous_employment', {
        // organization: previousEmployment.organization,
      //   designation: previousEmployment.designation,
      // });
    }
    
    // Process education details from specific Resdex structure
    const education = candidateData.education;
    if (education) {
      // if (education.pg) {
        // this.addJobProcessEvent(userProfile, 'pg_education', {
          // institute: education.pg.institute,
        //   course: education.pg.course,
        //   year: education.pg.year,
        // });
      // } 
      
      // if (education.ug) {
        // this.addJobProcessEvent(userProfile, 'ug_education', {
          // institute: education.ug.institute,
        //   course: education.ug.course,
        //   year: education.ug.year,
        // });
      // }
    }
    
    // Process CTC information
    if (candidateData.ctcInfo) {
      const ctcInfo = candidateData.ctcInfo;
      // this.addJobProcessEvent(userProfile, 'ctc_info', {
      //   lacs: ctcInfo.lacs,
      //   thousands: ctcInfo.thousands,
      //   currency: ctcInfo.currency,
      // });
    }
    
    // Process experience in years and months
    if (candidateData.experience) {
      // this.addJobProcessEvent(userProfile, 'experience_breakdown', {
      //   years: candidateData.experience.years,
      //   months: candidateData.experience.months,
      // });
    }
    
    // Process additional fields that might be specific to Resdex
    const additionalFields = [
      'experience_in_years',
      'campaign',
      'source',
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
