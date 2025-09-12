import { Injectable } from '@nestjs/common';
import { MasterDataEducation, MasterDataExperience, MasterDataFormat } from '../../types/master-data.types';
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

  transformToMasterFormat(
    candidateData: any,
    context: TransformationContext
  ): MasterDataFormat {
    const masterData = this.createBaseMasterData(candidateData, context);
    
    // Process name - Resdex uses 'jsUserName' field
    this.processResdexNameData(candidateData, masterData);
    
    // Process contact information
    this.processContactData(candidateData, masterData);
    
    // Process profile information
    this.processResdexProfileData(candidateData, masterData);
    
    // Process location
    this.processResdexLocationData(candidateData, masterData);
    
    // Process skills
    this.processResdexSkillsData(candidateData, masterData);
    
    // Process experience
    this.processResdexExperienceData(candidateData, masterData);
    
    // Process education
    this.processResdexEducationData(candidateData, masterData);
    
    // Process salary
    this.processResdexSalaryData(candidateData, masterData);
    
    // Process other Resdex-specific fields
    this.processResdexSpecificData(candidateData, masterData);
    
    return masterData;
  }

  private processResdexNameData(candidateData: any, masterData: MasterDataFormat): void {
    const fullName = candidateData.jsUserName || candidateData.name || '';
    const nameInfo = this.dataProcessingUtils.processName(fullName);
    
    masterData.names = {
      first_name: nameInfo.first_name,
      last_name: nameInfo.last_name,
      title: null,
      middle_name: nameInfo.middle_name,
      middle_initial: nameInfo.middle_initial,
      name: nameInfo.full_name,
      is_primary: true,
    };
    
    masterData.first_name = nameInfo.first_name;
    masterData.last_name = nameInfo.last_name;
    masterData.middle_name = nameInfo.middle_name;
    masterData.middle_initial = nameInfo.middle_initial;
    masterData.full_name = nameInfo.full_name;
  }

  private processResdexProfileData(candidateData: any, masterData: MasterDataFormat): void {
    const profileUrl = candidateData.profile_url || candidateData.profileUrl;
    
    if (profileUrl) {
      masterData.profile_url = profileUrl;
      masterData.profiles = [{
        title: candidateData.jobTitle || candidateData.current_designation || null,
        network: 'resdex_naukri',
        connections: null,
        username: this.extractUsername(profileUrl),
        is_primary: true,
        url: profileUrl,
      }];
    }

    // Set job title
    masterData.job_title = candidateData.jobTitle || candidateData.current_designation || null;
    masterData.profile_title = candidateData.jobTitle || candidateData.current_designation || null;
  }

  private processResdexLocationData(candidateData: any, masterData: MasterDataFormat): void {
    const currentLocation = candidateData.currentLocation || candidateData.current_location;
    const preferredLocations = candidateData.preferredLocations || candidateData.preferred_locations;
    
    if (currentLocation) {
      masterData.location_name = currentLocation;
      masterData.locations = [{
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
            masterData.locations.push({
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

  private processResdexSkillsData(candidateData: any, masterData: MasterDataFormat): void {
    // Resdex has both keySkills and focusedSkills
    const keySkills = this.dataProcessingUtils.extractSkills(candidateData.keySkills || candidateData.key_skills);
    const focusedSkills = this.dataProcessingUtils.extractSkills(candidateData.focusedSkills || candidateData.focused_skills);
    
    const allSkills = [...keySkills, ...focusedSkills];
    const uniqueSkills = [...new Set(allSkills)];
    
    masterData.skills = uniqueSkills.map((skill, index) => ({
      name: skill,
      is_primary: index < keySkills.length, // Key skills are marked as primary
    }));
  }

  private processResdexExperienceData(candidateData: any, masterData: MasterDataFormat): void {
    // Resdex provides experience in years and months separately
    const experienceYears = parseInt(candidateData.experience_years || '0', 10);
    const experienceMonths = parseInt(candidateData.experience_months || '0', 10);
    const totalExperienceInYears = experienceYears + (experienceMonths / 12);
    
    masterData.inferred_years_experience = Math.round(totalExperienceInYears * 10) / 10;
    
    // Create experience entries based on current and previous organizations
    const experienceEntries: MasterDataExperience[] = [];
    
    if (candidateData.current_organization) {
      experienceEntries.push({
        company: {
          name: candidateData.current_organization,
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
          is_primary: true,
        },
        locations: [],
        title: {
          name: candidateData.current_designation || null,
          raw: candidateData.current_designation || null,
          role: candidateData.current_designation || null,
          sub_role: null,
          levels: [],
        },
        start_date: null, // Resdex doesn't provide specific start dates
        end_date: null,
        summary: null,
        is_primary: true,
      });
    }
    
    if (candidateData.previous_organization && candidateData.previous_organization !== candidateData.current_organization) {
      experienceEntries.push({
        company: {
          name: candidateData.previous_organization,
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
          is_primary: false,
        },
        locations: [],
        title: {
          name: candidateData.previous_designation || null,
          raw: candidateData.previous_designation || null,
          role: candidateData.previous_designation || null,
          sub_role: null,
          levels: [],
        },
        start_date: null,
        end_date: null,
        summary: null,
        is_primary: false,
      });
    }
    
    masterData.experience = experienceEntries;
    
    // Set basic experience stats
    masterData.experience_stats = {
      total_experience: totalExperienceInYears,
      current_role_tenure: 0, // Not available in Resdex
      total_job_changes: experienceEntries.length,
      average_tenure: experienceEntries.length > 0 ? totalExperienceInYears / experienceEntries.length : 0,
      promotions: {},
      longest_tenure: 0,
      shortest_tenure: 0,
      companies_worked_for: experienceEntries.map(exp => exp.company.name).filter(Boolean) as string[],
      roles_worked_in: experienceEntries.map(exp => exp.title.name).filter(Boolean) as string[],
      most_recent_role: candidateData.current_designation || '',
    };
  }

  private processResdexEducationData(candidateData: any, masterData: MasterDataFormat): void {
    const educationEntries: MasterDataEducation[] = [];
    
    // Process UG education
    if (candidateData.ug_institute) {
      educationEntries.push({
        school: {
          name: candidateData.ug_institute,
          type: 'undergraduate',
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
        degrees: [candidateData.ug_course || candidateData.ug_degree || ''].filter(Boolean),
        start_date: candidateData.ug_year ? `${candidateData.ug_year}-01-01` : null,
        end_date: candidateData.ug_year ? `${parseInt(candidateData.ug_year) + 4}-01-01` : null,
        gpa: null,
        summary: candidateData.ug_specialization || null,
        is_primary: true,
      });
      
      masterData.ug_education_institute = candidateData.ug_institute;
      masterData.ug_degree = candidateData.ug_course || candidateData.ug_degree;
    }
    
    // Process PG education
    if (candidateData.pg_institute) {
      educationEntries.push({
        school: {
          name: candidateData.pg_institute,
          type: 'postgraduate',
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
        degrees: [candidateData.pg_course || ''].filter(Boolean),
        start_date: candidateData.pg_year ? `${candidateData.pg_year}-01-01` : null,
        end_date: candidateData.pg_year ? `${parseInt(candidateData.pg_year) + 2}-01-01` : null,
        gpa: null,
        summary: candidateData.pg_specialization || null,
        is_primary: false,
      });
    }
    
    masterData.education = educationEntries;
  }

  private processResdexSalaryData(candidateData: any, masterData: MasterDataFormat): void {
    // Resdex provides salary in lakhs and thousands
    const ctcLacs = parseInt(candidateData.ctc_lacs || '0', 10);
    const ctcThousands = parseInt(candidateData.ctc_thousands || '0', 10);
    const ctcCurrency = candidateData.ctc_currency || 'INR';
    
    if (ctcLacs > 0 || ctcThousands > 0) {
      const totalSalary = (ctcLacs * 100000) + (ctcThousands * 1000);
      masterData.inferred_salary = totalSalary;
    }
  }

  private processResdexSpecificData(candidateData: any, masterData: MasterDataFormat): void {
    // Add notice period information if available
    if (candidateData.noticePeriod || candidateData.notice_period) {
      masterData.job_process.events.push({
        type: 'notice_period',
        value: candidateData.noticePeriod || candidateData.notice_period,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Add last modified date
    if (candidateData.modifyDateLabel || candidateData.modify_date_label) {
      masterData.last_updated = this.dataProcessingUtils.formatDate(
        candidateData.modifyDateLabel || candidateData.modify_date_label
      );
      masterData.job_process.events.push({
        type: 'naukri_modified_date',
        value: candidateData.modifyDateLabel || candidateData.modify_date_label,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Add active date from Naukri
    if (candidateData.activeDateLabel || candidateData.active_date_label) {
      masterData.job_process.events.push({
        type: 'naukri_active_date',
        value: candidateData.activeDateLabel || candidateData.active_date_label,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Process industry information
    if (candidateData.industry) {
      masterData.industry = candidateData.industry;
      masterData.industries = [{
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
      masterData.job_process.events.push({
        type: 'profile_picture',
        value: photoUrl,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Process dynamic encrypted unique ID for profile URL
    if (candidateData.dynamicEncryptedUniqueId) {
      const resdexProfileUrl = `https://resdex.naukri.com/v3/preview?uniqId=${candidateData.dynamicEncryptedUniqueId}`;
      masterData.job_process.events.push({
        type: 'resdex_profile_url',
        value: resdexProfileUrl,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Process candidate profile URL if available
    if (candidateData.candidate_profile) {
      masterData.job_process.events.push({
        type: 'candidate_profile_url',
        value: candidateData.candidate_profile,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Set unique ID if available
    if (candidateData.uniqueId || candidateData.unique_id) {
      masterData.id = candidateData.uniqueId || candidateData.unique_id;
    }
    
    // Process employment details
    const currentEmployment = candidateData.employment?.current;
    const previousEmployment = candidateData.employment?.previous;
    
    if (currentEmployment) {
      masterData.job_process.events.push({
        type: 'current_employment',
        value: {
          organization: currentEmployment.organization,
          designation: currentEmployment.designation,
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    if (previousEmployment) {
      masterData.job_process.events.push({
        type: 'previous_employment',
        value: {
          organization: previousEmployment.organization,
          designation: previousEmployment.designation,
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Process education details from specific Resdex structure
    const education = candidateData.education;
    if (education) {
      if (education.pg) {
        masterData.job_process.events.push({
          type: 'pg_education',
          value: {
            institute: education.pg.institute,
            course: education.pg.course,
            year: education.pg.year,
          },
          timestamp: new Date().toISOString(),
        });
      }
      
      if (education.ug) {
        masterData.job_process.events.push({
          type: 'ug_education',
          value: {
            institute: education.ug.institute,
            course: education.ug.course,
            year: education.ug.year,
          },
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    // Process CTC information
    if (candidateData.ctcInfo) {
      const ctcInfo = candidateData.ctcInfo;
      masterData.job_process.events.push({
        type: 'ctc_info',
        value: {
          lacs: ctcInfo.lacs,
          thousands: ctcInfo.thousands,
          currency: ctcInfo.currency,
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Process experience in years and months
    if (candidateData.experience) {
      masterData.job_process.events.push({
        type: 'experience_breakdown',
        value: {
          years: candidateData.experience.years,
          months: candidateData.experience.months,
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Process additional fields that might be specific to Resdex
    const additionalFields = [
      'experience_in_years',
      'campaign',
      'source',
    ];
    
    additionalFields.forEach(field => {
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
