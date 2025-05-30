import { ProcessCandidatesJobData } from 'twenty-shared';

import { ExtSockWhatsappWhitelistProcessingService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whitelist-processing';
import { CandidateService } from 'src/engine/core-modules/candidate-sourcing/services/candidate.service';
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
  ) {
    console.log('CandidateQueueProcessor initialized');
  }

  @Process(CandidateQueueProcessor.name)
  async handle(jobData: ProcessCandidatesJobData): Promise<void> {

    const batchInfo = jobData?.batchName?.includes('Batch')
      ? jobData.batchName.match(/Batch (\d+)\/(\d+)/)
      : null;

    console.log('batchInfo::', batchInfo);
    const batchNumber = batchInfo ? parseInt(batchInfo[1]) : 0;
    const totalBatches = batchInfo ? parseInt(batchInfo[2]) : '?';

    console.log(
      `Processing batch ${batchNumber}/${totalBatches} with ${jobData.data.length} candidates`,
    );

    try {
      console.log(
        'Reveived in CandidateQueueProcessor_batch process chunk ::',
        jobData.data.map((c) => c.unique_key_string),
      );
      await this.candidateService.processChunk(
        jobData.data,
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

      // Update whitelists after successful processing
      if (batchNumber === parseInt(totalBatches.toString())) {
        console.log('Processing final batch, updating whitelists...');
        try {
          const token = jobData.apiToken;
          const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(token);

          const users = await this.whitelistProcessingService.getUsersForWorkspace(workspaceId, token);
          
          for (const user of users) {
            try {
              const identifiers = await this.whitelistProcessingService.fetchCandidateIdentifiersForUser(
                user.id,
                token,
              );

              // Load whitelist
              await this.whitelistProcessingService.redisService.loadWhitelist(user.id, identifiers);

              // Create reverse mappings for all identifiers
              console.log(
                `Creating reverse mappings for ${identifiers.length} identifiers`,
              );
              for (const identifier of identifiers) {
                await this.whitelistProcessingService.redisService.createIdentifierToUserMapping(
                  identifier,
                  user.id,
                );
              }

              console.log(
                `Updated whitelist with ${identifiers.length} identifiers for user ${user.id}`,
              );
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
    } catch (error) {
      console.error(
        `Batch ${batchNumber}/${totalBatches} processing failed:`,
        error,
      );
      throw error;
    }
  }

  // @Process(CandidateQueueProcessor.name) // Use a specific name for this job type
  // async handle(jobCandidateData:ProcessCandidatesJobData): Promise<void> {
  //   console.log('CandidateQueueProcessor handling job. Processing. Number of candidates to be processed:', jobCandidateData.data.length);
  //   try {
  //     const { data, jobId, jobName, timestamp, apiToken, } = jobCandidateData;
  //     console.log('Processing candidate data. NUumber of profiles are:', data.length);
  //     const result = await this.candidateService.processProfilesWithRateLimiting(data, jobId, jobName, timestamp, apiToken);
  //     console.log('Candidates processing handled successfully:');
  //   } catch (error) {
  //     console.error('Candidate processing job failed:', error);
  //     throw error;
  //   }
  // }

  // @Process(CandidateQueueProcessor.name)
  // async handle(jobData: ProcessCandidatesJobData): Promise<void> {
  //   console.log('CandidateQueueProcessor handling job. Processing. Number of candidates to be processed:', jobData.data.length);

  //   try {
  //     // If the data batch is too large, process it in smaller chunks
  //     if (jobData.data.length > 10) {
  //       console.log(`Breaking large batch of ${jobData.data.length} candidates into smaller chunks`);
  //       await this.candidateService.processBatchedCandidates(jobData);
  //     } else {
  //       // For smaller batches, process normally
  //       console.log('Processing candidate data. Number of profiles are:', jobData.data.length);
  //       await this.candidateService.processProfilesWithRateLimiting(
  //         jobData.data, jobData.jobId, jobData.jobName, jobData.timestamp, jobData.apiToken
  //       );
  //     }

  //     console.log('Candidates processing handled successfully');
  //   } catch (error) {
  //     console.error('Candidate processing job failed:', error);
  //     throw error;
  //   }
  // }
}
