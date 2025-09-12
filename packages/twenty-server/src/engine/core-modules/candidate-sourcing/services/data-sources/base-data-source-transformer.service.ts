import { Injectable } from '@nestjs/common';
import { MasterDataFormat, createMasterDataTemplate } from '../../types/master-data.types';
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
  abstract transformToMasterFormat(
    candidateData: any,
    context: TransformationContext
  ): MasterDataFormat;

  /**
   * Get the data source identifier
   */
  abstract getDataSourceIdentifier(): string;

  /**
   * Common transformation logic shared across all data sources
   */
  protected createBaseMasterData(
    candidateData: any,
    context: TransformationContext
  ): MasterDataFormat {
    const masterData = createMasterDataTemplate();
    
    // Set basic metadata
    masterData.data_source = context.dataSource;
    masterData.job_name = context.jobName;
    masterData.unique_key_string = this.dataProcessingUtils.generateUniqueKeyString(
      candidateData,
      context.dataSource
    );
    
    // Set job process information
    masterData.job_process.job_id = context.jobId;
    masterData.job_process.applications = [{
      job_board: context.dataSource,
      job_id: context.jobId,
      applied_on: context.timestamp
    }];
    masterData.job_process.arx_last_updated = new Date().toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    // Add data source to arrays
    masterData.data_sources = [context.dataSource];
    masterData.tables = [context.jobId];
    
    return masterData;
  }

  /**
   * Process name information - simplified to avoid duplication
   */
  protected processNameData(candidateData: any, masterData: MasterDataFormat): void {
    const fullName = this.extractFullName(candidateData);
    const nameInfo = this.dataProcessingUtils.processName(fullName);
    
    // Set only in names object, remove duplicated top-level fields
    masterData.names = {
      first_name: nameInfo.first_name,
      last_name: nameInfo.last_name,
      title: null,
      middle_name: nameInfo.middle_name,
      middle_initial: nameInfo.middle_initial,
      name: nameInfo.full_name,
      is_primary: true,
    };
    
    // Keep only essential top-level name fields for backward compatibility
    masterData.full_name = nameInfo.full_name;
    masterData.first_name = nameInfo.first_name;
    masterData.last_name = nameInfo.last_name;
  }

  /**
   * Process contact information - simplified and consolidated
   */
  protected processContactData(candidateData: any, masterData: MasterDataFormat): void {
    // Process email addresses
    const emailInput = candidateData.email_address || candidateData.email || candidateData.emailAddress;
    if (emailInput) {
      const emails = this.dataProcessingUtils.cleanEmailAddresses(emailInput);
      masterData.email_address = emails;
      masterData.all_mails = emails;
      
      // Categorize emails (simplified logic)
      masterData.emails.personal = emails.filter(email => 
        !email.includes('@company.') && !email.includes('@corp.')
      );
      masterData.emails.work = emails.filter(email => 
        email.includes('@company.') || email.includes('@corp.')
      );
    }
    
    // Process phone numbers
    const phoneInput = candidateData.phone_numbers || candidateData.phone || candidateData.phoneNumber || candidateData.phone_number;
    if (phoneInput) {
      const phones = this.dataProcessingUtils.cleanPhoneNumbers(phoneInput);
      masterData.phone_numbers = phones;
      masterData.all_numbers = phones;
    }
  }

  /**
   * Process profile URLs - simplified
   */
  protected processProfileData(candidateData: any, masterData: MasterDataFormat, dataSource: string): void {
    const profileUrl = candidateData.profile_url || candidateData.profileUrl || candidateData.url;
    
    if (profileUrl) {
      masterData.profile_url = profileUrl;
      masterData.profiles = [{
        title: candidateData.profile_title || candidateData.jobTitle || candidateData.headline || null,
        network: dataSource,
        connections: null,
        username: this.extractUsername(profileUrl),
        is_primary: true,
        url: profileUrl,
      }];
    }
  }

  /**
   * Process location information - simplified structure
   */
  protected processLocationData(candidateData: any, masterData: MasterDataFormat): void {
    const locationData = candidateData.location || candidateData.currentLocation || candidateData.current_location;
    const cleanLocation = this.dataProcessingUtils.cleanLocation(locationData);
    
    if (cleanLocation) {
      masterData.location_name = cleanLocation;
      masterData.locations = [{
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
  protected processSkillsData(candidateData: any, masterData: MasterDataFormat): void {
    const skillsInput = candidateData.skills || candidateData.keySkills || candidateData.key_skills;
    if (skillsInput) {
      const skillsArray = this.dataProcessingUtils.extractSkills(skillsInput);
      masterData.skills = skillsArray.map(skill => ({
        name: skill,
        is_primary: false,
      }));
    }
  }

  /**
   * Process experience information
   */
  protected processExperienceData(candidateData: any, masterData: MasterDataFormat): void {
    const experienceData = candidateData.experience || candidateData.workExp || candidateData.work_experience;
    
    if (experienceData && Array.isArray(experienceData)) {
      masterData.experience = experienceData.map((exp, index) => ({
        company: {
          name: exp.company?.name || exp.companyName || exp.company || null,
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
        title: {
          name: exp.title || exp.designation || exp.role || null,
          raw: exp.title || exp.designation || exp.role || null,
          role: exp.title || exp.designation || exp.role || null,
          sub_role: null,
          levels: [],
        },
        start_date: this.dataProcessingUtils.formatDate(exp.start_date || exp.startDate || exp.workingFrom),
        end_date: this.dataProcessingUtils.formatDate(exp.end_date || exp.endDate || exp.workingTo),
        summary: exp.summary || exp.description || null,
        is_primary: index === 0,
      }));
      
      // Calculate experience statistics
      this.calculateExperienceStats(masterData);
    }
  }

  /**
   * Process education information
   */
  protected processEducationData(candidateData: any, masterData: MasterDataFormat): void {
    const educationData = candidateData.education || candidateData.educationDetails;
    
    if (educationData && Array.isArray(educationData)) {
      masterData.education = educationData.map((edu, index) => ({
        school: {
          name: edu.institute || edu.school || edu.university || null,
          type: null,
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
        degrees: [edu.degree || edu.course || edu.qualification || ''],
        start_date: this.dataProcessingUtils.formatDate(edu.start_date || edu.startYear),
        end_date: this.dataProcessingUtils.formatDate(edu.end_date || edu.endYear),
        gpa: null,
        summary: edu.summary || null,
        is_primary: index === 0,
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
  protected calculateExperienceStats(masterData: MasterDataFormat): void {
    const experience = masterData.experience;
    
    if (!experience || experience.length === 0) {
      return;
    }

    const currentRole = experience[0];
    const currentRoleTenure = this.dataProcessingUtils.calculateTenure(
      currentRole.start_date || '',
      currentRole.end_date || undefined
    );

    const companies = [...new Set(experience.map(exp => exp.company.name).filter(Boolean))];
    const roles = [...new Set(experience.map(exp => exp.title.name).filter(Boolean))];
    
    const tenures = experience.map(exp => 
      this.dataProcessingUtils.calculateTenure(exp.start_date || '', exp.end_date || undefined)
    ).filter(tenure => tenure > 0);

    const totalExperience = experience.reduce((total, exp) => {
      return total + this.dataProcessingUtils.calculateTenure(exp.start_date || '', exp.end_date || undefined);
    }, 0);

    masterData.experience_stats = {
      total_experience: Math.round(totalExperience / 12 * 10) / 10, // Convert to years
      current_role_tenure: Math.round(currentRoleTenure / 12 * 10) / 10,
      total_job_changes: companies.length,
      average_tenure: tenures.length > 0 ? Math.round((tenures.reduce((a, b) => a + b, 0) / tenures.length / 12) * 10) / 10 : 0,
      promotions: {},
      longest_tenure: tenures.length > 0 ? Math.round(Math.max(...tenures) / 12 * 10) / 10 : 0,
      shortest_tenure: tenures.length > 0 ? Math.round(Math.min(...tenures) / 12 * 10) / 10 : 0,
      companies_worked_for: companies as string[],
      roles_worked_in: roles as string[],
      most_recent_role: currentRole.title.name || '',
    };

    masterData.inferred_years_experience = masterData.experience_stats.total_experience;
  }

  /**
   * Process salary information - simplified
   */
  protected processSalaryData(candidateData: any, masterData: MasterDataFormat): void {
    const salaryData = candidateData.salary || 
                      candidateData.currentSalary || 
                      candidateData.annual_salary ||
                      candidateData.ctc;
    
    if (salaryData) {
      const salaryNumber = this.dataProcessingUtils.extractSalaryNumber(salaryData);
      masterData.inferred_salary = salaryNumber;
    }
  }

  /**
   * Add event to job process - utility method to reduce code duplication
   */
  protected addJobProcessEvent(masterData: MasterDataFormat, type: string, value: any): void {
    if (value !== null && value !== undefined && value !== '') {
      masterData.job_process.events.push({
        type,
        value,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Set basic job information - utility method
   */
  protected setJobInfo(candidateData: any, masterData: MasterDataFormat): void {
    const jobTitle = candidateData.jobTitle || 
                    candidateData.current_designation || 
                    candidateData.headline ||
                    candidateData.title;
    
    const companyName = candidateData.job_company_name || 
                       candidateData.company_name || 
                       candidateData.current_company ||
                       candidateData.currentCompany;

    if (jobTitle) {
      masterData.job_title = jobTitle;
      masterData.profile_title = jobTitle;
    }

    if (companyName) {
      masterData.job_company_name = companyName;
    }
  }

  /**
   * Process industry information - utility method
   */
  protected processIndustryData(candidateData: any, masterData: MasterDataFormat): void {
    const industry = candidateData.industry;
    if (industry) {
      masterData.industry = industry;
      masterData.industries = [{
        name: industry,
        is_primary: true,
      }];
    }
  }
}
