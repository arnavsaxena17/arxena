import { Injectable } from '@nestjs/common';
import { UserProfile } from 'twenty-shared';
import { DataProcessingUtils } from '../../utils/data-processing.utils';

export interface TransformationContext {
  projectId: string;
  jobName: string;
  userId: string;
  dataSource: string;
  crawlId?: string;
  timestamp: string;
}

@Injectable()
export abstract class BaseDataSourceTransformerService {
  constructor(protected readonly dataProcessingUtils: DataProcessingUtils) {}
  abstract transformToUserProfile(
    candidateData: any,
    context: TransformationContext
  ): UserProfile;

  abstract getDataSourceIdentifier(): string;
  protected createBaseUserProfile(
    candidateData: any,
    context: TransformationContext
  ): UserProfile {
    // Use existing uniqueStringKey if available, otherwise generate one
    const uniqueStringKey = candidateData.uniqueStringKey || 
      this.dataProcessingUtils.generateUniqueStringKey(
        candidateData,
        context.dataSource
      );
    const timestamp = new Date().toISOString();
    return {
      id: candidateData.id || '',
      firstName: null,
      lastName: null,
      middleName: null,
      middleInitial: null,
      fullName: null,
      uniqueStringKey: uniqueStringKey,
      jobCompanyName: null,
      jobCompanyId: null,
      jobCompanyLinkedinUrl: null,
      jobCompanyWebsite: null,
      jobTitle: null,
      profileTitle: null,
      locationName: null,
      locationRegion: null,
      locationLocality: null,
      locationMetro: null,
      locationCountry: null,
      country: null,
      linkedinUrl: null,
      facebookUrl: null,
      twitterUrl: null,
      profileUrl: '',
      inferredSalary: null,
      inferredYearsExperience: null,
      industry: null,
      birthDateFuzzy: null,
      birthDate: null,
      gender: null,
      phoneNumber: '',
      phoneNumbers: [],
      emailAddress: '',
      emailAddresses: [],
      industries: [],
      locations: [],
      experience: [],
      experienceStats: {
        total_years_experience: { years: null, months: null },
        current_salary: { type: null, ctc: null }
      },
      education: [],
      interests: [],
      skills: null,
      keySkills: null,
      educationCoursePg: null,
      educationInstituteUg: null,
      educationCourseUg: null,
      noticePeriod: null,
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
      tables: [context.projectId],
      stdFunction: null,
      stdGrade: null,
      stdFunctionRoot: null,
      displayPicture: null,
      campaign: context.dataSource,
      source: context.dataSource,
    } as unknown as UserProfile;
  }
  protected processNameData(candidateData: any, userProfile: UserProfile): void {
    const fullName = this.extractFullName(candidateData);
    const nameInfo = this.dataProcessingUtils.processName(fullName);
    userProfile.names = {
      firstName: nameInfo.first_name,
      lastName: nameInfo.last_name,
    };
    userProfile.fullName = nameInfo.full_name;
    userProfile.firstName = nameInfo.first_name;
    userProfile.lastName = nameInfo.last_name;
  }

  protected processContactData(candidateData: any, userProfile: UserProfile): void {
    const emailInput = candidateData.email_address || candidateData['Email ID'] || candidateData.email || candidateData.emailAddress || candidateData.emailId;
    if (emailInput) {
      const cleanedEmails = this.dataProcessingUtils.cleanEmailAddresses(emailInput);
      if (cleanedEmails.length > 0) {
        userProfile.emailAddresses = cleanedEmails;
        userProfile.emailAddress = cleanedEmails[0] || '';
      }
    }
    const phoneInput = candidateData.phone_numbers || 
                      candidateData['Phone Number'] ||
                      candidateData.phone || 
                      candidateData.phoneNumber || 
                      candidateData.phone_number ||
                      candidateData.phoneNumberValue;
    
    if (phoneInput) {
      const cleanedPhones = this.dataProcessingUtils.cleanPhoneNumbers(phoneInput);
      if (cleanedPhones.length > 0) {
        userProfile.phoneNumbers = cleanedPhones;
        userProfile.phoneNumber = cleanedPhones[0] || '';
      }
    }
  }

  protected processProfileData(candidateData: any, userProfile: UserProfile, dataSource: string): void {
    const profileUrl = candidateData.profileUrl || '';
    
    if (profileUrl) {
      userProfile.profileUrl = profileUrl;
    }
  }

  /**
   * Process location information - simplified structure
   */
  protected processLocationData(candidateData: any, userProfile: UserProfile): void {
    const locationData = candidateData.location || candidateData.currentLocation || '';
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
    const skillsInput = candidateData.skills || candidateData.keySkills || '';
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
    const experienceData = candidateData.experience || candidateData.workExp || '';

    if (experienceData && Array.isArray(experienceData)) {
      userProfile.experience = experienceData.map((exp, index) => {
        const startDate = exp.startDate || exp.start_date || null;
        const endDate = exp.endDate || exp.end_date || null;

        const isCurrent: boolean | undefined =
          typeof exp.isCurrent === 'boolean'
            ? exp.isCurrent
            : this.inferIsCurrentFromDates(startDate, endDate, index);

        return {
          company: {
            name: exp.company?.name || exp.companyName || exp.company || '',
          },
          title: {
            name: exp.title || exp.designation || exp.role || '',
          },
          startDate,
          endDate,
          // Only include isCurrent when we can infer it to avoid noisy data
          ...(typeof isCurrent === 'boolean' ? { isCurrent } : {}),
        };
      });

      // Calculate experience statistics
      this.calculateExperienceStats(userProfile);
    }
  }

  /**
   * Infer whether an experience entry is current based on dates and position.
   * This is a best-effort heuristic for sources that don't explicitly flag current roles.
   */
  protected inferIsCurrentFromDates(
    startDate: string | null,
    endDate: string | null,
    index: number
  ): boolean | undefined {
    if (endDate) {
      return false;
    }

    // If there is no end date and this is the first experience entry,
    // treat it as current. For other entries, leave undefined.
    if (!endDate && index === 0 && startDate) {
      return true;
    }

    return undefined;
  }

  /**
   * Process education information
   */
  protected processEducationData(candidateData: any, userProfile: UserProfile): void {
    const educationData = candidateData.education || candidateData.educationDetails || '';
    
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
        start_date: this.dataProcessingUtils.formatDate(edu.startYear || ''),
        end_date: this.dataProcessingUtils.formatDate(edu.endYear),
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
    let fullName = candidateData.name || 
                   candidateData.jsUserName || 
                   candidateData.full_name || 
                   candidateData.fullName || '';
    if (!fullName) {
      const firstName = candidateData['First Name (name)'] || 
                       candidateData.firstName || 
                       candidateData.first_name || 
                       candidateData['First Name'] || '';
      const lastName = candidateData['Last Name (name)'] || 
                      candidateData.lastName || 
                      candidateData.last_name || 
                      candidateData['Last Name'] || '';
      
      // Only construct full name if we have at least one non-empty name component
      if (firstName.trim() || lastName.trim()) {
        fullName = `${firstName} ${lastName}`.trim();
      }
    }
    return fullName;
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
    
    userProfile.experienceStats = {
      totalYearsExperience: { 
        years: totalYears, 
        months: null 
      },
      currentSalary: { 
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
  protected addProjectProcessEvent(userProfile: UserProfile, type: string, value: any): void {
    if (value !== null && value !== undefined && value !== '') {
      // Note: UserProfile job_process doesn't have events array, so we'll store in a custom field
      if (!userProfile.jobProcessEvents) {
        userProfile.jobProcessEvents = [];
      }
      userProfile.jobProcessEvents.push({
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
    
    const companyName = candidateData.jobCompanyName ||
                       candidateData.job_company_name || 
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
