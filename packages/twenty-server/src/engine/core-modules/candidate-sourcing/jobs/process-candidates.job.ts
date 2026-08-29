import { Inject, forwardRef } from '@nestjs/common';
import { ProcessCandidatesJobData } from 'twenty-shared';

import { UpdateChat } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import { ExtSockWhatsappWhitelistProcessingService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whitelist-processing';
import { CandidateService } from 'src/engine/core-modules/candidate-sourcing/services/candidate.service';
import { DataSourceTransformerFactoryService } from 'src/engine/core-modules/candidate-sourcing/services/data-source-transformer-factory.service';
import { UploadProgressPubSubService } from 'src/engine/core-modules/candidate-sourcing/services/upload-progress-pubsub.service';
import { UploadProfilesWorkflowResumeService } from 'src/engine/core-modules/outreach-command/services/upload-profiles-workflow-resume.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { type MessageQueueJobContext } from 'src/engine/core-modules/message-queue/interfaces/message-queue-job.interface';
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
    @Inject(forwardRef(() => UploadProfilesWorkflowResumeService))
    private readonly uploadProfilesWorkflowResumeService: UploadProfilesWorkflowResumeService,
  ) {
    console.log('CandidateQueueProcessor initialized');
  }

  @Process(CandidateQueueProcessor.name)
  async handle(
    jobData: ProcessCandidatesJobData,
    context?: MessageQueueJobContext,
  ): Promise<void> {
    const batchInfo = jobData?.batchName?.includes('Batch')
      ? jobData.batchName.match(/Batch (\d+)\/(\d+)/)
      : null;

    const batchNumber = batchInfo ? parseInt(batchInfo[1], 10) : 0;
    const totalBatchesFromName = batchInfo ? parseInt(batchInfo[2], 10) : 1;
    const totalBatches = jobData.totalBatches ?? totalBatchesFromName;
    const projectId =
      jobData.projectId ??
      (jobData as ProcessCandidatesJobData & { jobId?: string }).jobId;
    const jobName = jobData.jobName;
    const workflowCorrelation = this.getWorkflowCorrelation(
      jobData,
      projectId,
      totalBatches,
    );

    const initialCandidateCount =
      jobData.rawData?.length || jobData.data.length;

    console.log(
      `Processing batch ${batchNumber}/${totalBatches} with ${initialCandidateCount} candidates (raw: ${jobData.rawData?.length || 0}, processed: ${jobData.data.length})`,
    );

    const jobKey = `${projectId}-${jobData.dataSource || 'processed'}-batch-${batchNumber}`;
    console.log(`Processing job with key: ${jobKey}`);

    try {
      let candidatesToProcess = jobData.data;

      if (jobData.rawData && jobData.rawData.length > 0 && jobData.dataSource) {
        console.log(
          `Transforming ${jobData.rawData.length} raw candidates from source: ${jobData.dataSource}`,
        );

        if (
          !this.dataSourceTransformerFactory.isDataSourceSupported(
            jobData.dataSource,
          )
        ) {
          throw new Error(`Unsupported data source: ${jobData.dataSource}`);
        }

        const transformationContext = {
          projectId,
          jobName,
          userId: jobData.userId || '',
          timestamp: jobData.timestamp,
        };

        candidatesToProcess =
          await this.dataSourceTransformerFactory.transformCandidatesBatch(
            jobData.rawData,
            jobData.dataSource,
            transformationContext,
          );

        console.log(
          `Successfully transformed ${candidatesToProcess.length} candidates from ${jobData.rawData.length} raw records`,
        );
      }

      console.log(
        'Received in CandidateQueueProcessor_batch process chunk ::',
        candidatesToProcess.map((c) => c.uniqueStringKey),
      );

      if (jobData.userId) {
        try {
          const actualBatchSize = candidatesToProcess.length;
          const progress = Math.round((batchNumber / totalBatches) * 100);
          const estimatedProcessedCandidates =
            (batchNumber - 1) * actualBatchSize + actualBatchSize;
          const estimatedTotalCandidates = totalBatches * actualBatchSize;

          await this.uploadProgressPubSubService.publishUploadProcessing(
            jobData.userId,
            progress,
            batchNumber,
            totalBatches,
            estimatedProcessedCandidates,
            estimatedTotalCandidates,
          );
        } catch (progressError) {
          console.warn(
            'Failed to publish upload progress:',
            progressError.message,
          );
        }
      }

      console.log(
        `Candidate queue - API token length: ${jobData.apiToken?.length}`,
      );
      console.log(
        `Candidate queue - API token preview: ${jobData.apiToken?.substring(0, 50)}...`,
      );

      const createdCandidateIds = await this.candidateService.processChunk(
        candidatesToProcess,
        projectId,
        jobName,
        jobData.timestamp,
        jobData.origin,
        jobData.apiToken,
        batchNumber,
        totalBatches as any,
      );
      console.log(
        `✅ Successfully processed batch ${batchNumber}/${totalBatches} with ${candidatesToProcess.length} candidates`,
      );

      if (workflowCorrelation) {
        await this.uploadProfilesWorkflowResumeService.recordBatchSuccess({
          correlation: workflowCorrelation,
          candidateIds: createdCandidateIds ?? [],
          batchNumber: batchNumber || 1,
        });
      }

      const isLastBatch = batchNumber === totalBatches;
      const queueStartChatAfter = (jobData as any).queueStartChatAfter as
        | boolean
        | undefined;
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

      if (batchNumber === totalBatches && jobData.userId) {
        try {
          const actualBatchSize = candidatesToProcess.length;
          const estimatedTotalCandidates = totalBatches * actualBatchSize;
          await this.uploadProgressPubSubService.publishUploadCompleted(
            jobData.userId,
            estimatedTotalCandidates,
            totalBatches,
          );
        } catch (progressError) {
          console.warn(
            'Failed to publish upload completion:',
            progressError.message,
          );
        }
      }

      if (batchNumber === totalBatches) {
        console.log('Not updating whitelists after processing');
      }
    } catch (error) {
      console.error(
        `Batch ${batchNumber}/${totalBatches} processing failed:`,
        error,
      );

      if (workflowCorrelation) {
        const attemptsMade = context?.attemptsMade ?? 0;
        const attempts = context?.attempts ?? 1;
        const isTerminalAttempt = attemptsMade + 1 >= attempts;

        await this.uploadProfilesWorkflowResumeService.recordBatchFailure({
          correlation: workflowCorrelation,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error occurred',
          isTerminalAttempt,
        });
      }

      if (jobData.userId) {
        try {
          await this.uploadProgressPubSubService.publishUploadError(
            jobData.userId,
            error.message || 'Unknown error occurred',
          );
        } catch (progressError) {
          console.warn(
            'Failed to publish upload error:',
            progressError.message,
          );
        }
      }

      throw error;
    }
  }

  private getWorkflowCorrelation(
    jobData: ProcessCandidatesJobData,
    projectId: string,
    totalBatches: number,
  ) {
    if (
      !jobData.workflowRunId ||
      !jobData.workflowStepId ||
      !jobData.workspaceId ||
      !jobData.uploadSessionId
    ) {
      return null;
    }

    return {
      workflowRunId: jobData.workflowRunId,
      workflowStepId: jobData.workflowStepId,
      workspaceId: jobData.workspaceId,
      projectId,
      uploadSessionId: jobData.uploadSessionId,
      totalBatches: Math.max(totalBatches, 1),
    };
  }
}
