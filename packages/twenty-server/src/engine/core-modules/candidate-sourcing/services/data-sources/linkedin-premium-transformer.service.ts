import { Injectable } from '@nestjs/common';
import { MasterDataFormat } from '../../types/master-data.types';
import { DataProcessingUtils } from '../../utils/data-processing.utils';
import { BaseDataSourceTransformerService, TransformationContext } from './base-data-source-transformer.service';

@Injectable()
export class LinkedinPremiumTransformerService extends BaseDataSourceTransformerService {
  constructor(dataProcessingUtils: DataProcessingUtils) {
    super(dataProcessingUtils);
  }

  getDataSourceIdentifier(): string {
    return 'linkedin_premium';
  }

  transformToMasterFormat(
    candidateData: any,
    context: TransformationContext
  ): MasterDataFormat {
    const masterData = this.createBaseMasterData(candidateData, context);
    
    // Use simplified base methods
    this.processNameData(candidateData, masterData);
    this.processContactData(candidateData, masterData);
    this.processLocationData(candidateData, masterData);
    this.processSkillsData(candidateData, masterData);
    this.processEducationData(candidateData, masterData);
    this.processIndustryData(candidateData, masterData);
    
    // Process LinkedIn-specific data
    this.processLinkedInProfileData(candidateData, masterData);
    this.processLinkedInExperienceData(candidateData, masterData);
    this.processLinkedInSpecificData(candidateData, masterData);
    
    return masterData;
  }

  private processLinkedInProfileData(candidateData: any, masterData: MasterDataFormat): void {
    const linkedinUrl = candidateData.linkedin_url || candidateData.linkedinUrl || candidateData.profile_url;
    
    if (linkedinUrl) {
      masterData.linkedin_url = linkedinUrl;
      masterData.profile_url = linkedinUrl;
      masterData.profiles = [{
        title: candidateData.headline || candidateData.jobTitle || candidateData.title || null,
        network: 'linkedin',
        connections: candidateData.connections || candidateData.connectionCount || null,
        username: this.extractLinkedInUsername(linkedinUrl),
        is_primary: true,
        url: linkedinUrl,
      }];
    }

    // Use utility method for job info
    this.setJobInfo(candidateData, masterData);
  }

  private processLinkedInExperienceData(candidateData: any, masterData: MasterDataFormat): void {
    const experience = candidateData.experience || candidateData.positions || candidateData.workExperience;
    
    if (experience && Array.isArray(experience)) {
      masterData.experience = experience.map((exp, index) => {
        const company = exp.company || exp.companyName || exp.organization;
        const companyLinkedInUrl = exp.companyLinkedInUrl || exp.company_linkedin_url;
        
        return {
          company: {
            name: typeof company === 'object' ? company.name : company,
            size: typeof company === 'object' ? company.size : null,
            founded: null,
            industry: typeof company === 'object' ? company.industry : null,
            linkedin_url: companyLinkedInUrl || null,
            linkedin_id: null,
            facebook_url: null,
            twitter_url: null,
            website: typeof company === 'object' ? company.website : null,
            ticker: null,
            type: null,
            raw: [],
            fuzzy_match: null,
            is_primary: index === 0,
          },
          locations: exp.location ? [{
            name: exp.location,
            locality: null,
            region: null,
            subregion: null,
            country: null,
            continent: null,
            type: 'work',
            geo: null,
            postal_code: null,
            zip_plus_4: null,
            street_address: null,
            address_line_2: null,
            most_recent: index === 0,
            is_primary: index === 0,
            last_updated: new Date().toISOString(),
          }] : [],
          title: {
            name: exp.title || exp.position || exp.role || null,
            raw: exp.title || exp.position || exp.role || null,
            role: exp.title || exp.position || exp.role || null,
            sub_role: null,
            levels: [],
          },
          start_date: this.dataProcessingUtils.formatDate(exp.startDate || exp.start_date),
          end_date: this.dataProcessingUtils.formatDate(exp.endDate || exp.end_date),
          summary: exp.description || exp.summary || null,
          is_primary: index === 0,
        };
      });
      
      // Calculate experience statistics
      this.calculateExperienceStats(masterData);
      
      // Set current company information
      if (masterData.experience.length > 0) {
        const currentJob = masterData.experience[0];
        masterData.job_company_name = currentJob.company.name;
        masterData.job_company_linkedin_url = currentJob.company.linkedin_url;
        masterData.job_company_website = currentJob.company.website;
      }
    }
  }

  private processLinkedInSpecificData(candidateData: any, masterData: MasterDataFormat): void {
    // Use utility method for LinkedIn events
    this.addJobProcessEvent(masterData, 'linkedin_summary', candidateData.summary || candidateData.about);
    this.addJobProcessEvent(masterData, 'linkedin_connections', candidateData.connections || candidateData.connectionCount);
    this.addJobProcessEvent(masterData, 'linkedin_recommendations', candidateData.recommendations);
    this.addJobProcessEvent(masterData, 'linkedin_followers', candidateData.followers || candidateData.followerCount);
    this.addJobProcessEvent(masterData, 'last_activity', candidateData.lastActivity || candidateData.last_activity);
    
    // Process headline - specific to LinkedIn data structure
    const headline = candidateData.headline || candidateData.job_title;
    this.addJobProcessEvent(masterData, 'linkedin_headline', headline);
    
    // Extract company from headline if it contains " at "
    if (headline?.includes(' at ')) {
      const companyFromHeadline = headline.split(' at ').pop();
      if (companyFromHeadline && !masterData.job_company_name) {
        masterData.job_company_name = companyFromHeadline.trim();
      }
    }
    
    // Process various LinkedIn fields using utility method
    this.addJobProcessEvent(masterData, 'linkedin_full_name', candidateData.fullName || candidateData.name);
    this.addJobProcessEvent(masterData, 'linkedin_company_name', candidateData.company_name);
    this.addJobProcessEvent(masterData, 'linkedin_phone_number', candidateData['Phone Number'] || candidateData.phone_number);
    this.addJobProcessEvent(masterData, 'linkedin_email_id', candidateData['Email ID'] || candidateData.email_address);
    
    // Process creation particulars
    const creationData = {
      created: Date.now(),
      creation_source: 'linkedin_premium',
      data_sources: ['linkedin_premium'],
    };
    
    masterData.job_process.events.push({
      type: 'creation_particulars',
      value: creationData,
      timestamp: new Date().toISOString(),
    });
    
    // Process social profiles - LinkedIn specific
    if (candidateData.linkedin_url) {
      masterData.job_process.events.push({
        type: 'linkedin_social_profile',
        value: candidateData.linkedin_url,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Process certifications
    if (candidateData.certifications && Array.isArray(candidateData.certifications)) {
      masterData.certifications = candidateData.certifications.map((cert, index) => ({
        name: cert.name || cert.title || null,
        organization: cert.organization || cert.authority || null,
        start_date: this.dataProcessingUtils.formatDate(cert.startDate || cert.issued),
        end_date: this.dataProcessingUtils.formatDate(cert.endDate || cert.expires),
        is_primary: index === 0,
      }));
    }
    
    // Process languages
    if (candidateData.languages && Array.isArray(candidateData.languages)) {
      masterData.job_process.events.push({
        type: 'languages',
        value: candidateData.languages,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Set profile picture
    if (candidateData.profilePicture || candidateData.profile_picture || candidateData.photo) {
      masterData.job_process.events.push({
        type: 'profile_picture',
        value: candidateData.profilePicture || candidateData.profile_picture || candidateData.photo,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Handle job title variations from LinkedIn Premium
    const jobTitle = candidateData.job_title || candidateData.headline;
    if (jobTitle && jobTitle !== candidateData.headline) {
      masterData.job_process.events.push({
        type: 'linkedin_job_title',
        value: jobTitle,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Process additional LinkedIn Premium specific fields
    const linkedinSpecificFields = [
      'positions',
      'workExperience',
      'connectionCount',
      'followerCount',
    ];
    
    linkedinSpecificFields.forEach(field => {
      if (candidateData[field]) {
        masterData.job_process.events.push({
          type: field,
          value: candidateData[field],
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  private extractLinkedInUsername(linkedinUrl: string): string | null {
    if (!linkedinUrl) return null;
    
    try {
      const url = new URL(linkedinUrl);
      const pathParts = url.pathname.split('/').filter(part => part.length > 0);
      
      // LinkedIn URLs typically follow /in/username format
      const inIndex = pathParts.indexOf('in');
      if (inIndex !== -1 && pathParts.length > inIndex + 1) {
        return pathParts[inIndex + 1];
      }
      
      return pathParts[pathParts.length - 1] || null;
    } catch (error) {
      return null;
    }
  }
}
