import { Injectable } from '@nestjs/common';
import { UserProfile } from 'twenty-shared';
import { DataProcessingUtils } from '../../utils/data-processing.utils';
import { BaseDataSourceTransformerService, TransformationContext } from './base-data-source-transformer.service';

type ResdexEducationLevel = {
  institute: string;
  course: string;
  specialization: string;
  year: number;
} | null;

type ResdexEmployment = {
  designation: string;
  organization: string;
  startDate: string;
  endDate: string;
};

type ResdexCtcInfo = {
  lacs: string;
  thousands: string;
  currency: string;
};

type ResdexExperience = {
  years: number;
  months: number;
};

type ResdexHiringForStatus = {
  hiringId: string | null;
  hiringName: string | null;
  status: string | null;
  requirementIds: string[];
};

type ResdexProfileTag = {
  id: number;
  label: string;
  sourceType: string;
  meta: any | null;
};

export type ResdexNaukriCandidateData = {
  jsUserName: string;
  jsUserRank: number | null;
  jobTitle: string;
  keySkills: string;
  assessedAndVerifiedSkills: Record<string, any>;
  focusedSkills: string;
  interestedSkills: string;
  resdexFlag: string;
  uniqueId: string;
  dynamicEncryptedUniqueId: string;
  dynamicEncryptedJsKey: string;
  encryptedJsKey: string;
  encryptedUserName: string;
  key: string;
  photoIdHash: string;
  thumbnailPhotoIdHash: string | null;
  education: {
    ug: ResdexEducationLevel;
    pg: ResdexEducationLevel;
    ppg: ResdexEducationLevel;
  };
  employment: {
    current: ResdexEmployment;
    previous: ResdexEmployment;
  };
  ctcInfo: ResdexCtcInfo;
  experience: ResdexExperience;
  currentLocation: string;
  preferredLocations: string;
  certifications: string | null;
  phoneNumberPresent: boolean;
  mobileNumberPresent: boolean;
  premiumCandidate: boolean;
  featuredCandidate: boolean;
  newCandidate: boolean;
  emailVerified: boolean;
  cvAttached: boolean;
  fresher: boolean;
  salaryDisclosed: boolean;
  phoneStatus: number;
  mobileVerifiedDateMillis: number;
  activeDateMillis: number;
  modifyDateMillis: number;
  viewDateMillis: number;
  headhuntViewDateMillis: number;
  headhuntViewDateMillisOtherSubuser: number;
  historicalDateMillis: number;
  viewDateMillisOtherSubUserEarliest: number;
  viewDateMillisOtherSubUserLatest: number;
  contactedDateMillis: number;
  contactedDateMillisOtherSubUser: number;
  downloadDateMillis: number;
  downloadDateMillisOtherSubUser: number;
  smsDateMillis: number;
  smsDateMillisOtherSubUser: number;
  numberOfViews: number;
  numberOfDownloads: number;
  commentCount: number;
  simCvCount: number;
  contextSimCvCount: number;
  activeStateTagInfo: any | null;
  immediateAvailabilty: boolean;
  videoProfile: boolean;
  avgResponseTime: number | null;
  jsUserId: number;
  jsResId: number;
  saveForLaterDetails: any | null;
  hiringForStatus: ResdexHiringForStatus;
  noticePeriod: number;
  modifyDateLabel: string;
  activeDateLabel: string;
  compositeCvType: string | null;
  activeSimCvTab: string;
  profileTags: ResdexProfileTag[];
  instituteTopTags: string[] | null;
  jobseekerActivityInfo: any | null;
  watchlistAndNotificationInfo: any | null;
  headhuntRequirementInfo: any | null;
};

@Injectable()
export class ResdexNaukriTransformerService extends BaseDataSourceTransformerService {
  constructor(dataProcessingUtils: DataProcessingUtils) {
    super(dataProcessingUtils);
  }

  getDataSourceIdentifier(): string {
    return 'resdex_naukri';
  }

  transformToUserProfile(
    candidateData: ResdexNaukriCandidateData | any,
    context: TransformationContext
  ): UserProfile {
    const userProfile = this.createBaseUserProfile(candidateData, context);
    
    // Extract nested json_data if present (from CV upload flow)
    let processedCandidateData = candidateData;
    if (candidateData.json_data) {
      try {
        const jsonData = JSON.parse(candidateData.json_data);
        // Merge json_data fields into the main candidate data for processing
        processedCandidateData = { ...candidateData, ...jsonData };
        console.log('Merged json_data into candidate data for Resdex processing');
        console.log('Email address in processed data:', processedCandidateData.email_address);
        console.log('Phone number in processed data:', processedCandidateData.phone_number);
      } catch (error) {
        console.error('Error parsing json_data in Resdex transformer:', error);
      }
    }
    
    // Process name - Resdex uses 'jsUserName' field
    this.processResdexNameData(processedCandidateData, userProfile);
    
    // Process contact information
    this.processContactData(processedCandidateData, userProfile);
    
    // Process profile information
    this.processResdexProfileData(processedCandidateData, userProfile);
    
    // Process location
    this.processResdexLocationData(processedCandidateData, userProfile);
    
    // Process skills
    this.processResdexSkillsData(processedCandidateData, userProfile);
    
    // Process experience
    this.processResdexExperienceData(processedCandidateData, userProfile);
    
    // Process education
    this.processResdexEducationData(processedCandidateData, userProfile);
    
    // Process salary
    this.processResdexSalaryData(processedCandidateData, userProfile);
    
    // Process other Resdex-specific fields
    this.processResdexSpecificData(processedCandidateData, userProfile);
    
    return userProfile;
  }

  private processResdexNameData(candidateData: ResdexNaukriCandidateData | any, userProfile: UserProfile): void {
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

  private processResdexProfileData(candidateData: ResdexNaukriCandidateData | any, userProfile: UserProfile): void {
    // Construct Resdex profile URL from dynamicEncryptedUniqueId
    let profileUrl = candidateData.profile_url || candidateData.profileUrl;
    
    if (!profileUrl && candidateData.dynamicEncryptedUniqueId) {
      profileUrl = `https://resdex.naukri.com/v3/preview?uniqId=${candidateData.dynamicEncryptedUniqueId}`;
    }
    
    if (profileUrl) {
      userProfile.profileUrl = profileUrl;
    }

    // Set job title
    userProfile.jobTitle = candidateData.employment.current.designation || candidateData.current_designation || '';
    userProfile.jobCompanyName = candidateData.employment.current.organization || candidateData.current_company || '';
    userProfile.profileTitle = candidateData.jobTitle || candidateData.current_designation || '';
  }
  private processResdexLocationData(candidateData: ResdexNaukriCandidateData | any, userProfile: UserProfile): void {
    const currentLocation = candidateData.currentLocation || candidateData.current_location;
    const preferredLocations = candidateData.preferredLocations || candidateData.preferred_locations;
    console.log("Preferred locations:", preferredLocations);
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

  private processResdexSkillsData(candidateData: ResdexNaukriCandidateData | any, userProfile: UserProfile): void {
    // Resdex has both keySkills and focusedSkills
    const keySkills = this.dataProcessingUtils.extractSkills(candidateData.keySkills || candidateData.key_skills);
    const focusedSkills = this.dataProcessingUtils.extractSkills(candidateData.focusedSkills || candidateData.focused_skills);
    
    const allSkills = [...keySkills, ...focusedSkills];
    const uniqueSkills = [...new Set(allSkills)];
    
    userProfile.skills = uniqueSkills.join(', ');
    userProfile.keySkills = uniqueSkills.join(', ');
  }

  private processResdexExperienceData(candidateData: ResdexNaukriCandidateData | any, userProfile: UserProfile): void {
    // Resdex provides experience in years and months separately
    const experienceYears = parseInt(candidateData.experience?.years || candidateData.experience_years || '0', 10);
    const experienceMonths = parseInt(candidateData.experience?.months || candidateData.experience_months || '0', 10);
    const totalExperienceInYears = experienceYears + (experienceMonths / 12);
    
    userProfile.inferredYearsExperience = Math.round(totalExperienceInYears * 10) / 10;
    
    // Create experience entries based on current and previous organizations
    const experienceEntries: any[] = [];
    
    // Process current employment
    const currentEmployment = candidateData.employment?.current;
    if (currentEmployment?.organization) {
      experienceEntries.push({
        company: {
          name: currentEmployment.organization,
        },
        title: {
          name: currentEmployment.designation || '',
        },
        startDate: currentEmployment.startDate || null,
        endDate: currentEmployment.endDate || null,
      });
    }
    
    // Process previous employment
    const previousEmployment = candidateData.employment?.previous;
    if (previousEmployment?.organization && previousEmployment.organization !== currentEmployment?.organization) {
      experienceEntries.push({
        company: {
          name: previousEmployment.organization,
        },
        title: {
          name: previousEmployment.designation || '',
        },
        startDate: previousEmployment.startDate || null,
        endDate: previousEmployment.endDate || null,
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

  private processResdexEducationData(candidateData: ResdexNaukriCandidateData | any, userProfile: UserProfile): void {
    const educationEntries: any[] = [];
    
    // Process UG education
    const ugEducation = candidateData.education?.ug;
    if (ugEducation?.institute) {
      educationEntries.push({
        institute: {
          name: ugEducation.institute,
          type: 'undergraduate',
          location: null,
          profiles: [],
          website: null,
        },
        degrees: ugEducation.course || null,
        start_date: ugEducation.year ? `${ugEducation.year}-01-01` : null,
        end_date: ugEducation.year ? `${parseInt(ugEducation.year) + 4}-01-01` : null,
        gpa: null,
        majors: [],
        minors: [],
        locations: null,
      });
      
      userProfile.educationInstituteUg = ugEducation.institute;
      userProfile.educationCourseUg = ugEducation.course || '';
    }
    
    // Process PG education
    const pgEducation = candidateData.education?.pg;
    if (pgEducation?.institute) {
      educationEntries.push({
        institute: {
          name: pgEducation.institute,
          type: 'postgraduate',
          location: null,
          profiles: [],
          website: null,
        },
        degrees: pgEducation.course || null,
        start_date: pgEducation.year ? `${pgEducation.year}-01-01` : null,
        end_date: pgEducation.year ? `${parseInt(pgEducation.year) + 2}-01-01` : null,
        gpa: null,
        majors: [],
        minors: [],
        locations: null,
      });
    }
    
    userProfile.education = educationEntries;
  }

  private processResdexSalaryData(candidateData: ResdexNaukriCandidateData | any, userProfile: UserProfile): void {
    // Resdex provides salary in lakhs and thousands
    const ctcInfo = candidateData.ctcInfo;
    if (ctcInfo) {
      const ctcLacs = parseInt(ctcInfo.lacs || '0', 10);
      const ctcThousands = parseInt(ctcInfo.thousands || '0', 10);
      const ctcCurrency = ctcInfo.currency || 'INR';
      
      if (ctcLacs > 0 || ctcThousands > 0) {
        const totalSalary = (ctcLacs * 100000) + (ctcThousands * 1000);
        userProfile.inferredSalary = totalSalary;
      }
    }
  }

  private processResdexSpecificData(candidateData: ResdexNaukriCandidateData | any, userProfile: UserProfile): void {
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
