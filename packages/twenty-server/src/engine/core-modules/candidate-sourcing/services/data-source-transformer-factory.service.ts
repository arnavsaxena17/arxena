import { Injectable } from '@nestjs/common';
import { UserProfile } from 'twenty-shared';
import { MasterDataFormat } from '../types/master-data.types';
import { ApnaDatabaseTransformerService } from './data-sources/apna-database-transformer.service';
import { BaseDataSourceTransformerService, TransformationContext } from './data-sources/base-data-source-transformer.service';
import { HiringNaukriTransformerService } from './data-sources/hiring-naukri-transformer.service';
import { LinkedinPremiumJobsTransformerService } from './data-sources/linkedin-premium-jobs-transformer.service';
import { LinkedinPremiumTransformerService } from './data-sources/linkedin-premium-transformer.service';
import { LinkedinRecruiterJobsTransformerService } from './data-sources/linkedin-recruiter-jobs-transformer.service';
import { NaukriProfileDataTransformerService } from './data-sources/naukri-profile-data-transformer.service';
import { ResdexNaukriTransformerService } from './data-sources/resdex-naukri-transformer.service';
import { RmsNaukriTransformerService } from './data-sources/rms-naukri-transformer.service';
import { SpreadsheetImportTwentyTransformerService } from './data-sources/spreadsheet-import-twenty-transformer.service';
import { UploadedProfilesTransformerService } from './data-sources/uploaded-profiles-transformer.service';

export enum DataSourceType {
  HIRING_NAUKRI = 'hiring_naukri',
  RMS_NAUKRI = 'rms_naukri',
  RESDEX_NAUKRI = 'resdex_naukri',
  APNA_DATABASE = 'apna_database',
  LINKEDIN_PREMIUM = 'linkedin_premium',
  LINKEDIN_PREMIUM_JOBS = 'linkedin_premium_jobs',
  LINKEDIN_RECRUITER_JOBS = 'linkedin_recruiter_jobs',
  LINKEDIN_RECRUITER_LITE = 'linkedin_recruiter_lite',
  PROFILE_DATA_NAUKRI = 'profile_data_naukri',
  SPREADSHEET_IMPORT_TWENTY = 'spreadsheet_import_twenty',
  DATA_UPLOAD = 'data_upload',
  LINKEDIN_SALES_NAVIGATOR = 'linkedin_sales_navigator',
}

@Injectable()
export class DataSourceTransformerFactoryService {
  private transformers = new Map<DataSourceType, BaseDataSourceTransformerService>();

  constructor(
    private readonly resdexNaukriTransformer: ResdexNaukriTransformerService,
    private readonly hiringNaukriTransformer: HiringNaukriTransformerService,
    private readonly linkedinPremiumTransformer: LinkedinPremiumTransformerService,
    private readonly spreadsheetImportTwentyTransformer: SpreadsheetImportTwentyTransformerService,
    private readonly rmsNaukriTransformer: RmsNaukriTransformerService,
    private readonly apnaDatabaseTransformer: ApnaDatabaseTransformerService,
    private readonly naukriProfileDataTransformer: NaukriProfileDataTransformerService,
    private readonly uploadedProfilesTransformer: UploadedProfilesTransformerService,
    private readonly linkedinRecruiterJobsTransformer: LinkedinRecruiterJobsTransformerService,
    private readonly linkedinPremiumJobsTransformer: LinkedinPremiumJobsTransformerService,
  ) {
    this.initializeTransformers();
  }

  private initializeTransformers(): void {
    // Primary transformers
    this.transformers.set(DataSourceType.RESDEX_NAUKRI, this.resdexNaukriTransformer);
    this.transformers.set(DataSourceType.HIRING_NAUKRI, this.hiringNaukriTransformer);
    this.transformers.set(DataSourceType.LINKEDIN_PREMIUM, this.linkedinPremiumTransformer);
    this.transformers.set(DataSourceType.SPREADSHEET_IMPORT_TWENTY, this.spreadsheetImportTwentyTransformer);
    this.transformers.set(DataSourceType.RMS_NAUKRI, this.rmsNaukriTransformer);
    this.transformers.set(DataSourceType.APNA_DATABASE, this.apnaDatabaseTransformer);
    this.transformers.set(DataSourceType.PROFILE_DATA_NAUKRI, this.naukriProfileDataTransformer);
    this.transformers.set(DataSourceType.DATA_UPLOAD, this.uploadedProfilesTransformer);
    this.transformers.set(DataSourceType.LINKEDIN_RECRUITER_JOBS, this.linkedinRecruiterJobsTransformer);
    this.transformers.set(DataSourceType.LINKEDIN_PREMIUM_JOBS, this.linkedinPremiumJobsTransformer);
    
    // Use existing transformers for related data sources
    this.transformers.set(DataSourceType.LINKEDIN_RECRUITER_LITE, this.linkedinRecruiterJobsTransformer);
    this.transformers.set(DataSourceType.LINKEDIN_SALES_NAVIGATOR, this.linkedinPremiumTransformer);
  }

  /**
   * Get the appropriate transformer for a data source
   */
  getTransformer(dataSource: string): BaseDataSourceTransformerService | null {
    const dataSourceType = this.mapStringToDataSourceType(dataSource);
    return dataSourceType ? this.transformers.get(dataSourceType) || null : null;
  }

  /**
   * Transform candidate data using the appropriate transformer
   */
  async transformCandidateData(
    candidateData: any,
    dataSource: string,
    context: Omit<TransformationContext, 'dataSource'>
  ): Promise<MasterDataFormat | null> {
    const transformer = this.getTransformer(dataSource);
    
    if (!transformer) {
      console.warn(`No transformer found for data source: ${dataSource}`);
      return null;
    }

    try {
      const transformationContext: TransformationContext = {
        ...context,
        dataSource,
      };

      return transformer.transformToMasterFormat(candidateData, transformationContext);
    } catch (error) {
      console.error(`Error transforming candidate data for source ${dataSource}:`, error);
      return null;
    }
  }

  /**
   * Transform multiple candidates from the same data source and convert to UserProfile format
   */
  async transformCandidatesBatch(
    candidatesData: any[],
    dataSource: string,
    context: Omit<TransformationContext, 'dataSource'>
  ): Promise<UserProfile[]> {
    const transformer = this.getTransformer(dataSource);
    
    if (!transformer) {
      console.warn(`No transformer found for data source: ${dataSource}`);
      return [];
    }

    const transformationContext: TransformationContext = {
      ...context,
      dataSource,
    };

    const transformedCandidates: MasterDataFormat[] = [];

    for (const candidateData of candidatesData) {
      try {
        const transformed = transformer.transformToMasterFormat(candidateData, transformationContext);
        if (transformed) {
          transformedCandidates.push(transformed);
        }
      } catch (error) {
        console.error(`Error transforming candidate data for source ${dataSource}:`, error);
        // Continue with other candidates even if one fails
      }
    }

    // Convert MasterDataFormat to UserProfile format
    return this.convertMasterDataToUserProfiles(transformedCandidates);
  }

  /**
   * Get all supported data sources
   */
  getSupportedDataSources(): string[] {
    return Array.from(this.transformers.keys()).map(key => key.toString());
  }

  /**
   * Check if a data source is supported
   */
  isDataSourceSupported(dataSource: string): boolean {
    return this.getTransformer(dataSource) !== null;
  }

  /**
   * Map string data source to enum type
   */
  private mapStringToDataSourceType(dataSource: string): DataSourceType | null {
    const normalizedSource = dataSource.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    const mappings: Record<string, DataSourceType> = {
      'hiring_naukri': DataSourceType.HIRING_NAUKRI,
      'rms_naukri': DataSourceType.RMS_NAUKRI,
      'resdex_naukri': DataSourceType.RESDEX_NAUKRI,
      'apna_database': DataSourceType.APNA_DATABASE,
      'linkedin_premium': DataSourceType.LINKEDIN_PREMIUM,
      'linkedin_premium_jobs': DataSourceType.LINKEDIN_PREMIUM_JOBS,
      'linkedin_recruiter_jobs': DataSourceType.LINKEDIN_RECRUITER_JOBS,
      'linkedin_recruiter_lite': DataSourceType.LINKEDIN_RECRUITER_LITE,
      'profile_data_naukri': DataSourceType.PROFILE_DATA_NAUKRI,
      'spreadsheet_import_twenty': DataSourceType.SPREADSHEET_IMPORT_TWENTY,
      'data_upload': DataSourceType.DATA_UPLOAD,
      'linkedin_sales_navigator': DataSourceType.LINKEDIN_SALES_NAVIGATOR,
    };

    return mappings[normalizedSource] || null;
  }

  /**
   * Get transformer by data source type enum
   */
  getTransformerByType(dataSourceType: DataSourceType): BaseDataSourceTransformerService | null {
    return this.transformers.get(dataSourceType) || null;
  }

  /**
   * Register a new transformer for a data source
   */
  registerTransformer(dataSourceType: DataSourceType, transformer: BaseDataSourceTransformerService): void {
    this.transformers.set(dataSourceType, transformer);
  }

  /**
   * Get statistics about available transformers
   */
  getTransformerStats(): {
    totalTransformers: number;
    supportedDataSources: string[];
    uniqueTransformers: number;
  } {
    return {
      totalTransformers: this.transformers.size,
      supportedDataSources: this.getSupportedDataSources(),
      uniqueTransformers: new Set(Array.from(this.transformers.values())).size,
    };
  }

  /**
   * Convert MasterDataFormat to UserProfile format for compatibility with existing pipeline
   */
  private convertMasterDataToUserProfiles(masterDataArray: MasterDataFormat[]): UserProfile[] {
    return masterDataArray.map(masterData => {
      const primaryEducation = masterData.education[0];
      const profilePicture = masterData.job_process.events.find(e => e.type === 'profile_picture')?.value || '';
      
      return {
        // Required fields from UserProfile interface
        education_course_pg: primaryEducation?.degrees?.join(', ') || '',
        education_institute_ug: primaryEducation?.school?.name || '',
        education_course_ug: primaryEducation?.degrees?.join(', ') || '',
        key_skills: masterData.skills.map(skill => skill.name).join(', '),
        notice_period: masterData.job_process.events.find(e => e.type === 'notice_period')?.value || '',
        
        // Name structure
        names: {
          firstName: masterData.first_name || '',
          lastName: masterData.last_name || '',
        },
        
        // Basic profile information
        id: masterData.id,
        first_name: masterData.first_name || '',
        last_name: masterData.last_name || '',
        middle_name: masterData.middle_name,
        middle_initial: masterData.middle_initial,
        full_name: masterData.full_name || '',
        unique_key_string: masterData.unique_key_string,
        
        // Company and job information
        job_company_name: masterData.job_company_name || '',
        job_company_id: masterData.job_company_id,
        job_company_linkedin_url: masterData.job_company_linkedin_url,
        job_company_website: masterData.job_company_website,
        job_title: masterData.job_title || '',
        profile_title: masterData.profile_title || '',
        
        // Location information
        location_name: masterData.location_name || '',
        location_region: masterData.location_region,
        location_locality: masterData.location_locality,
        location_metro: masterData.location_metro,
        location_country: masterData.location_country,
        country: masterData.country,
        
        // Social profiles
        linkedin_url: masterData.linkedin_url || '',
        facebook_url: masterData.facebook_url,
        twitter_url: masterData.twitter_url,
        profile_url: masterData.profile_url || '',
        
        // Experience and salary
        inferred_salary: masterData.inferred_salary?.toString() || null,
        inferred_years_experience: masterData.inferred_years_experience?.toString() || null,
        industry: masterData.industry,
        
        // Personal information
        birth_date_fuzzy: masterData.birth_date_fuzzy,
        birth_date: masterData.birth_date,
        gender: masterData.gender,
        
        // Contact information
        email_address: masterData.email_address,
        emails: masterData.emails,
        phone_numbers: masterData.phone_numbers,
        phone_number: masterData.phone_numbers[0] || '',
        
        // Profile structures
        industries: masterData.industries,
        profiles: masterData.profiles.map(profile => ({
          title: profile.title || '',
          network: profile.network || '',
          username: profile.username || '',
          is_primary: profile.is_primary || false,
          url: profile.url || '',
          names: {
            first_name: masterData.first_name || '',
            last_name: masterData.last_name || '',
          },
          linkedin_url: profile.network === 'linkedin' ? profile.url : '',
          profile_title: profile.title || '',
        })),
        locations: masterData.locations,
        experience: masterData.experience,
        experience_stats: masterData.experience_stats,
        education: masterData.education,
        
        // Job process
        job_process: {
          applications: masterData.job_process.applications,
        },
        
        // Additional fields
        interests: masterData.interests.map(interest => interest.name).filter(Boolean),
        skills: masterData.skills.map(skill => skill.name).join(', '),
        
        // Metadata
        last_seen: {
          source: masterData.data_source,
          timestamp: new Date().toISOString(),
        },
        last_updated: masterData.last_updated || new Date().toISOString(),
        std_last_updated: null,
        created: Date.now(),
        creation_source: masterData.data_source,
        data_sources: masterData.data_sources,
        data_source: masterData.data_source,
        job_name: masterData.job_name || '',
        queryId: [],
        upload_count: 0,
        upload_id: masterData.upload_id || '',
        tables: masterData.tables,
        
        // Social profiles structure
        socialprofiles: {
          linkedin: masterData.linkedin_url || '',
        },
        
        // Standardization fields
        std_function: masterData.std_function || '',
        std_grade: masterData.std_grade || '',
        std_function_root: masterData.std_function_root || '',
        
        // Additional properties (UserProfile allows [x: string]: any)
        display_picture: profilePicture,
        campaign: masterData.data_source,
        source: masterData.data_source,
        _masterData: masterData,
      } as unknown as UserProfile;
    });
  }
}
