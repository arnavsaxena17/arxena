import { Injectable } from '@nestjs/common';
import { UserProfile } from 'twenty-shared';
import { ApnaDatabaseTransformerService } from './data-sources/apna-database-transformer.service';
import { BaseDataSourceTransformerService, TransformationContext } from './data-sources/base-data-source-transformer.service';
import { HiringNaukriTransformerService } from './data-sources/hiring-naukri-transformer.service';
import { LinkedinPremiumJobsTransformerService } from './data-sources/linkedin-premium-jobs-transformer.service';
import { LinkedinPremiumTransformerService } from './data-sources/linkedin-premium-transformer.service';
import { LinkedinRecruiterJobsTransformerService } from './data-sources/linkedin-recruiter-jobs-transformer.service';
import { LinkedinSalesNavigatorTransformerService } from './data-sources/linkedin-sales-navigator-transformer.service';
import { LinkedInSearchTransformerService } from './data-sources/linkedin-search-transformer.service';
import { LinkedinXrayTransformerService } from './data-sources/linkedin-xray-transformer.service';
import { NaukriProfileDataTransformerService } from './data-sources/naukri-profile-data-transformer.service';
import { ParsedCVTransformerService } from './data-sources/parsed-cv-transformer.service';
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
  LINKEDIN_SEARCH = 'linkedin_search',
  LINKEDIN_XRAY = 'linkedin_xray',
  PARSED_CV = 'parsed_cv',
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
    private readonly linkedinSalesNavigatorTransformer: LinkedinSalesNavigatorTransformerService,
    private readonly linkedinSearchTransformer: LinkedInSearchTransformerService,
    private readonly linkedinXrayTransformer: LinkedinXrayTransformerService,
    private readonly parsedCVTransformer: ParsedCVTransformerService,
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
    this.transformers.set(DataSourceType.LINKEDIN_SALES_NAVIGATOR, this.linkedinSalesNavigatorTransformer);
    this.transformers.set(DataSourceType.LINKEDIN_SEARCH, this.linkedinSearchTransformer);
    this.transformers.set(DataSourceType.LINKEDIN_XRAY, this.linkedinXrayTransformer);
    this.transformers.set(DataSourceType.PARSED_CV, this.parsedCVTransformer);
    
    // Use existing transformers for related data sources
    this.transformers.set(DataSourceType.LINKEDIN_RECRUITER_LITE, this.linkedinRecruiterJobsTransformer);
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
  ): Promise<UserProfile | null> {
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
      console.log("Candidate data before transformation:", candidateData);
      const transformed = transformer.transformToUserProfile(candidateData, transformationContext);
      console.log("Candidate data after transformation:", transformed);
      return transformed;
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

    const transformedCandidates: UserProfile[] = [];

    for (const candidateData of candidatesData) {
      try {
        const transformed = transformer.transformToUserProfile(candidateData, transformationContext);
        if (transformed) {
          transformedCandidates.push(transformed);
        }
      } catch (error) {
        console.error(`Error transforming candidate data batch for source ${dataSource}:`, error);
        // Continue with other candidates even if one fails
      }
    }

    return transformedCandidates;
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
      'linkedin_search': DataSourceType.LINKEDIN_SEARCH,
      'linkedin_xray': DataSourceType.LINKEDIN_XRAY,
      'parsed_cv': DataSourceType.PARSED_CV,
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

}
