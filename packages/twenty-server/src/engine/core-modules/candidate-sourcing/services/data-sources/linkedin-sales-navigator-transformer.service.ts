import { Injectable } from '@nestjs/common';
import { UserProfile } from 'twenty-shared';
import { DataProcessingUtils } from '../../utils/data-processing.utils';
import { BaseDataSourceTransformerService, TransformationContext } from './base-data-source-transformer.service';

@Injectable()
export class LinkedinSalesNavigatorTransformerService extends BaseDataSourceTransformerService {
  constructor(dataProcessingUtils: DataProcessingUtils) {
    super(dataProcessingUtils);
  }

  getDataSourceIdentifier(): string {
    return 'linkedin_sales_navigator';
  }

  transformToUserProfile(
    candidateData: any,
    context: TransformationContext
  ): UserProfile {
    const userProfile = this.createBaseUserProfile(candidateData, context);
    
    // Use simplified base methods
    this.processNameData(candidateData, userProfile);
    this.processContactData(candidateData, userProfile);
    this.processLocationData(candidateData, userProfile);
    this.processSkillsData(candidateData, userProfile);
    this.processEducationData(candidateData, userProfile);
    this.processIndustryData(candidateData, userProfile);
    
    // Process LinkedIn Sales Navigator-specific data
    this.processSalesNavigatorProfileData(candidateData, userProfile);
    this.processSalesNavigatorExperienceData(candidateData, userProfile);
    this.processSalesNavigatorSpecificData(candidateData, userProfile);
    
    return userProfile;
  }

  private processSalesNavigatorProfileData(candidateData: any, userProfile: UserProfile): void {
    // Process LinkedIn profile URL - Sales Navigator uses different URL format
    let linkedinUrl = candidateData.public_linkedin_url || candidateData.linkedinUrl || '';
    
    // If we have entityUrn, extract the Sales Navigator lead ID
    if (!linkedinUrl && candidateData.entityUrn) {
      // Format: urn:li:fs_salesProfile:(ACwAABktyNIBoTQjoDJhoT0784oiXlq7u_Tofu4,NAME_SEARCH,8Dtl)
      const entityUrnParts = candidateData.entityUrn.split(':');
      if (entityUrnParts.length >= 4) {
        const leadId = entityUrnParts[3].split(',')[0].replace('(', '');
        if (leadId) {
          linkedinUrl = `https://www.linkedin.com/sales/lead/${leadId}`;
        }
      }
    }
    
    if (linkedinUrl) {
      userProfile.linkedinUrl = linkedinUrl;
      userProfile.profileUrl = linkedinUrl;
    }

    // Use utility method for job info
    this.setJobInfo(candidateData, userProfile);
  }

  private processSalesNavigatorExperienceData(candidateData: any, userProfile: UserProfile): void {
    const experience = candidateData.experience || candidateData.positions || candidateData.workExperience;
    
    if (experience && Array.isArray(experience)) {
      userProfile.experience = experience.map((exp, index) => {
        const company = exp.company || exp.companyName || exp.organization;
        
        return {
          company: {
            name: typeof company === 'object' ? company.name : company,
          },
          title: {
            name: exp.title || exp.position || exp.role || '',
          },
          startDate: exp.startDate || exp.start_date || null,
          endDate: exp.endDate || exp.end_date || null,
        };
      });
      
      // Calculate experience statistics
      this.calculateExperienceStats(userProfile);
      
      // Set current company information
      if (userProfile.experience.length > 0) {
        const currentJob = userProfile.experience[0];
        userProfile.jobCompanyName = currentJob.company.name;
      }
    }
  }

  private processSalesNavigatorSpecificData(candidateData: any, userProfile: UserProfile): void {
    // Set LinkedIn Sales Navigator-specific fields
    if (candidateData.summary || candidateData.about) {
      userProfile.linkedinSummary = candidateData.summary || candidateData.about;
    }
    
    // Process headline - specific to Sales Navigator data structure
    const headline = candidateData.profile_headline || candidateData.job_title || candidateData.headline;
    if (headline) {
      userProfile.linkedinHeadline = headline;
    }
    
    // Extract company from headline if it contains " at "
    // Extract company from headline if it contains ' at ' (lowercase) or ' AT ' (uppercase, used in all-caps headlines)
    if (typeof headline === 'string' && (headline.includes(' at ') || headline.includes(' AT '))) {
      let companyFromHeadline: string | undefined;
      if (headline.includes(' at ')) {
        companyFromHeadline = headline.split(' at ').pop();
      } else if (headline.includes(' AT ')) {
        companyFromHeadline = headline.split(' AT ').pop();
      }
      if (companyFromHeadline && !userProfile.jobCompanyName) {
        userProfile.jobCompanyName = companyFromHeadline.trim();
      }
    }
    
    // Process various Sales Navigator fields
    if (candidateData.full_name || candidateData.fullName || candidateData.name) {
      userProfile.fullName = candidateData.full_name || candidateData.fullName || candidateData.name;
    }
    
    if (candidateData.company_name || candidateData.companyName) {
      userProfile.jobCompanyName = candidateData.company_name || candidateData.companyName || '';
    }
    
    if (candidateData.profile_location || candidateData.location) {
      userProfile.locationName = candidateData.profile_location || candidateData.location || '';
    }
    
    if (candidateData.company_industry || candidateData.industry) {
      userProfile.industry = candidateData.company_industry || candidateData.industry || '';
    }
    
    // Process connection degree
    if (candidateData.connection_degree || candidateData.degree) {
      userProfile.linkedinConnections = candidateData.connection_degree || candidateData.degree;
    }
    
    // Process spotlight badges
    if (candidateData.spotlight_badges && Array.isArray(candidateData.spotlight_badges)) {
      userProfile.linkedinSpecificData = {
        ...userProfile.linkedinSpecificData,
        spotlightBadges: candidateData.spotlight_badges
      };
    }
    
    // Process premium status
    if (candidateData.premium !== undefined) {
      userProfile.linkedinSpecificData = {
        ...userProfile.linkedinSpecificData,
        premium: candidateData.premium
      };
    }
    
    // Process tracking information
    if (candidateData.tracking_id || candidateData.trackingId) {
      userProfile.linkedinSpecificData = {
        ...userProfile.linkedinSpecificData,
        trackingId: candidateData.tracking_id || candidateData.trackingId
      };
    }
    
    // Process URNs
    if (candidateData.object_urn || candidateData.objectUrn) {
      userProfile.linkedinSpecificData = {
        ...userProfile.linkedinSpecificData,
        objectUrn: candidateData.object_urn || candidateData.objectUrn
      };
    }
    
    if (candidateData.entity_urn || candidateData.entityUrn) {
      userProfile.linkedinSpecificData = {
        ...userProfile.linkedinSpecificData,
        entityUrn: candidateData.entity_urn || candidateData.entityUrn
      };
    }
    
    // Process creation particulars
    const creationData = {
      created: Date.now(),
      creation_source: 'linkedin_sales_navigator',
      data_sources: ['linkedin_sales_navigator'],
    };
    
    userProfile.creationParticulars = creationData;
    
    // Process social profiles - LinkedIn specific
    let linkedinUrl = candidateData?.public_linkedin_url || candidateData?.linkedinUrl || '';
    
    // If we have entityUrn, extract the Sales Navigator lead ID
    if (!linkedinUrl && candidateData.entityUrn) {
      // Format: urn:li:fs_salesProfile:(ACwAABktyNIBoTQjoDJhoT0784oiXlq7u_Tofu4,NAME_SEARCH,8Dtl)
      const entityUrnParts = candidateData.entityUrn.split(':');
      if (entityUrnParts.length >= 4) {
        const leadId = entityUrnParts[3].split(',')[0].replace('(', '');
        if (leadId) {
          linkedinUrl = `https://www.linkedin.com/sales/lead/${leadId}`;
        }
      }
    }
    
    if (linkedinUrl) {
      userProfile.linkedinUrl = linkedinUrl;
    }
    
    // Process certifications
    if (candidateData.certifications && Array.isArray(candidateData.certifications)) {
      const certifications = candidateData.certifications.map((cert, index) => ({
        name: cert.name || cert.title || null,
        organization: cert.organization || cert.authority || null,
        start_date: this.dataProcessingUtils.formatDate(cert.startDate || cert.issued),
        end_date: this.dataProcessingUtils.formatDate(cert.endDate || cert.expires),
        is_primary: index === 0,
      }));
      userProfile.certifications = certifications;
    }
    
    // Process languages
    if (candidateData.languages && Array.isArray(candidateData.languages)) {
      userProfile.languages = candidateData.languages;
    }
    
    // Set profile picture
    if (candidateData.profile_picture || candidateData.profilePicture || candidateData.photo) {
      userProfile.displayPicture = candidateData.profile_picture || candidateData.profilePicture || candidateData.photo;
    }
    
    // Handle job title variations from Sales Navigator
    const jobTitle = candidateData.job_title || candidateData.profile_headline || candidateData.headline;
    if (jobTitle && jobTitle !== candidateData.profile_headline) {
      userProfile.jobTitle = jobTitle;
    }
    
    // Process additional Sales Navigator specific fields
    const salesNavigatorSpecificFields = [
      'positions',
      'workExperience',
      'connectionCount',
      'followerCount',
      'spotlight_badges',
      'premium',
      'tracking_id',
      'object_urn',
      'entity_urn'
    ];
    
    const salesNavigatorSpecificData: Record<string, any> = {};
    salesNavigatorSpecificFields.forEach(field => {
      if (candidateData[field]) {
        salesNavigatorSpecificData[field] = candidateData[field];
      }
    });
    
    if (Object.keys(salesNavigatorSpecificData).length > 0) {
      userProfile.linkedinSpecificData = {
        ...userProfile.linkedinSpecificData,
        ...salesNavigatorSpecificData
      };
    }
  }
}
