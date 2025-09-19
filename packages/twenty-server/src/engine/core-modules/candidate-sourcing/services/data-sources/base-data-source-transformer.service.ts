import { Injectable } from '@nestjs/common';
import { UserProfile } from 'twenty-shared';
import { DataProcessingUtils } from '../../utils/data-processing.utils';

export interface TransformationContext {
  jobId: string;
  jobName: string;
  userId: string;
  dataSource: string;
  crawlId?: string;
  timestamp: string;
}

@Injectable()
export abstract class BaseDataSourceTransformerService {
  constructor(protected readonly dataProcessingUtils: DataProcessingUtils) {}

  /**
   * Abstract method that each data source transformer must implement
   */
  abstract transformToUserProfile(
    candidateData: any,
    context: TransformationContext
  ): UserProfile;

  /**
   * Get the data source identifier
   */
  abstract getDataSourceIdentifier(): string;

  /**
   * Create a base UserProfile with common fields populated
   */
  protected createBaseUserProfile(
    candidateData: any,
    context: TransformationContext
  ): UserProfile {
    // Use existing uniqueKeyString if available, otherwise generate one
    const uniqueStringKey = candidateData.uniqueKeyString || 
      this.dataProcessingUtils.generateUniqueStringKey(
        candidateData,
        context.dataSource
      );
    
    if (candidateData.uniqueKeyString) {
      console.log(`Using existing uniqueKeyString: ${candidateData.uniqueKeyString} for candidate: ${candidateData.fullName || candidateData.name}`);
    } else {
      console.log(`Generated new uniqueStringKey: ${uniqueStringKey} for candidate: ${candidateData.fullName || candidateData.name}`);
    }
    
    const timestamp = new Date().toISOString();
    
    return {
      // Basic profile information
      id: candidateData.id || '',
      firstName: '',
      lastName: '',
      middleName: null,
      middleInitial: null,
      fullName: '',
      uniqueStringKey: uniqueStringKey,
      
      // Name structure
      names: {
        firstName: '',
        lastName: '',
      },
      
      // Company and job information
      jobCompanyName: '',
      jobCompanyId: null,
      jobCompanyLinkedinUrl: null,
      jobCompanyWebsite: null,
      jobTitle: '',
      profileTitle: '',
      
      // Location information
      locationName: '',
      locationRegion: null,
      locationLocality: null,
      locationMetro: null,
      locationCountry: null,
      country: null,
      
      // Social profiles
      linkedinUrl: '',
      facebookUrl: null,
      twitterUrl: null,
      profileUrl: '',
      
      // Experience and salary
      inferredSalary: null,
      inferredYearsExperience: null,
      industry: null,
      
      // Personal information
      birthDateFuzzy: null,
      birthDate: null,
      gender: null,
      
      // Contact information
      emailAddress: null,
      emails: { personal: [], work: [], others: [] },
      phoneNumbers: [],
      phoneNumber: '',
      
      // Profile structures
      industries: [],
      locations: [],
      experience: [],
      experienceStats: {
        total_years_experience: { years: null, months: null },
        current_salary: { type: null, ctc: null }
      },
      education: [],
      
      // Additional fields
      interests: [],
      skills: '',
      keySkills: '',
      
      // Required fields from UserProfile interface
      educationCoursePg: '',
      educationInstituteUg: '',
      educationCourseUg: '',
      noticePeriod: '',
      
      // Metadata
      lastSeen: {
        source: context.dataSource,
        timestamp: timestamp,
      },
      lastUpdated: timestamp,
      stdLastUpdated: null,
      created: Date.now(),
      creationSource: context.dataSource,
      dataSources: [context.dataSource],
      dataSource: context.dataSource,
      jobName: context.jobName,
      queryId: [],
      uploadCount: 0,
      uploadId: '',
      tables: [context.jobId],
      
      
      // Standardization fields
      stdFunction: '',
      stdGrade: '',
      stdFunctionRoot: '',
      
      // Additional properties (UserProfile allows [x: string]: any)
      displayPicture: '',
      campaign: context.dataSource,
      source: context.dataSource,
    } as unknown as UserProfile;
  }


  /**
   * Process name information - simplified to avoid duplication
   */
  protected processNameData(candidateData: any, userProfile: UserProfile): void {
    const fullName = this.extractFullName(candidateData);
    const nameInfo = this.dataProcessingUtils.processName(fullName);
    
    // Set only in names object, remove duplicated top-level fields
    userProfile.names = {
      firstName: nameInfo.first_name,
      lastName: nameInfo.last_name,
    };
    
    // Keep only essential top-level name fields for backward compatibility
    userProfile.fullName = nameInfo.full_name;
    userProfile.firstName = nameInfo.first_name;
    userProfile.lastName = nameInfo.last_name;
  }

  /**
   * Process contact information - simplified and consolidated
   */
  protected processContactData(candidateData: any, userProfile: UserProfile): void {
    // Process email addresses
    const emailInput = candidateData.email_address || candidateData.email || candidateData.emailAddress;
    if (emailInput) {
      const emails = this.dataProcessingUtils.cleanEmailAddresses(emailInput);
      userProfile.emailAddress = emails;
      
      // Categorize emails (simplified logic)
      userProfile.emails.personal = emails.filter(email => 
        !email.includes('@company.') && !email.includes('@corp.')
      );
      userProfile.emails.work = emails.filter(email => 
        email.includes('@company.') || email.includes('@corp.')
      );
    }
    
    // Process phone numbers
    const phoneInput = candidateData.phone_numbers || candidateData.phone || candidateData.phoneNumber || candidateData.phone_number;
    if (phoneInput) {
      const phones = this.dataProcessingUtils.cleanPhoneNumbers(phoneInput);
      userProfile.phoneNumbers = phones;
      userProfile.phoneNumber = phones[0] || '';
    }
  }

  /**
   * Process profile URLs - simplified
   */
  protected processProfileData(candidateData: any, userProfile: UserProfile, dataSource: string): void {
    const profileUrl = candidateData.profile_url || candidateData.profileUrl || candidateData.url;
    
    if (profileUrl) {
      userProfile.profileUrl = profileUrl;
    }
  }

  /**
   * Process location information - simplified structure
   */
  protected processLocationData(candidateData: any, userProfile: UserProfile): void {
    const locationData = candidateData.location || candidateData.currentLocation || candidateData.current_location;
    const cleanLocation = this.dataProcessingUtils.cleanLocation(locationData);
    
    if (cleanLocation) {
      userProfile.locationName = cleanLocation;
      userProfile.locations = [{
        name: cleanLocation,
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
    }
  }

  /**
   * Process skills information - simplified
   */
  protected processSkillsData(candidateData: any, userProfile: UserProfile): void {
    const skillsInput = candidateData.skills || candidateData.keySkills || candidateData.key_skills;
    if (skillsInput) {
      const skillsArray = this.dataProcessingUtils.extractSkills(skillsInput);
      userProfile.skills = skillsArray.join(', ');
      userProfile.keySkills = skillsArray.join(', ');
    }
  }

  /**
   * Process experience information
   */
  protected processExperienceData(candidateData: any, userProfile: UserProfile): void {
    const experienceData = candidateData.experience || candidateData.workExp || candidateData.work_experience;
    
    if (experienceData && Array.isArray(experienceData)) {
      userProfile.experience = experienceData.map((exp, index) => ({
        company: {
          name: exp.company?.name || exp.companyName || exp.company || '',
        },
        title: {
          name: exp.title || exp.designation || exp.role || '',
        },
        startDate: exp.startDate || exp.start_date || null,
        endDate: exp.endDate || exp.end_date || null,
      }));
      
      // Calculate experience statistics
      this.calculateExperienceStats(userProfile);
    }
  }

  /**
   * Process education information
   */
  protected processEducationData(candidateData: any, userProfile: UserProfile): void {
    const educationData = candidateData.education || candidateData.educationDetails;
    
    if (educationData && Array.isArray(educationData)) {
      userProfile.education = educationData.map((edu, index) => ({
        institute: {
          name: edu.institute || edu.school || edu.university || null,
          type: null,
          location: null,
          profiles: [],
          website: null,
        },
        degrees: edu.degree || edu.course || edu.qualification || null,
        start_date: this.dataProcessingUtils.formatDate(edu.start_date || edu.startYear),
        end_date: this.dataProcessingUtils.formatDate(edu.end_date || edu.endYear),
        gpa: null,
        majors: [],
        minors: [],
        locations: null,
      }));
    }
  }

  /**
   * Extract full name from various candidate data formats
   */
  protected extractFullName(candidateData: any): string {
    return candidateData.name || 
           candidateData.jsUserName || 
           candidateData.full_name || 
           candidateData.fullName ||
           `${candidateData.first_name || ''} ${candidateData.last_name || ''}`.trim() ||
           '';
  }

  /**
   * Extract username from profile URL
   */
  protected extractUsername(profileUrl: string): string | null {
    if (!profileUrl) return null;
    
    try {
      const url = new URL(profileUrl);
      const pathParts = url.pathname.split('/').filter(part => part.length > 0);
      return pathParts[pathParts.length - 1] || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate experience statistics
   */
  protected calculateExperienceStats(userProfile: UserProfile): void {
    const experience = userProfile.experience;
    
    if (!experience || experience.length === 0) {
      return;
    }

    // Calculate total experience in years (simplified)
    const totalYears = experience.length * 2; // Rough estimate
    
    userProfile.experience_stats = {
      total_years_experience: { 
        years: totalYears, 
        months: null 
      },
      current_salary: { 
        type: null, 
        ctc: null 
      }
    };

    userProfile.inferredYearsExperience = totalYears;
  }

  /**
   * Process salary information - simplified
   */
  protected processSalaryData(candidateData: any, userProfile: UserProfile): void {
    const salaryData = candidateData.salary || 
                      candidateData.currentSalary || 
                      candidateData.annual_salary ||
                      candidateData.ctc;
    
    if (salaryData) {
      const salaryNumber = this.dataProcessingUtils.extractSalaryNumber(salaryData);
      userProfile.inferredSalary = salaryNumber || null;
    }
  }

  /**
   * Add event to job process - utility method to reduce code duplication
   */
  protected addJobProcessEvent(userProfile: UserProfile, type: string, value: any): void {
    if (value !== null && value !== undefined && value !== '') {
      // Note: UserProfile job_process doesn't have events array, so we'll store in a custom field
      if (!userProfile.job_process_events) {
        userProfile.job_process_events = [];
      }
      userProfile.job_process_events.push({
        type,
        value,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Set basic job information - utility method
   */
  protected setJobInfo(candidateData: any, userProfile: UserProfile): void {
    const jobTitle = candidateData.jobTitle || 
                    candidateData.current_designation || 
                    candidateData.headline ||
                    candidateData.title;
    
    const companyName = candidateData.job_company_name || 
                       candidateData.company_name || 
                       candidateData.current_company ||
                       candidateData.currentCompany;

    if (jobTitle) {
      userProfile.jobTitle = jobTitle;
      userProfile.profileTitle = jobTitle;
    }

    if (companyName) {
      userProfile.jobCompanyName = companyName;
    }
  }

  /**
   * Process industry information - utility method
   */
  protected processIndustryData(candidateData: any, userProfile: UserProfile): void {
    const industry = candidateData.industry;
    if (industry) {
      userProfile.industry = industry;
      userProfile.industries = [{
        name: industry,
        is_primary: true,
      }];
    }
  }
}
