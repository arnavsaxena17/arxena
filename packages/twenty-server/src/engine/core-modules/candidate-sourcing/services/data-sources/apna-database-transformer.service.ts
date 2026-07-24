import { Injectable } from '@nestjs/common';
import { UserProfile } from 'twenty-shared';
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

  transformToUserProfile(
    candidateData: any,
    context: TransformationContext
  ): UserProfile {
    const userProfile = this.createBaseUserProfile(candidateData, context);
    
    // Use simplified base methods where possible
    this.processNameData(candidateData, userProfile);
    this.processSkillsData(candidateData, userProfile);
    this.processLocationData(candidateData, userProfile);
    this.setJobInfo(candidateData, userProfile);
    
    // Process Apna-specific data
    this.processApnaExperienceData(candidateData, userProfile);
    this.processApnaEducationData(candidateData, userProfile);
    this.processApnaSpecificData(candidateData, userProfile);
    
    return userProfile;
  }


  private processApnaExperienceData(candidateData: any, userProfile: UserProfile): void {
    const currentExperience = candidateData.currentExperience;
    const totalExperienceInYears = candidateData.totalExperienceInYears;
    const currentSalary = candidateData.currentSalary;

    if (currentExperience) {
      const experience = {
        title: {
          name: currentExperience.jobTitle ? this.cleanHtml(currentExperience.jobTitle) : '',
        },
        company: {
          name: currentExperience.companyName ? this.cleanHtml(currentExperience.companyName) : '',
        },
        startDate: null,
        endDate: null,
      };

      userProfile.experience = [experience];
      
      // Set top-level fields
      if (currentExperience.companyName) {
        userProfile.jobCompanyName = this.cleanHtml(currentExperience.companyName);
      }
      
      if (currentExperience.jobTitle) {
        userProfile.jobTitle = this.cleanHtml(currentExperience.jobTitle);
      }
      
      if (totalExperienceInYears) {
        userProfile.inferredYearsExperience = Math.round(totalExperienceInYears * 10) / 10; // Round to 1 decimal
      }
      
      if (currentSalary) {
        userProfile.inferredSalary = currentSalary;
      }
    }
  }

  private processApnaEducationData(candidateData: any, userProfile: UserProfile): void {
    const education = candidateData.education;
    
    if (education?.title) {
      const titleParts = education.title.split(',');
      const instituteName = titleParts.length > 1 ? titleParts[1].trim() : '';
      const courseName = titleParts.length > 0 ? titleParts[0].trim() : education.title;
      
      const educationEntry = {
        institute: {
          name: instituteName,
          type: 'university',
          location: null,
          profiles: [],
          website: null,
        },
        degrees: courseName,
        start_date: null,
        end_date: education.year || null,
        gpa: null,
        majors: [],
        minors: [],
        locations: null,
      };

      userProfile.education = [educationEntry];
      
      // Set highest education level if available
      if (candidateData.highest_education_level) {
        // this.addJobProcessEvent(userProfile, 'highest_education_level', candidateData.highest_education_level);
      }
    }
  }

  private processApnaSkillsData(candidateData: any, userProfile: UserProfile): void {
    const skills = candidateData.skills;
    
    if (skills && Array.isArray(skills)) {
      userProfile.skills = skills.map(skill => this.cleanHtml(skill)).join(', ');
      userProfile.keySkills = skills.map(skill => this.cleanHtml(skill)).join(', ');
    }
  }

  private processApnaLocationData(candidateData: any, userProfile: UserProfile): void {
    const location = candidateData.location;
    
    if (location) {
      const locationName = location.cityName && location.areaName ? 
        `${location.cityName}, ${location.areaName}` : 
        location.cityName || location.areaName || '';

      userProfile.locations = [{
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
      
      userProfile.locationName = location.cityName || '';
    }
  }

  private processApnaPhotoData(candidateData: any, userProfile: UserProfile): void {
    const profilePhotoUrl = candidateData.profilePhotoUrl;
    
    if (profilePhotoUrl) {
      userProfile.displayPicture = profilePhotoUrl;
      // this.addJobProcessEvent(userProfile, 'profile_picture', profilePhotoUrl);
    }
  }

  private processApnaSpecificData(candidateData: any, userProfile: UserProfile): void {
    // Use utility method for events
    // this.addJobProcessEvent(userProfile, 'last_active', candidateData.activeOn);
    // this.addJobProcessEvent(userProfile, 'last_updated', candidateData.updatedOn);
    // this.addJobProcessEvent(userProfile, 'is_cv_attached', candidateData.isCvAttached);
    // this.addJobProcessEvent(userProfile, 'profile_picture', candidateData.profilePhotoUrl);

    // Process gender
    const gender = candidateData.gender?.toLowerCase();
    if (gender) {
      let genderValue = '';
      if (gender === 'm') genderValue = 'Male';
      else if (gender === 'f') genderValue = 'Female';
      
      if (genderValue) {
        userProfile.gender = genderValue;
      }
    }

    // Process various Apna-specific events using utility method
    // this.addJobProcessEvent(userProfile, 'preferred_locations', 
      // candidateData.preferredLocation?.join(', '));
    // this.addJobProcessEvent(userProfile, 'experience_departments', 
      // candidateData.experienceDepartments?.join(','));
    // this.addJobProcessEvent(userProfile, 'languages', candidateData.languages);
    // this.addJobProcessEvent(userProfile, 'english_level', candidateData.englishLevel);
    // this.addJobProcessEvent(userProfile, 'english_audio_intro_url', candidateData.english_audio_intro_url);
    // this.addJobProcessEvent(userProfile, 'may_also_know', candidateData.mayAlsoKnow);
    // this.addJobProcessEvent(userProfile, 'is_fresher', candidateData.fresher);
    // this.addJobProcessEvent(userProfile, 'is_experienced', candidateData.isExperienced);
    // this.addJobProcessEvent(userProfile, 'token', candidateData.token);
  }

  /**
   * Clean HTML tags from text
   */
  private cleanHtml(text: string): string {
    if (!text) return '';
    return text.replace(/<[^>]*>/g, '');
  }
}
