import { ProcessCandidatesJobData } from 'twenty-shared';

import { ExtSockWhatsappWhitelistProcessingService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whitelist-processing';
import { CandidateService } from 'src/engine/core-modules/candidate-sourcing/services/candidate.service';
import { DataSourceTransformerFactoryService } from 'src/engine/core-modules/candidate-sourcing/services/data-source-transformer-factory.service';
import { UploadProgressPubSubService } from 'src/engine/core-modules/candidate-sourcing/services/upload-progress-pubsub.service';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

@Processor(MessageQueue.candidateQueue)
export class CandidateQueueProcessor {
  constructor(
    private readonly candidateService: CandidateService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly whitelistProcessingService: ExtSockWhatsappWhitelistProcessingService,
    private readonly dataSourceTransformerFactory: DataSourceTransformerFactoryService,
    private readonly uploadProgressPubSubService: UploadProgressPubSubService,
  ) { console.log('CandidateQueueProcessor initialized'); }
  
  @Process(CandidateQueueProcessor.name)
  async handle(jobData: ProcessCandidatesJobData): Promise<void> {

    const batchInfo = jobData?.batchName?.includes('Batch')
      ? jobData.batchName.match(/Batch (\d+)\/(\d+)/)
      : null;

    const batchNumber = batchInfo ? parseInt(batchInfo[1]) : 0;
    const totalBatches = batchInfo ? parseInt(batchInfo[2]) : '?';

    console.log(
      `Processing batch ${batchNumber}/${totalBatches} with ${jobData.data.length} candidates`,
    );

    try {
      let candidatesToProcess = jobData.data;

      // If raw data is provided, transform it first
      if (jobData.rawData && jobData.rawData.length > 0 && jobData.dataSource) {
        console.log(`Transforming ${jobData.rawData.length} raw candidates from source: ${jobData.dataSource}`);
        
        // Check if data source is supported
        if (!this.dataSourceTransformerFactory.isDataSourceSupported(jobData.dataSource)) {
          throw new Error(`Unsupported data source: ${jobData.dataSource}`);
        }

        // Transform candidates to master format
        const transformationContext = {
          jobId: jobData.jobId,
          jobName: jobData.jobName,
          userId: jobData.userId || '',
          timestamp: jobData.timestamp,
        };

        candidatesToProcess = await this.dataSourceTransformerFactory.transformCandidatesBatch(
          jobData.rawData,
          jobData.dataSource,
          transformationContext
        );

        console.log(`Successfully transformed ${candidatesToProcess.length} candidates from ${jobData.rawData.length} raw records`);
      }

      console.log(
        'Received in CandidateQueueProcessor_batch process chunk ::',
        candidatesToProcess.map((c) => c.uniqueStringKey),
      );
      
      // Publish progress update before processing
      if (jobData.userId) {
        try {
          const progress = Math.round((batchNumber / parseInt(totalBatches.toString())) * 100);
          const processedCandidates = (batchNumber - 1) * 30; // Approximate based on batch size
          const totalCandidates = parseInt(totalBatches.toString()) * 30; // Approximate total
          
          await this.uploadProgressPubSubService.publishUploadProcessing(
            jobData.userId,
            progress,
            batchNumber,
            parseInt(totalBatches.toString()),
            processedCandidates,
            totalCandidates
          );
        } catch (progressError) {
          console.warn('Failed to publish upload progress:', progressError.message);
        }
      }
      
      console.log(`Candidate queue - API token length: ${jobData.apiToken?.length}`);
      console.log(`Candidate queue - API token preview: ${jobData.apiToken?.substring(0, 50)}...`);
      
      await this.candidateService.processChunk(
        candidatesToProcess,
        jobData.jobId,
        jobData.jobName,
        jobData.timestamp,
        jobData.apiToken,
        batchNumber,
        totalBatches,
      );
      console.log(
        `Successfully processed batch ${batchNumber}/${totalBatches}`,
      );

      // Publish completion notification if this is the last batch
      if (batchNumber === parseInt(totalBatches.toString()) && jobData.userId) {
        try {
          const totalCandidates = parseInt(totalBatches.toString()) * 30; // Approximate total
          await this.uploadProgressPubSubService.publishUploadCompleted(
            jobData.userId,
            totalCandidates,
            parseInt(totalBatches.toString())
          );
        } catch (progressError) {
          console.warn('Failed to publish upload completion:', progressError.message);
        }
      }

      // Update whitelists after successful processing
      if (batchNumber === parseInt(totalBatches.toString())) {
        console.log('Not updating whitelists after processing');
        // await this.updateWhitelistsAfterProcessing(jobData.apiToken);
      }
    } catch (error) {
      console.error(
        `Batch ${batchNumber}/${totalBatches} processing failed:`,
        error,
      );
      
      // Publish error notification
      if (jobData.userId) {
        try {
          await this.uploadProgressPubSubService.publishUploadError(
            jobData.userId,
            error.message || 'Unknown error occurred'
          );
        } catch (progressError) {
          console.warn('Failed to publish upload error:', progressError.message);
        }
      }
      
      throw error;
    }
  }

  private async updateWhitelistsAfterProcessing(apiToken: string): Promise<void> {
    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const users = await this.whitelistProcessingService.getUsersForWorkspace(workspaceId, apiToken);
      
      for (const user of users) {
        try {
          const identifiers = await this.whitelistProcessingService.fetchCandidateIdentifiersForUser(
            user.id,
            apiToken,
          );
          await this.whitelistProcessingService.redisService.loadWhitelist(user.id, identifiers);
          
          for (const identifier of identifiers) {
            await this.whitelistProcessingService.redisService.createIdentifierToUserMapping(
              identifier,
              user.id,
            );
          }
          
          console.log(`Updated whitelist with ${identifiers.length} identifiers for user ${user.id}`);
        } catch (userError) {
          console.error(
            `Error updating whitelist for user ${user.id}:`,
            userError,
          );
        }
      }
    } catch (error) {
      console.error('Failed to update whitelists after candidate processing:', error);
    }
  }

}
