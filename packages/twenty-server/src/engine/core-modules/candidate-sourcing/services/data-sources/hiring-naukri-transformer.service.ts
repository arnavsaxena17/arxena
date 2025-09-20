import { Injectable } from '@nestjs/common';
import { UserProfile } from 'twenty-shared';
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

  transformToUserProfile(
    candidateData: any,
    context: TransformationContext
  ): UserProfile {

    console.log("Transforming hiring naukri profile for candidate data:", candidateData);
    const userProfile = this.createBaseUserProfile(candidateData, context);
    
    // Use simplified base methods
    this.processNameData(candidateData, userProfile);
    this.processContactData(candidateData, userProfile);
    this.processSkillsData(candidateData, userProfile);
    this.processIndustryData(candidateData, userProfile);
    this.setJobInfo(candidateData, userProfile);
    this.processSalaryData(candidateData, userProfile);
    
    // Process hiring-specific data
    this.processHiringProfileData(candidateData, userProfile);
    this.processHiringLocationData(candidateData, userProfile);
    this.processHiringExperienceData(candidateData, userProfile);
    this.processHiringEducationData(candidateData, userProfile);
    this.processHiringSpecificData(candidateData, userProfile);
    
    return userProfile;
  }

  private processHiringProfileData(candidateData: any, userProfile: UserProfile): void {
    const profileUrl = candidateData.profile_url || candidateData.profileUrl;
    
    if (profileUrl) {
      userProfile.profileUrl = profileUrl;
    }

    // Set job name (the position they're applying for) from 'Job Title' field
    userProfile.jobName = candidateData['Job Title'] || candidateData.jobTitle || '';
    
    // Set job title (their current designation) from 'Curr. Company Designation' field
    userProfile.jobTitle = candidateData['Curr. Company Designation'] || 
                          candidateData.designation || 
                          candidateData.currentDesignation || 
                          '';
    userProfile.profileTitle = userProfile.jobTitle;
    
    // Set profile summary
    if (candidateData.profileSummary || candidateData.summary) {
      userProfile.profileTitle = candidateData.profileSummary || candidateData.summary;
    }
  }

  private processHiringLocationData(candidateData: any, userProfile: UserProfile): void {
    const currentCity = candidateData.currentCity || candidateData.current_city;
    const preferredLocations = candidateData.preferredLocations || candidateData.preferred_locations;
    const homeTown = candidateData['Home Town/City'] || candidateData.homeTown;
    
    if (currentCity) {
      userProfile.locationName = currentCity;
      userProfile.locations = [{
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
        userProfile.locations.push({
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

  private processHiringExperienceData(candidateData: any, userProfile: UserProfile): void {
    // Hiring Naukri provides work experience as structured data
    const workExp = candidateData.workExp || candidateData.work_experience || candidateData.experience;
    
    if (workExp && Array.isArray(workExp)) {
      userProfile.experience = workExp.map((exp, index) => {
        const startDate = this.dataProcessingUtils.formatDate(exp.workingFrom || exp.start_date);
        const endDate = this.dataProcessingUtils.formatDate(exp.workingTo || exp.end_date);
        
        return {
          company: {
            name: exp.company || exp.companyName || '',
          },
          title: {
            name: exp.designation || exp.title || exp.role || '',
          },
          startDate: startDate,
          endDate: endDate,
        };
      });
      
      // Calculate experience statistics
      this.calculateExperienceStats(userProfile);
    } else {
      // If structured experience is not available, try to extract from other fields
      const totalWorkExp = candidateData.workExp || candidateData.total_experience;
      if (totalWorkExp && typeof totalWorkExp === 'string') {
        const experienceMatch = totalWorkExp.match(/(\d+(?:\.\d+)?)/);
        if (experienceMatch) {
          userProfile.inferredYearsExperience = parseFloat(experienceMatch[1]);
        }
      }
    }
  }

  private processHiringEducationData(candidateData: any, userProfile: UserProfile): void {
    const education = candidateData.education || candidateData.educationDetails;
    
    if (education && Array.isArray(education)) {
      userProfile.education = education.map((edu, index) => ({
        institute: {
          name: edu.institute || edu.school || edu.university || edu.college || null,
          type: edu.type || null,
          location: null,
          profiles: [],
          website: null,
        },
        degrees: edu.degree || edu.course || edu.qualification || null,
        start_date: this.dataProcessingUtils.formatDate(edu.passingYear || edu.startYear),
        end_date: this.dataProcessingUtils.formatDate(edu.passingYear || edu.endYear),
        gpa: edu.percentage || edu.gpa || null,
        majors: [],
        minors: [],
        locations: null,
      }));
    }
  }

  private processHiringSpecificData(candidateData: any, userProfile: UserProfile): void {
    // Process phone numbers from hiring naukri specific structure
    // Only override if we have valid phone numbers from the array structure
    if (candidateData.phoneNumber && Array.isArray(candidateData.phoneNumber)) {
      const phoneNumbers = candidateData.phoneNumber
        .map((phone: any) => phone.value || phone.formattedNumber)
        .filter((phone: any) => phone && phone !== null);
      
      if (phoneNumbers.length > 0) {
        const cleanedPhones = this.dataProcessingUtils.cleanPhoneNumbers(phoneNumbers);
        if (cleanedPhones.length > 0) {
          userProfile.phoneNumbers = cleanedPhones;
          userProfile.phoneNumber = cleanedPhones[0] || '';
        }
      }
    }
    // Note: We don't need to process the string field here as it's already handled by processContactData
    
    // Process email from hiring naukri specific structure
    // Only override if we have valid emails from the specific field
    if (candidateData.email && candidateData.email !== null) {
      const cleanedEmails = this.dataProcessingUtils.cleanEmailAddresses(candidateData.email);
      if (cleanedEmails.length > 0) {
        userProfile.emailAddresses = cleanedEmails;
        userProfile.emailAddress = cleanedEmails[0] || '';

      }
    }
    // Note: We don't need to process the 'Email ID' field here as it's already handled by processContactData
    
    // Process salary information
    const annualSalary = candidateData['Annual Salary'] || 
                        candidateData.annual_salary || 
                        candidateData.currentSalary ||
                        candidateData.salary ||
                        candidateData.ctc?.lacs;
    
    if (annualSalary) {
      const salaryNumber = this.dataProcessingUtils.extractSalaryNumber(annualSalary);
      userProfile.inferredSalary = salaryNumber;
    }
    
    // Process experience from multiple fields
    const totalExperience = candidateData['Total Experience'] || 
                           candidateData.experience?.years ||
                           candidateData.total_experience;
    
    if (totalExperience) {
      userProfile.inferredYearsExperience = parseFloat(totalExperience.toString());
    }
    
    // Process notice period
    const noticePeriod = candidateData.noticePeriod || 
                        candidateData['Notice period/ Availability to join'] ||
                        candidateData.notice_period;
    
    if (noticePeriod) {
      userProfile.noticePeriod = noticePeriod;
    }
    
    // Process marital status
    const maritalStatus = candidateData['Marital Status'] || candidateData.maritalStatus;
    if (maritalStatus) {
      userProfile.maritalStatus = maritalStatus;
    }
    
    // Process birth date and age
    const birthDate = candidateData['Date of Birth'] || candidateData.birth_date;
    if (birthDate) {
      userProfile.birthDate = this.dataProcessingUtils.formatDate(birthDate);
    }
    
    // Process gender
    const gender = candidateData['Gender'] || candidateData.gender;
    if (gender) {
      userProfile.gender = gender;
    }
    
    // Process home town
    const homeTown = candidateData['Home Town/City'] || candidateData.homeTown;
    if (homeTown) {
      userProfile.homeTown = homeTown;
    }
    
    // Process education details
    const ugUniversity = candidateData['UG University/institute Name'] || candidateData.ug_institute_name;
    const ugGraduationYear = candidateData['UG Graduation year'] || candidateData.ug_graduation_year;
    const ugDegree = candidateData['Under Graduation degree'] || candidateData.ug_graduation_degree;
    const pgUniversity = candidateData['PG university/institute name'] || candidateData.pg_institute_name;
    const pgGraduationYear = candidateData['PG Graduation year'] || candidateData.pg_graduation_year;
    const pgDegree = candidateData['Post graduation degree'] || candidateData.pg_graduation_degree;
    
    if (ugUniversity) {
      userProfile.educationInstituteUg = ugUniversity;
    }
    
    if (ugDegree) {
      userProfile.educationCourseUg = ugDegree;
    }
    
    // Process resume headline
    const resumeHeadline = candidateData['Resume Headline'] || 
                          candidateData['Resumen Headline'] ||
                          candidateData.resumeHeadline ||
                          candidateData.resume_headline;
    
    if (resumeHeadline) {
      userProfile.resumeHeadline = resumeHeadline;
    }
    
    // Process key skills
    const keySkills = candidateData['Key Skills'] || candidateData.keySkills || candidateData.key_skills;
    if (keySkills) {
      userProfile.keySkills = keySkills;
    }
    
    // Process industry
    const industry = candidateData['Industry'] || candidateData.industry;
    if (industry) {
      userProfile.industry = industry;
      userProfile.industries = [{
        name: industry,
        is_primary: true,
      }];
    }
    
    // Process preferred locations
    const preferredLocations = candidateData.preferredLocations || candidateData.preferred_locations;
    if (preferredLocations) {
      userProfile.preferredLocations = preferredLocations;
    }
    
    // Process profile image
    const profileImage = candidateData.profileImageUrl || candidateData.photo || candidateData.display_picture;
    if (profileImage) {
      userProfile.displayPicture = profileImage;
    }
    
    // Set application ID if available
    if (candidateData.applicationId || candidateData.application_id) {
      userProfile.id = candidateData.applicationId || candidateData.application_id;
    }
    
    // Process call tracking params for URL generation
    if (candidateData.callTrackingParams?.jobId && candidateData.applicationId) {
      const hiringUrl = `https://hiring.naukri.com/hiring/${candidateData.callTrackingParams.jobId}/apply/${candidateData.applicationId}`;
      const resumeDownloadUrl = `https://hiring.naukri.com/cloudgateway-rm/rm-document-services/v0/download/applications/${candidateData.applicationId}?jobId=${candidateData.callTrackingParams.jobId}`;
      
      userProfile.hiringNaukriUrl = { primaryLinkLabel: 'Hiring Naukri', primaryLinkUrl: hiringUrl };
      userProfile.resumeDownloadUrl = resumeDownloadUrl;
    }
    
    // Process Q&A fields (Ans(...))
    const qaFields: Record<string, any> = {};
    Object.keys(candidateData).forEach(key => {
      if (key.startsWith('Ans(')) {
        qaFields[key] = candidateData[key];
      }
    });
    if (Object.keys(qaFields).length > 0) {
      userProfile.qaFields = qaFields;
    }
    
    // Add other specific fields
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
    
    const additionalData: Record<string, any> = {};
    additionalFields.forEach(field => {
      if (candidateData[field]) {
        additionalData[field] = candidateData[field];
      }
    });
    if (Object.keys(additionalData).length > 0) {
      userProfile.additionalData = additionalData;
    }
  }
}
