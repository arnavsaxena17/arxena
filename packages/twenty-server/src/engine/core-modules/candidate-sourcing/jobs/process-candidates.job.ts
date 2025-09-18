import { ProcessCandidatesJobData } from 'twenty-shared';

import { ExtSockWhatsappWhitelistProcessingService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whitelist-processing';
import { CandidateService } from 'src/engine/core-modules/candidate-sourcing/services/candidate.service';
import { DataSourceTransformerFactoryService } from 'src/engine/core-modules/candidate-sourcing/services/data-source-transformer-factory.service';
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
        candidatesToProcess.map((c) => c.unique_key_string),
      );
      
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

      // Update whitelists after successful processing
      if (batchNumber === parseInt(totalBatches.toString())) {
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
              await this.whitelistProcessingService.redisService.loadWhitelist(user.id, identifiers);
              for (const identifier of identifiers) {
                await this.whitelistProcessingService.redisService.createIdentifierToUserMapping(
                  identifier,
                  user.id,
                );
              }
              console.log( `Updated whitelist with ${identifiers.length} identifiers for user ${user.id}`, );
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

}
