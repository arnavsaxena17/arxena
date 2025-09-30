import { Injectable } from '@nestjs/common';
import { UserProfile } from 'twenty-shared';
import { DataProcessingUtils } from '../../utils/data-processing.utils';
import { BaseDataSourceTransformerService, TransformationContext } from './base-data-source-transformer.service';

export interface ParsedCVData {
  // Basic information - matching base transformer structure
  name?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  phoneNumbers?: string;
  location?: string;
  currentLocation?: string;
  profileUrl?: string;
  linkedinUrl?: string;
  githubMainPageUrl?: string;
  portfolioWebsiteUrl?: string;
  
  // Education information
  university?: string;
  educationLevel?: string;
  graduationYear?: string;
  graduationMonth?: string;
  majors?: string;
  gpa?: string;
  
  // Experience and skills
  workExperience?: Array<{
    jobTitle?: string;
    company?: string;
    location?: string;
    duration?: string;
    jobSummary?: string;
  }>;
  projectExperience?: Array<{
    projectName?: string;
    projectDescription?: string;
  }>;
  experience?: Array<{
    company?: string;
    companyName?: string;
    title?: string;
    designation?: string;
    role?: string;
    startDate?: string;
    endDate?: string;
  }>;
  skills?: string;
  keySkills?: string;
}

@Injectable()
export class ParsedCVTransformerService extends BaseDataSourceTransformerService {
  constructor(dataProcessingUtils: DataProcessingUtils) {
    super(dataProcessingUtils);
  }

  getDataSourceIdentifier(): string {
    return 'parsed_cv';
  }

  transformToUserProfile(
    candidateData: ParsedCVData,
    context: TransformationContext
  ): UserProfile {
    const userProfile = this.createBaseUserProfile(candidateData, context);
    
    // Use base transformer methods for common processing
    this.processNameData(candidateData, userProfile);
    this.processContactData(candidateData, userProfile);
    this.processLocationData(candidateData, userProfile);
    this.processSkillsData(candidateData, userProfile);
    this.processExperienceData(candidateData, userProfile);
    this.processEducationData(candidateData, userProfile);
    this.processProfileData(candidateData, userProfile, context.dataSource);
    
    // Process work experience from parsed CV format
    this.processWorkExperience(candidateData.workExperience, userProfile);
    
    // Process project experience
    this.processProjectExperience(candidateData.projectExperience, userProfile);
    
    return userProfile;
  }


  /**
   * Process work experience from parsed CV
   */
  private processWorkExperience(workExp: ParsedCVData['workExperience'], userProfile: UserProfile): void {
    if (!workExp || !Array.isArray(workExp)) return;

    // Convert work experience to experience format expected by base transformer
    const experienceData = workExp.map((exp) => ({
      company: {
        name: exp.company || '',
      },
      title: {
        name: exp.jobTitle || '',
      },
      startDate: this.extractStartDate(exp.duration),
      endDate: this.extractEndDate(exp.duration),
    }));

    // Add to existing experience array or create new one
    if (!userProfile.experience) {
      userProfile.experience = [];
    }
    userProfile.experience = [...userProfile.experience, ...experienceData];

    // Set current job information from first experience entry
    if (workExp.length > 0) {
      const currentJob = workExp[0];
      const jobTitle = currentJob.jobTitle;
      if (jobTitle) {
        userProfile.jobTitle = jobTitle;
        userProfile.profileTitle = jobTitle;
      }
      if (currentJob.company) {
        userProfile.jobCompanyName = currentJob.company;
      }
    }

    // Calculate experience statistics
    this.calculateExperienceStats(userProfile);
  }

  /**
   * Process project experience from parsed CV
   */
  private processProjectExperience(projectExp: ParsedCVData['projectExperience'], userProfile: UserProfile): void {
    if (!projectExp || !Array.isArray(projectExp)) return;

    // Convert project experience to skills or interests
    const projectSkills = projectExp
      .map(project => project.projectDescription || '')
      .join(' ')
      .split(/[,\s]+/)
      .filter(skill => skill.length > 2)
      .slice(0, 10); // Limit to 10 skills

    if (projectSkills.length > 0) {
      userProfile.skills = projectSkills.join(', ');
      userProfile.keySkills = projectSkills.join(', ');
    }
  }


  /**
   * Extract start date from duration string
   */
  private extractStartDate(duration?: string): string | null {
    if (!duration) return null;
    
    // Simple date extraction - can be enhanced based on common patterns
    const yearMatch = duration.match(/(\d{4})/);
    return yearMatch ? yearMatch[1] : null;
  }

  /**
   * Extract end date from duration string
   */
  private extractEndDate(duration?: string): string | null {
    if (!duration) return null;
    
    // Look for "Present" or "Current" indicators
    if (duration.toLowerCase().includes('present') || duration.toLowerCase().includes('current')) {
      return new Date().getFullYear().toString();
    }
    
    // Extract years from duration
    const yearMatches = duration.match(/(\d{4})/g);
    if (yearMatches && yearMatches.length > 1) {
      return yearMatches[yearMatches.length - 1];
    }
    
    return null;
  }

  /**
   * Format education date from year and month
   */
  private formatEducationDate(year?: string, month?: string): string | null {
    if (!year) return null;
    
    if (month) {
      return `${year}-${month.padStart(2, '0')}-01`;
    }
    
    return `${year}-01-01`;
  }
}
