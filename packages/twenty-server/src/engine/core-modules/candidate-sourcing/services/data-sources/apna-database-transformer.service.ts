import { Injectable } from '@nestjs/common';
import { MasterDataEducation, MasterDataExperience, MasterDataFormat } from '../../types/master-data.types';
import { DataProcessingUtils } from '../../utils/data-processing.utils';
import { BaseDataSourceTransformerService, TransformationContext } from './base-data-source-transformer.service';

@Injectable()
export class ApnaDatabaseTransformerService extends BaseDataSourceTransformerService {
  constructor(dataProcessingUtils: DataProcessingUtils) {
    super(dataProcessingUtils);
  }

  getDataSourceIdentifier(): string {
    return 'apna_database';
  }

  transformToMasterFormat(
    candidateData: any,
    context: TransformationContext
  ): MasterDataFormat {
    const masterData = this.createBaseMasterData(candidateData, context);
    
    // Use simplified base methods where possible
    this.processNameData(candidateData, masterData);
    this.processSkillsData(candidateData, masterData);
    this.processLocationData(candidateData, masterData);
    this.setJobInfo(candidateData, masterData);
    
    // Process Apna-specific data
    this.processApnaExperienceData(candidateData, masterData);
    this.processApnaEducationData(candidateData, masterData);
    this.processApnaSpecificData(candidateData, masterData);
    
    return masterData;
  }


  private processApnaExperienceData(candidateData: any, masterData: MasterDataFormat): void {
    const currentExperience = candidateData.currentExperience;
    const totalExperienceInYears = candidateData.totalExperienceInYears;
    const currentSalary = candidateData.currentSalary;

    if (currentExperience) {
      const experience: MasterDataExperience = {
        title: {
          name: currentExperience.jobTitle ? this.cleanHtml(currentExperience.jobTitle) : null,
          raw: currentExperience.jobTitle ? this.cleanHtml(currentExperience.jobTitle) : null,
          role: currentExperience.jobTitle ? this.cleanHtml(currentExperience.jobTitle) : null,
          sub_role: null,
          levels: [],
        },
        company: {
          name: currentExperience.companyName ? this.cleanHtml(currentExperience.companyName) : null,
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

      masterData.experience = [experience];
      
      // Set top-level fields
      if (currentExperience.companyName) {
        masterData.job_company_name = this.cleanHtml(currentExperience.companyName);
      }
      
      if (currentExperience.jobTitle) {
        masterData.job_title = this.cleanHtml(currentExperience.jobTitle);
      }
      
      if (totalExperienceInYears) {
        masterData.inferred_years_experience = Math.round(totalExperienceInYears * 10) / 10; // Round to 1 decimal
      }
      
      if (currentSalary) {
        masterData.inferred_salary = currentSalary;
      }
    }
  }

  private processApnaEducationData(candidateData: any, masterData: MasterDataFormat): void {
    const education = candidateData.education;
    
    if (education?.title) {
      const titleParts = education.title.split(',');
      const instituteName = titleParts.length > 1 ? titleParts[1].trim() : '';
      const courseName = titleParts.length > 0 ? titleParts[0].trim() : education.title;
      
      const educationEntry: MasterDataEducation = {
        school: {
          name: instituteName,
          type: 'university',
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
        degrees: [courseName],
        start_date: null,
        end_date: education.year || null,
        gpa: null,
        summary: null,
        is_primary: true,
      };

      masterData.education = [educationEntry];
      
      // Set highest education level if available
      if (candidateData.highest_education_level) {
        masterData.job_process.events.push({
          type: 'highest_education_level',
          value: candidateData.highest_education_level,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  private processApnaSkillsData(candidateData: any, masterData: MasterDataFormat): void {
    const skills = candidateData.skills;
    
    if (skills && Array.isArray(skills)) {
      masterData.skills = skills.map(skill => ({
        name: this.cleanHtml(skill),
        is_primary: false,
      }));
    }
  }

  private processApnaLocationData(candidateData: any, masterData: MasterDataFormat): void {
    const location = candidateData.location;
    
    if (location) {
      const locationName = location.cityName && location.areaName ? 
        `${location.cityName}, ${location.areaName}` : 
        location.cityName || location.areaName || '';

      masterData.locations = [{
        name: locationName,
        locality: location.areaName || null,
        region: location.cityName || null,
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
      
      masterData.location_name = location.cityName || '';
    }
  }

  private processApnaPhotoData(candidateData: any, masterData: MasterDataFormat): void {
    const profilePhotoUrl = candidateData.profilePhotoUrl;
    
    if (profilePhotoUrl) {
      masterData.job_process.events.push({
        type: 'profile_picture',
        value: profilePhotoUrl,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private processApnaSpecificData(candidateData: any, masterData: MasterDataFormat): void {
    // Use utility method for events
    this.addJobProcessEvent(masterData, 'last_active', candidateData.activeOn);
    this.addJobProcessEvent(masterData, 'last_updated', candidateData.updatedOn);
    this.addJobProcessEvent(masterData, 'is_cv_attached', candidateData.isCvAttached);
    this.addJobProcessEvent(masterData, 'profile_picture', candidateData.profilePhotoUrl);

    // Process gender
    const gender = candidateData.gender?.toLowerCase();
    if (gender) {
      let genderValue = '';
      if (gender === 'm') genderValue = 'Male';
      else if (gender === 'f') genderValue = 'Female';
      
      if (genderValue) {
        masterData.gender = genderValue;
      }
    }

    // Process various Apna-specific events using utility method
    this.addJobProcessEvent(masterData, 'preferred_locations', 
      candidateData.preferredLocation?.join(', '));
    this.addJobProcessEvent(masterData, 'experience_departments', 
      candidateData.experienceDepartments?.join(','));
    this.addJobProcessEvent(masterData, 'languages', candidateData.languages);
    this.addJobProcessEvent(masterData, 'english_level', candidateData.englishLevel);
    this.addJobProcessEvent(masterData, 'english_audio_intro_url', candidateData.english_audio_intro_url);
    this.addJobProcessEvent(masterData, 'may_also_know', candidateData.mayAlsoKnow);
    this.addJobProcessEvent(masterData, 'is_fresher', candidateData.fresher);
    this.addJobProcessEvent(masterData, 'is_experienced', candidateData.isExperienced);
    this.addJobProcessEvent(masterData, 'token', candidateData.token);
  }

  /**
   * Clean HTML tags from text
   */
  private cleanHtml(text: string): string {
    if (!text) return '';
    return text.replace(/<[^>]*>/g, '');
  }
}
