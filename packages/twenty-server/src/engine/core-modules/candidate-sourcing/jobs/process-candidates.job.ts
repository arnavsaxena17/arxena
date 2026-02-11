import { Inject, forwardRef } from '@nestjs/common';
import { ProcessCandidatesJobData } from 'twenty-shared';

import { UpdateChat } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import { ExtSockWhatsappWhitelistProcessingService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whitelist-processing';
import { CandidateService } from 'src/engine/core-modules/candidate-sourcing/services/candidate.service';
import { DataSourceTransformerFactoryService } from 'src/engine/core-modules/candidate-sourcing/services/data-source-transformer-factory.service';
import { UploadProgressPubSubService } from 'src/engine/core-modules/candidate-sourcing/services/upload-progress-pubsub.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

@Processor(MessageQueue.candidateQueue)
export class CandidateQueueProcessor {
  constructor(
    @Inject(forwardRef(() => CandidateService))
    private readonly candidateService: CandidateService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly whitelistProcessingService: ExtSockWhatsappWhitelistProcessingService,
    private readonly dataSourceTransformerFactory: DataSourceTransformerFactoryService,
    private readonly uploadProgressPubSubService: UploadProgressPubSubService,
  ) {
    console.log('CandidateQueueProcessor initialized');
  }
  
  @Process(CandidateQueueProcessor.name)
  async handle(jobData: ProcessCandidatesJobData): Promise<void> {

    const batchInfo = jobData?.batchName?.includes('Batch')
      ? jobData.batchName.match(/Batch (\d+)\/(\d+)/)
      : null;

    const batchNumber = batchInfo ? parseInt(batchInfo[1], 10) : 0;
    const totalBatches = batchInfo ? parseInt(batchInfo[2], 10) : 1;

    // Determine initial candidate count (from rawData if available, otherwise from data)
    const initialCandidateCount = jobData.rawData?.length || jobData.data.length;

    console.log(
      `Processing batch ${batchNumber}/${totalBatches} with ${initialCandidateCount} candidates (raw: ${jobData.rawData?.length || 0}, processed: ${jobData.data.length})`,
    );

    // Add job processing validation to prevent duplicate processing
    const jobKey = `${jobData.jobId}-${jobData.dataSource || 'processed'}-batch-${batchNumber}`;
    console.log(`Processing job with key: ${jobKey}`);

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
          const actualBatchSize = candidatesToProcess.length;
          const progress = Math.round((batchNumber / totalBatches) * 100);
          
          // Calculate processed candidates: sum of previous batches + current batch
          // For now, we estimate based on batch number and current batch size
          // This is approximate since we don't know exact sizes of previous batches
          const estimatedProcessedCandidates = (batchNumber - 1) * actualBatchSize + actualBatchSize;
          const estimatedTotalCandidates = totalBatches * actualBatchSize;
          
          await this.uploadProgressPubSubService.publishUploadProcessing(
            jobData.userId,
            progress,
            batchNumber,
            totalBatches,
            estimatedProcessedCandidates,
            estimatedTotalCandidates
          );
        } catch (progressError) {
          console.warn('Failed to publish upload progress:', progressError.message);
        }
      }
      
      console.log(`Candidate queue - API token length: ${jobData.apiToken?.length}`);
      console.log(`Candidate queue - API token preview: ${jobData.apiToken?.substring(0, 50)}...`);

      const createdCandidateIds = await this.candidateService.processChunk(
        candidatesToProcess,
        jobData.jobId,
        jobData.jobName,
        jobData.timestamp,
        jobData.origin,
        jobData.apiToken,
        batchNumber,
        totalBatches as any,
      );
      console.log(
        `✅ Successfully processed batch ${batchNumber}/${totalBatches} with ${candidatesToProcess.length} candidates`,
      );

      const isLastBatch = batchNumber === totalBatches;
      const queueStartChatAfter = (jobData as any).queueStartChatAfter as boolean | undefined;
      if (
        isLastBatch &&
        queueStartChatAfter === true &&
        createdCandidateIds.length > 0 &&
        jobData.apiToken
      ) {
        try {
          const updateChat = UpdateChat.create(
            this.workspaceQueryService,
            this.staticGraphQLService,
          );
          for (const candidateId of createdCandidateIds) {
            await updateChat.createInterimChatQueue(
              'startChat',
              candidateId,
              jobData.apiToken,
            );
          }
          console.log(
            `Queued start chat for ${createdCandidateIds.length} candidate(s) after add-to-job`,
          );
        } catch (chatError) {
          console.error(
            'Error queuing start chat for candidates after add-to-job:',
            chatError,
          );
        }
      }

      // Publish completion notification if this is the last batch
      if (batchNumber === totalBatches && jobData.userId) {
        try {
          // Use actual candidate count from this batch to estimate total
          // This is approximate since earlier batches might have different sizes
          const actualBatchSize = candidatesToProcess.length;
          const estimatedTotalCandidates = totalBatches * actualBatchSize;
          await this.uploadProgressPubSubService.publishUploadCompleted(
            jobData.userId,
            estimatedTotalCandidates,
            totalBatches
          );
        } catch (progressError) {
          console.warn('Failed to publish upload completion:', progressError.message);
        }
      }

      // Update whitelists after successful processing
      if (batchNumber === totalBatches) {
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

  // private async updateWhitelistsAfterProcessing(apiToken: string): Promise<void> {
  //   try {
  //     const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
  //     const users = await this.whitelistProcessingService.getUsersForWorkspace(workspaceId, apiToken);
      
  //     for (const user of users) {
  //       try {
  //         const identifiers = await this.whitelistProcessingService.fetchCandidateIdentifiersForUser(
  //           user.id,
  //           apiToken,
  //         );
  //         await this.whitelistProcessingService.redisService.loadWhitelist(user.id, identifiers);
          
  //         for (const identifier of identifiers) {
  //           await this.whitelistProcessingService.redisService.createIdentifierToUserMapping(
  //             identifier,
  //             user.id,
  //           );
  //         }
          
  //         console.log(`Updated whitelist with ${identifiers.length} identifiers for user ${user.id}`);
  //       } catch (userError) {
  //         console.error(
  //           `Error updating whitelist for user ${user.id}:`,
  //           userError,
  //         );
  //       }
  //     }
  //   } catch (error) {
  //     console.error('Failed to update whitelists after candidate processing:', error);
  //   }
  // }

}
