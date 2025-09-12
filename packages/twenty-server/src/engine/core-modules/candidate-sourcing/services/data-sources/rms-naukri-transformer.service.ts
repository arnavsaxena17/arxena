import { Injectable } from '@nestjs/common';
import { MasterDataEducation, MasterDataExperience, MasterDataFormat } from '../../types/master-data.types';
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

  transformToMasterFormat(
    candidateData: any,
    context: TransformationContext
  ): MasterDataFormat {
    const masterData = this.createBaseMasterData(candidateData, context);
    
    // Process name - RMS uses 'full_name' field
    this.processRmsNameData(candidateData, masterData);
    
    // Process contact information
    this.processContactData(candidateData, masterData);
    
    // Process profile information
    this.processRmsProfileData(candidateData, masterData);
    
    // Process location
    this.processRmsLocationData(candidateData, masterData);
    
    // Process skills
    this.processRmsSkillsData(candidateData, masterData);
    
    // Process experience
    this.processRmsExperienceData(candidateData, masterData);
    
    // Process education
    this.processRmsEducationData(candidateData, masterData);
    
    // Process RMS-specific data
    this.processRmsSpecificData(candidateData, masterData);
    
    return masterData;
  }

  private processRmsNameData(candidateData: any, masterData: MasterDataFormat): void {
    const fullName = candidateData.full_name || candidateData.fullName || '';
    
    if (fullName) {
      const nameResult = this.dataProcessingUtils.processName(fullName);
      
      // Update master data with processed name information
      masterData.names = {
        first_name: nameResult.first_name,
        last_name: nameResult.last_name,
        title: null,
        middle_name: nameResult.middle_name,
        middle_initial: nameResult.middle_initial,
        name: nameResult.full_name,
        is_primary: true,
      };
      
      masterData.first_name = nameResult.first_name;
      masterData.last_name = nameResult.last_name;
      masterData.middle_name = nameResult.middle_name;
      masterData.full_name = nameResult.full_name;
      masterData.middle_initial = nameResult.middle_initial;
    }
  }

  private processRmsProfileData(candidateData: any, masterData: MasterDataFormat): void {
    const profileIntro = candidateData.profile_intro;
    const profileId = candidateData.id;
    
    if (profileIntro && profileId) {
      masterData.profiles = [{
        title: profileIntro,
        network: 'rms_naukri',
        connections: null,
        username: null,
        is_primary: false,
        url: profileId,
      }];
      
      masterData.profile_title = profileIntro;
      masterData.profile_url = profileId;
    }
  }

  private processRmsLocationData(candidateData: any, masterData: MasterDataFormat): void {
    const currentLocation = candidateData.current_location;
    
    if (currentLocation) {
      masterData.locations = [{
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
      
      masterData.location_name = currentLocation;
    }
  }

  private processRmsSkillsData(candidateData: any, masterData: MasterDataFormat): void {
    const keySkills = candidateData.keySkills;
    
    if (keySkills) {
      masterData.skills = keySkills.split(',  ').map((skill: string) => skill.trim());
    }
  }

  private processRmsEducationData(candidateData: any, masterData: MasterDataFormat): void {
    const education = candidateData.education;
    
    if (education) {
      const educationArray: MasterDataEducation[] = [];
      
      // PG Education
      if (education.pg_institute) {
        educationArray.push({
          school: {
            name: education.pg_institute,
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
          degrees: [education.pg_institute], // Note: seems to be reused in Python code
          start_date: null,
          end_date: education.pg_institute, // Note: seems to be reused in Python code
          gpa: null,
          summary: null,
          is_primary: true,
        });
      }
      
      // UG Education
      if (education.ug_institute) {
        educationArray.push({
          school: {
            name: education.ug_institute,
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
          degrees: [education.ug_institute], // Note: seems to be reused in Python code
          start_date: null,
          end_date: education.ug_institute, // Note: seems to be reused in Python code
          gpa: null,
          summary: null,
          is_primary: false,
        });
      }
      
      masterData.education = educationArray;
    }
  }

  private processRmsExperienceData(candidateData: any, masterData: MasterDataFormat): void {
    const currentCompany = candidateData.current_company;
    const currentDesignation = candidateData.current_designation;
    const previousCompany = candidateData.previous_company;
    const previousDesignation = candidateData.previous_designation;
    const experienceInYears = candidateData.experience_in_years;
    const ctc = candidateData.ctc;

    const experienceArray: MasterDataExperience[] = [];

    // Current designation
    const currentExp: MasterDataExperience = {
      title: {
        name: currentDesignation || null,
        raw: currentDesignation || null,
        role: currentDesignation || null,
        sub_role: null,
        levels: [],
      },
      company: {
        name: currentCompany || null,
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
      start_date: null,
      end_date: null,
      summary: null,
      is_primary: true,
    };

    // Previous designation
    const previousExp: MasterDataExperience = {
      title: {
        name: previousDesignation || null,
        raw: previousDesignation || null,
        role: previousDesignation || null,
        sub_role: null,
        levels: [],
      },
      company: {
        name: previousCompany || null,
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
      start_date: null,
      end_date: null,
      summary: null,
      is_primary: false,
    };

    experienceArray.push(currentExp, previousExp);
    masterData.experience = experienceArray;
    
    // Set top-level fields
    masterData.job_company_name = currentCompany || '';
    masterData.job_title = currentDesignation || '';
    masterData.inferred_salary = this.dataProcessingUtils.extractSalaryNumber(ctc);
    masterData.inferred_years_experience = experienceInYears || null;
  }

  private processRmsSpecificData(candidateData: any, masterData: MasterDataFormat): void {
    // Process industry
    if (candidateData.industry) {
      masterData.industries = [{
        name: candidateData.industry,
        is_primary: true,
      }];
    }

    // Process job application specific data
    const appliedOnDate = candidateData.applied_on_date;
    const activeDate = candidateData.active_date;
    const modifiedDate = candidateData.modified_date;

    if (appliedOnDate) {
      masterData.job_process.events.push({
        type: 'job_application_date',
        value: appliedOnDate,
        timestamp: new Date().toISOString(),
      });
    }

    if (activeDate) {
      masterData.job_process.events.push({
        type: 'rms_active_date',
        value: activeDate,
        timestamp: new Date().toISOString(),
      });
    }

    if (modifiedDate) {
      masterData.job_process.events.push({
        type: 'rms_modified_date',
        value: modifiedDate,
        timestamp: new Date().toISOString(),
      });
    }

    // Process social profiles
    if (candidateData.profile_url) {
      masterData.job_process.events.push({
        type: 'rms_profile_url',
        value: candidateData.profile_url,
        timestamp: new Date().toISOString(),
      });
    }

    // Process additional RMS specific fields
    const rmsSpecificFields = [
      'candidate_id',
      'recruiter_id',
      'source_type',
    ];

    rmsSpecificFields.forEach(field => {
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
