// import { ProcessCandidatesJob } from '../jobs/process-candidates.job';
import { ProcessCandidatesJobData, UserProfile } from 'twenty-shared';
import { v4 } from 'uuid';

import { QueueCronJobOptions } from 'src/engine/core-modules/message-queue/drivers/interfaces/job-options.interface';

import { CandidateQueueProcessor } from 'src/engine/core-modules/candidate-sourcing/jobs/process-candidates.job';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { DataSourceTransformerFactoryService } from '../services/data-source-transformer-factory.service';
import { DataProcessingUtils } from '../utils/data-processing.utils';
import {
  deduplicateLooseUploadRows,
  deduplicateProfilesForUpload,
} from '../utils/upload-profile-dedup.utils';

export class ProcessCandidatesService {
  constructor(
    @InjectMessageQueue(MessageQueue.candidateQueue)
    private readonly messageQueueService: MessageQueueService,
    private readonly dataSourceTransformerFactory: DataSourceTransformerFactoryService,
    private readonly dataProcessingUtils: DataProcessingUtils,
  ) {}

  /**
   * Queue raw candidate data for transformation and processing
   */
  async queueRawDataForProcessing(
    rawCandidatesData: any[],
    dataSource: string,
    jobId: string,
    jobName: string,
    userId: string,
    timestamp: string,
    origin: string,
    apiToken: string,
    uploadSessionId?: string,
    options?: { queueStartChatAfter?: boolean },
  ): Promise<void> {
    try {
      console.log(`Queueing ${rawCandidatesData.length} raw candidates from source: ${dataSource} for processing`);
      
      // Check if data source is supported
      if (!this.dataSourceTransformerFactory.isDataSourceSupported(dataSource)) {
        throw new Error(`Unsupported data source: ${dataSource}`);
      }

      // Queue raw data for processing (transformation will happen in the queue processor)
      await this.queueRawData(
        rawCandidatesData,
        dataSource,
        jobId,
        jobName,
        userId,
        timestamp,
        origin,
        apiToken,
        uploadSessionId,
        options,
      );
    } catch (error) {
      console.error('Error in queueRawDataForProcessing:', error);
      throw error;
    }
  }

  /**
   * Transform raw candidate data to master format and send for processing
   * @deprecated Use queueRawDataForProcessing instead
   */
  async transformAndSend(
    rawCandidatesData: any[],
    dataSource: string,
    jobId: string,
    jobName: string,
    userId: string,
    timestamp: string,
    origin: string,
    apiToken: string,
  ): Promise<void> {
    try {
      console.log(`Starting data transformation for ${rawCandidatesData.length} candidates from source: ${dataSource}`);
      
      // Check if data source is supported
      if (!this.dataSourceTransformerFactory.isDataSourceSupported(dataSource)) {
        throw new Error(`Unsupported data source: ${dataSource}`);
      }
      const transformationContext = {
        jobId,
        jobName,
        userId,
        timestamp,
      };
      const userProfiles = await this.dataSourceTransformerFactory.transformCandidatesBatch(
        rawCandidatesData,
        dataSource,
        transformationContext
      );

      console.log(`Successfully transformed ${userProfiles.length} candidates from ${rawCandidatesData.length} raw records`);
      console.log("User profiles in transformAndSend:", userProfiles);
      // Send to existing processing pipeline
      await this.send(userProfiles, jobId, jobName, timestamp, apiToken, origin, userId);

    } catch (error) {
      console.error('Error in transformAndSend:', error);
      throw error;
    }
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

  /**
   * Queue raw data for processing without transformation
   */
  private async queueRawData(
    rawCandidatesData: any[],
    dataSource: string,
    jobId: string,
    jobName: string,
    userId: string,
    timestamp: string,
    origin: string,
    apiToken: string,
    uploadSessionId?: string,
    options?: { queueStartChatAfter?: boolean },
  ): Promise<void> {
    try {
      console.log(`Queueing ${rawCandidatesData.length} raw candidates for processing`);
      const batchSize = 30;

      const rawRows = rawCandidatesData.filter(Boolean) as Record<string, unknown>[];
      if (rawRows.length > 0) {
        const sample = rawRows[0];
        console.log(
          '[queueRawData] sample raw row keys (first 40):',
          Object.keys(sample).slice(0, 40),
        );
      }
      const deduplicatedRawData = deduplicateLooseUploadRows(
        rawRows,
        this.dataProcessingUtils,
      );
      console.log(
        `Deduplicated ${rawCandidatesData.length} raw candidates to ${deduplicatedRawData.length} unique records (keys: phone/email/url/usk/id, spreadsheet columns, or raw_row:index if no identity)`,
      );

      const totalBatches = Math.ceil(deduplicatedRawData.length / batchSize);
      console.log(`Breaking up ${deduplicatedRawData.length} raw candidates into ${totalBatches} batches of ~${batchSize} each`);

      for (let i = 0; i < deduplicatedRawData.length; i += batchSize) {
        const batch = deduplicatedRawData.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;

        console.log(`Queueing raw data batch ${batchNumber}/${totalBatches} with ${batch.length} candidates`);
        
        const queueJobOptions: QueueCronJobOptions = {
          retryLimit: 3,
          priority: 1,
          repeat: { every: 1000 },
        };
        
        const batchName = `Raw Data Batch ${batchNumber}/${totalBatches}`;
        console.log('Raw data batch name:', batchName);
        console.log('Raw data batch number:', batchNumber, 'has', batch.length, 'candidates');
        
        const sessionId = uploadSessionId || v4();
        const jobData: ProcessCandidatesJobData = {
          data: [], // Empty for raw data processing
          rawData: batch,
          dataSource: dataSource,
          jobId,
          jobName,
          batchName: batchName,
          timestamp,
          origin,
          apiToken,
          userId,
          uploadSessionId: sessionId,
          queueStartChatAfter: options?.queueStartChatAfter,
        };
        
        // Create unique job ID to prevent duplicate processing
        // Use uploadSessionId (UUID) to make each upload request truly unique
        // This ensures multiple upload requests for the same job don't get skipped as duplicates
        const uniqueJobId = `${jobId}-${dataSource}-batch-${batchNumber}-${sessionId}`;
        
        try {
          await this.messageQueueService.add<ProcessCandidatesJobData>(
            CandidateQueueProcessor.name,
            jobData,
            {
              ...queueJobOptions,
              id: uniqueJobId, // Add unique ID to prevent duplicates
            },
          );
          console.log(`✅ Successfully queued batch ${batchNumber}/${totalBatches} with job ID: ${uniqueJobId}`);
        } catch (queueError) {
          // Check if error is due to duplicate job ID
          if (queueError.message?.includes('already') || queueError.message?.includes('duplicate')) {
            console.log(`Job with ID ${uniqueJobId} is already queued or running, skipping duplicate`);
            // Don't throw - just skip this batch as it's already being processed
            continue;
          }
          console.error(`❌ Failed to queue batch ${batchNumber}/${totalBatches} with job ID: ${uniqueJobId}`, queueError);
          throw queueError; // Re-throw to stop processing if queueing fails
        }
      }
      
      console.log(`✅ Successfully queued all ${totalBatches} batches of raw candidates`);
    } catch (error) {
      console.log('Failed to queue raw candidate processing:', error);
      throw error;
    }
  }

  async send(
    data: UserProfile[],
    jobId: string,
    jobName: string,
    timestamp: string,
    apiToken: string,
    userId?: string,
    origin?: string,
  ): Promise<void> {
    try {
      console.log(`Queueing ${data.length} candidates for processing`);
      const batchSize = 30;
      const deduplicatedProfiles = deduplicateProfilesForUpload(
        data,
        this.dataProcessingUtils,
      );
      const uniqueCandidates = new Set();
      for (const candidate of data) {
        uniqueCandidates.add(candidate.uniqueStringKey);
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
          batch.map((c) => c.uniqueStringKey),
        );
        const jobData: ProcessCandidatesJobData = {
          data: batch,
          jobId,
          jobName,
          batchName: batchName,
          timestamp,
          apiToken,
          userId,
          origin: origin || '',
        };
        
        // Create unique job ID to prevent duplicate processing
        // Include timestamp hash to make each upload session unique
        const timestampHash = Buffer.from(timestamp).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
        const uniqueJobId = `${jobId}-batch-${batchNumber}-${timestampHash}`;
        
        try {
          await this.messageQueueService.add<ProcessCandidatesJobData>(
            CandidateQueueProcessor.name,
            jobData,
            {
              ...queueJobOptions,
              id: uniqueJobId, // Add unique ID to prevent duplicates
            },
          );
          console.log(`✅ Successfully queued batch ${batchNumber}/${totalBatches} with job ID: ${uniqueJobId}`);
        } catch (queueError) {
          // Check if error is due to duplicate job ID
          if (queueError.message?.includes('already') || queueError.message?.includes('duplicate')) {
            console.log(`Job with ID ${uniqueJobId} is already queued or running, skipping duplicate`);
            // Don't throw - just skip this batch as it's already being processed
            continue;
          }
          console.error(`❌ Failed to queue batch ${batchNumber}/${totalBatches} with job ID: ${uniqueJobId}`, queueError);
          throw queueError; // Re-throw to stop processing if queueing fails
        }
      }
      
      console.log(`✅ Successfully queued all ${totalBatches} batches of candidates`);
    } catch (error) {
      console.log('Failed to queue candidate processing:', error);
      throw error;
    }
  }
}
