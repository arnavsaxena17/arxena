import { Injectable } from '@nestjs/common';
import { MasterDataFormat } from '../../types/master-data.types';
import { DataProcessingUtils } from '../../utils/data-processing.utils';
import { BaseDataSourceTransformerService, TransformationContext } from './base-data-source-transformer.service';

@Injectable()
export class HiringNaukriTransformerService extends BaseDataSourceTransformerService {
  constructor(dataProcessingUtils: DataProcessingUtils) {
    super(dataProcessingUtils);
  }

  getDataSourceIdentifier(): string {
    return 'hiring_naukri';
  }

  transformToMasterFormat(
    candidateData: any,
    context: TransformationContext
  ): MasterDataFormat {
    const masterData = this.createBaseMasterData(candidateData, context);
    
    // Use simplified base methods
    this.processNameData(candidateData, masterData);
    this.processContactData(candidateData, masterData);
    this.processSkillsData(candidateData, masterData);
    this.processIndustryData(candidateData, masterData);
    this.setJobInfo(candidateData, masterData);
    this.processSalaryData(candidateData, masterData);
    
    // Process hiring-specific data
    this.processHiringProfileData(candidateData, masterData);
    this.processHiringLocationData(candidateData, masterData);
    this.processHiringExperienceData(candidateData, masterData);
    this.processHiringEducationData(candidateData, masterData);
    this.processHiringSpecificData(candidateData, masterData);
    
    return masterData;
  }

  private processHiringProfileData(candidateData: any, masterData: MasterDataFormat): void {
    const profileUrl = candidateData.profile_url || candidateData.profileUrl;
    
    if (profileUrl) {
      masterData.profile_url = profileUrl;
      masterData.profiles = [{
        title: candidateData.jobTitle || candidateData.designation || null,
        network: 'hiring_naukri',
        connections: null,
        username: this.extractUsername(profileUrl),
        is_primary: true,
        url: profileUrl,
      }];
    }

    // Set job title from various possible fields
    masterData.job_title = candidateData.jobTitle || 
                          candidateData.designation || 
                          candidateData.currentDesignation || 
                          null;
    masterData.profile_title = masterData.job_title;
    
    // Set profile summary
    if (candidateData.profileSummary || candidateData.summary) {
      masterData.job_process.events.push({
        type: 'profile_summary',
        value: candidateData.profileSummary || candidateData.summary,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private processHiringLocationData(candidateData: any, masterData: MasterDataFormat): void {
    const currentCity = candidateData.currentCity || candidateData.current_city;
    const preferredLocations = candidateData.preferredLocations || candidateData.preferred_locations;
    const homeTown = candidateData['Home Town/City'] || candidateData.homeTown;
    
    if (currentCity) {
      masterData.location_name = currentCity;
      masterData.locations = [{
        name: currentCity,
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
      
      // Add home town if different from current city
      if (homeTown && homeTown !== currentCity) {
        masterData.locations.push({
          name: homeTown,
          locality: null,
          region: null,
          subregion: null,
          country: null,
          continent: null,
          type: 'hometown',
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
      
      // Add preferred locations
      if (preferredLocations) {
        const preferredLocationsList = Array.isArray(preferredLocations) 
          ? preferredLocations 
          : preferredLocations.split(',').map((loc: string) => loc.trim());
          
        preferredLocationsList.forEach((loc: string) => {
          if (loc && loc !== currentCity && loc !== homeTown) {
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

  private processHiringExperienceData(candidateData: any, masterData: MasterDataFormat): void {
    // Hiring Naukri provides work experience as structured data
    const workExp = candidateData.workExp || candidateData.work_experience || candidateData.experience;
    
    if (workExp && Array.isArray(workExp)) {
      masterData.experience = workExp.map((exp, index) => {
        const startDate = this.dataProcessingUtils.formatDate(exp.workingFrom || exp.start_date);
        const endDate = this.dataProcessingUtils.formatDate(exp.workingTo || exp.end_date);
        
        return {
          company: {
            name: exp.company || exp.companyName || null,
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
            name: exp.designation || exp.title || exp.role || null,
            raw: exp.designation || exp.title || exp.role || null,
            role: exp.designation || exp.title || exp.role || null,
            sub_role: null,
            levels: [],
          },
          start_date: startDate,
          end_date: endDate,
          summary: exp.description || exp.summary || null,
          is_primary: index === 0,
        };
      });
      
      // Calculate experience statistics
      this.calculateExperienceStats(masterData);
    } else {
      // If structured experience is not available, try to extract from other fields
      const totalWorkExp = candidateData.workExp || candidateData.total_experience;
      if (totalWorkExp && typeof totalWorkExp === 'string') {
        const experienceMatch = totalWorkExp.match(/(\d+(?:\.\d+)?)/);
        if (experienceMatch) {
          masterData.inferred_years_experience = parseFloat(experienceMatch[1]);
        }
      }
    }
  }

  private processHiringEducationData(candidateData: any, masterData: MasterDataFormat): void {
    const education = candidateData.education || candidateData.educationDetails;
    
    if (education && Array.isArray(education)) {
      masterData.education = education.map((edu, index) => ({
        school: {
          name: edu.institute || edu.school || edu.university || edu.college || null,
          type: edu.type || null,
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
        degrees: [edu.degree || edu.course || edu.qualification || ''].filter(Boolean),
        start_date: this.dataProcessingUtils.formatDate(edu.passingYear || edu.startYear),
        end_date: this.dataProcessingUtils.formatDate(edu.passingYear || edu.endYear),
        gpa: edu.percentage || edu.gpa || null,
        summary: edu.specialization || edu.stream || null,
        is_primary: index === 0,
      }));
    }
  }

  private processHiringSpecificData(candidateData: any, masterData: MasterDataFormat): void {
    // Process salary information
    const annualSalary = candidateData['Annual Salary'] || 
                        candidateData.annual_salary || 
                        candidateData.currentSalary ||
                        candidateData.salary ||
                        candidateData.ctc?.lacs;
    
    if (annualSalary) {
      const salaryNumber = this.dataProcessingUtils.extractSalaryNumber(annualSalary);
      masterData.inferred_salary = salaryNumber;
    }
    
    // Process experience from multiple fields
    const totalExperience = candidateData['Total Experience'] || 
                           candidateData.experience?.years ||
                           candidateData.total_experience;
    
    if (totalExperience) {
      masterData.inferred_years_experience = parseFloat(totalExperience.toString());
    }
    
    // Process notice period
    const noticePeriod = candidateData.noticePeriod || 
                        candidateData['Notice period/ Availability to join'] ||
                        candidateData.notice_period;
    
    if (noticePeriod) {
      masterData.job_process.events.push({
        type: 'notice_period',
        value: noticePeriod,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Process marital status
    const maritalStatus = candidateData['Marital Status'] || candidateData.maritalStatus;
    if (maritalStatus) {
      masterData.job_process.events.push({
        type: 'marital_status',
        value: maritalStatus,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Process birth date and age
    const birthDate = candidateData['Date of Birth'] || candidateData.birth_date;
    if (birthDate) {
      masterData.birth_date = this.dataProcessingUtils.formatDate(birthDate);
      masterData.job_process.events.push({
        type: 'birth_date',
        value: birthDate,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Process gender
    const gender = candidateData['Gender'] || candidateData.gender;
    if (gender) {
      masterData.gender = gender;
    }
    
    // Process home town
    const homeTown = candidateData['Home Town/City'] || candidateData.homeTown;
    if (homeTown) {
      masterData.job_process.events.push({
        type: 'home_town',
        value: homeTown,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Process education details
    const ugUniversity = candidateData['UG University/institute Name'] || candidateData.ug_institute_name;
    const ugGraduationYear = candidateData['UG Graduation year'] || candidateData.ug_graduation_year;
    const ugDegree = candidateData['Under Graduation degree'] || candidateData.ug_graduation_degree;
    const pgUniversity = candidateData['PG university/institute name'] || candidateData.pg_institute_name;
    const pgGraduationYear = candidateData['PG Graduation year'] || candidateData.pg_graduation_year;
    const pgDegree = candidateData['Post graduation degree'] || candidateData.pg_graduation_degree;
    
    if (ugUniversity) {
      masterData.ug_education_institute = ugUniversity;
      masterData.job_process.events.push({
        type: 'ug_university',
        value: ugUniversity,
        timestamp: new Date().toISOString(),
      });
    }
    
    if (ugDegree) {
      masterData.ug_degree = ugDegree;
    }
    
    // Process resume headline
    const resumeHeadline = candidateData['Resume Headline'] || 
                          candidateData['Resumen Headline'] ||
                          candidateData.resumeHeadline ||
                          candidateData.resume_headline;
    
    if (resumeHeadline) {
      masterData.job_process.events.push({
        type: 'resume_headline',
        value: resumeHeadline,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Process key skills
    const keySkills = candidateData['Key Skills'] || candidateData.keySkills || candidateData.key_skills;
    if (keySkills) {
      masterData.job_process.events.push({
        type: 'key_skills',
        value: keySkills,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Process industry
    const industry = candidateData['Industry'] || candidateData.industry;
    if (industry) {
      masterData.industry = industry;
      masterData.industries = [{
        name: industry,
        is_primary: true,
      }];
    }
    
    // Process preferred locations
    const preferredLocations = candidateData.preferredLocations || candidateData.preferred_locations;
    if (preferredLocations) {
      masterData.job_process.events.push({
        type: 'preferred_locations',
        value: preferredLocations,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Process profile image
    const profileImage = candidateData.profileImageUrl || candidateData.photo || candidateData.display_picture;
    if (profileImage) {
      masterData.job_process.events.push({
        type: 'profile_picture',
        value: profileImage,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Set application ID if available
    if (candidateData.applicationId || candidateData.application_id) {
      masterData.id = candidateData.applicationId || candidateData.application_id;
    }
    
    // Process call tracking params for URL generation
    if (candidateData.callTrackingParams?.jobId && candidateData.applicationId) {
      const hiringUrl = `https://hiring.naukri.com/hiring/${candidateData.callTrackingParams.jobId}/apply/${candidateData.applicationId}`;
      const resumeDownloadUrl = `https://hiring.naukri.com/cloudgateway-rm/rm-document-services/v0/download/applications/${candidateData.applicationId}?jobId=${candidateData.callTrackingParams.jobId}`;
      
      masterData.job_process.events.push({
        type: 'hiring_naukri_url',
        value: hiringUrl,
        timestamp: new Date().toISOString(),
      });
      
      masterData.job_process.events.push({
        type: 'resume_download_url',
        value: resumeDownloadUrl,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Process Q&A fields (Ans(...))
    Object.keys(candidateData).forEach(key => {
      if (key.startsWith('Ans(')) {
        masterData.job_process.events.push({
          type: key,
          value: candidateData[key],
          timestamp: new Date().toISOString(),
        });
      }
    });
    
    // Add other specific fields to job process events
    const additionalFields = [
      'candidateType',
      'sourceDetails',
      'appliedDate',
      'lastActive',
      'addedOn',
      'companyName',
      'Curr. Company name',
      'Current Location'
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
