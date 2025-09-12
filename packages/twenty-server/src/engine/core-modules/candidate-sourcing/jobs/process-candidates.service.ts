// import { ProcessCandidatesJob } from '../jobs/process-candidates.job';
import { ProcessCandidatesJobData, UserProfile } from 'twenty-shared';

import { QueueCronJobOptions } from 'src/engine/core-modules/message-queue/drivers/interfaces/job-options.interface';

import { CandidateQueueProcessor } from 'src/engine/core-modules/candidate-sourcing/jobs/process-candidates.job';
import { CandidateService } from 'src/engine/core-modules/candidate-sourcing/services/candidate.service';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { DataSourceTransformerFactoryService } from '../services/data-source-transformer-factory.service';
import { MasterDataFormat } from '../types/master-data.types';

export class ProcessCandidatesService {
  constructor(
    @InjectMessageQueue(MessageQueue.candidateQueue)
    private readonly messageQueueService: MessageQueueService,
    private readonly candidateService: CandidateService,
    private readonly dataSourceTransformerFactory: DataSourceTransformerFactoryService,
  ) {}

  /**
   * Transform raw candidate data to master format and send for processing
   */
  async transformAndSend(
    rawCandidatesData: any[],
    dataSource: string,
    jobId: string,
    jobName: string,
    userId: string,
    timestamp: string,
    apiToken: string,
  ): Promise<void> {
    try {
      console.log(`Starting data transformation for ${rawCandidatesData.length} candidates from source: ${dataSource}`);
      
      // Check if data source is supported
      if (!this.dataSourceTransformerFactory.isDataSourceSupported(dataSource)) {
        throw new Error(`Unsupported data source: ${dataSource}`);
      }

      // Transform candidates to master format
      const transformationContext = {
        jobId,
        jobName,
        userId,
        timestamp,
      };

      const transformedCandidates = await this.dataSourceTransformerFactory.transformCandidatesBatch(
        rawCandidatesData,
        dataSource,
        transformationContext
      );

      console.log(`Successfully transformed ${transformedCandidates.length} candidates from ${rawCandidatesData.length} raw records`);

      // Convert master format to UserProfile format for existing pipeline
      const userProfiles = this.convertMasterDataToUserProfiles(transformedCandidates);

      // Send to existing processing pipeline
      await this.send(userProfiles, jobId, jobName, timestamp, apiToken);

    } catch (error) {
      console.error('Error in transformAndSend:', error);
      throw error;
    }
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

  /**
   * Check if a data source is supported for transformation
   */
  isDataSourceSupported(dataSource: string): boolean {
    return this.dataSourceTransformerFactory.isDataSourceSupported(dataSource);
  }

  /**
   * Get supported data sources
   */
  getSupportedDataSources(): string[] {
    return this.dataSourceTransformerFactory.getSupportedDataSources();
  }

  async send(
    data: UserProfile[],
    jobId: string,
    jobName: string,
    timestamp: string,
    apiToken: string,
  ): Promise<void> {
    try {
      console.log(`Queueing ${data.length} candidates for processing`);
      const batchSize = 30;
      const uniqueKeyToProfileMap = new Map<string, UserProfile>();
      data.forEach((candidate) => {
        if (
          candidate &&
          candidate.unique_key_string &&
          candidate.unique_key_string !== ''
        ) {
          uniqueKeyToProfileMap.set(candidate.unique_key_string, candidate);
        }
      });
      const deduplicatedProfiles = Array.from(uniqueKeyToProfileMap.values());
      const uniqueCandidates = new Set();
      for (const candidate of data) {
        uniqueCandidates.add(candidate.unique_key_string);
      }
      console.log(`Found ${uniqueCandidates.size} unique candidates`);

      console.log(
        `Deduplicated ${data.length} candidates to ${deduplicatedProfiles.length} unique profiles`,
      );

      const totalBatches = Math.ceil(deduplicatedProfiles.length / batchSize);

      console.log(
        `Breaking up ${deduplicatedProfiles.length} candidates into ${totalBatches} batches of ~${batchSize} each`,
      );

      for (let i = 0; i < deduplicatedProfiles.length; i += batchSize) {
        const batch = deduplicatedProfiles.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;

        console.log(
          `Queueing batch ${batchNumber}/${totalBatches} with ${batch.length} candidates`,
        );
        const queueJobOptions: QueueCronJobOptions = {
          retryLimit: 3,
          priority: 1,
          repeat: { every: 1000 },
        };
        const batchName = `Batch ${batchNumber}/${totalBatches}`;
        console.log('This isthe processor batch name', batchName);
        console.log(
          'Batch number : ',
          batchNumber,
          'has ',
          batch.length,
          'candidates',
          'with unique keys of : ',
          batch.map((c) => c.unique_key_string),
        );
        const jobData: ProcessCandidatesJobData = {
          data: batch,
          jobId,
          jobName,
          batchName: batchName,
          timestamp,
          apiToken,
        };
        await this.messageQueueService.add<ProcessCandidatesJobData>(
          CandidateQueueProcessor.name,
          jobData,
          queueJobOptions,
        );
      }
      
      console.log(`Successfully queued ${totalBatches} batches of candidates`);
    } catch (error) {
      console.log('Failed to queue candidate processing:', error);
      throw error;
    }
  }
}
