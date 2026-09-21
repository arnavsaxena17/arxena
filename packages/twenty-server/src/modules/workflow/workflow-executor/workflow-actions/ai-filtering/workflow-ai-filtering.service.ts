import { Injectable, Logger } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';
import { v4 } from 'uuid';

import {
  type AiFilterConfig,
  type AiFilterField,
  type CandidateData,
  AiFilteringProcessorService,
} from 'src/engine/core-modules/candidate-sourcing/services/ai-filtering-processor.service';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { type WorkflowAiFilteringResult } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/types/workflow-ai-filtering-result.type';
import { type WorkflowAiFilteringActionInput } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/types/workflow-ai-filtering-action-input.type';
import { AiFilteringWorkflowResumeService } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/ai-filtering-workflow-resume.service';
import { type ProcessWorkflowAiFilteringJobData } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/types/process-workflow-ai-filtering-job-data.type';

export type { WorkflowAiFilteringResult };

const PROCESS_WORKFLOW_AI_FILTERING_JOB_NAME = 'ProcessWorkflowAiFilteringJob';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const normalizeCandidates = (input: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(input)) {
    const single = asRecord(input);

    return single ? [single] : [];
  }

  return input.map((entry) => asRecord(entry)).filter(isDefined);
};

const resolveOpenAiApiKey = (): string =>
  process.env.OPENAI_API_KEY?.trim() ||
  process.env.OPENAI_KEY?.trim() ||
  'sk-workflow-ai-filtering-placeholder';

@Injectable()
export class WorkflowAiFilteringService {
  private readonly logger = new Logger(WorkflowAiFilteringService.name);

  constructor(
    private readonly aiFilteringProcessorService: AiFilteringProcessorService,
    private readonly aiFilteringWorkflowResumeService: AiFilteringWorkflowResumeService,
    @InjectMessageQueue(MessageQueue.aiFilteringQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {}

  async enqueue({
    workspaceId,
    workflowRunId,
    workflowStepId,
    input,
  }: {
    workspaceId: string;
    workflowRunId: string;
    workflowStepId: string;
    input: WorkflowAiFilteringActionInput;
  }): Promise<{
    pending: true;
    queued: number;
    total: number;
    sessionId: string;
  }> {
    const candidates = normalizeCandidates(input.candidates);

    if (candidates.length === 0) {
      throw new Error(
        'Pass candidates (array of people or candidate records).',
      );
    }

    if (!input.prompt?.trim()) {
      throw new Error('Pass a prompt with the filter criteria.');
    }

    if (!input.fields || input.fields.length === 0) {
      throw new Error('Define at least one structured output field.');
    }

    const sessionId = v4();
    const jobData: ProcessWorkflowAiFilteringJobData = {
      workspaceId,
      workflowRunId,
      workflowStepId,
      sessionId,
      candidates,
      filter: {
        name: input.name || 'AiFiltering',
        prompt: input.prompt,
        selectedModel: input.selectedModel || 'typesafe-ai/jev',
        selectedMetadataFields: input.selectedMetadataFields || [],
        includeResume: input.includeResume === true,
        fields: input.fields,
      },
    };

    await this.messageQueueService.add<ProcessWorkflowAiFilteringJobData>(
      PROCESS_WORKFLOW_AI_FILTERING_JOB_NAME,
      jobData,
      { retryLimit: 2 },
    );

    this.logger.log(
      `Queued workflow AI filtering session=${sessionId} candidates=${candidates.length} run=${workflowRunId} step=${workflowStepId}`,
    );

    return {
      pending: true,
      queued: candidates.length,
      total: candidates.length,
      sessionId,
    };
  }

  async processAndBuildResult(input: {
    candidates: Record<string, unknown>[];
    filter: {
      name: string;
      prompt: string;
      selectedModel: string;
      selectedMetadataFields: string[];
      includeResume?: boolean;
      fields: AiFilterField[];
    };
  }): Promise<WorkflowAiFilteringResult> {
    const candidates = normalizeCandidates(input.candidates);

    if (candidates.length === 0) {
      return {
        success: false,
        total: 0,
        candidates: [],
        error: 'No candidates to filter.',
      };
    }

    const candidateData: CandidateData[] = candidates.map(
      (candidate, index) => {
        const id =
          typeof candidate.id === 'string' && candidate.id.trim()
            ? candidate.id
            : `row-${index}`;

        return {
          ...candidate,
          id,
        };
      },
    );

    const selectedMetadataFields = (
      input.filter.selectedMetadataFields || []
    ).filter((field) => field !== 'resume');

    const metadataFields =
      selectedMetadataFields.length > 0
        ? selectedMetadataFields
        : ['name', 'title', 'company', 'location', 'headline'];

    const aiFilterConfig: AiFilterConfig = {
      modelName: input.filter.name || 'AiFiltering',
      prompt: input.filter.prompt,
      selectedModel: input.filter.selectedModel || 'typesafe-ai/jev',
      fields: input.filter.fields,
      selectedMetadataFields: metadataFields,
      includeResume: input.filter.includeResume === true,
    };

    const filterResults =
      await this.aiFilteringProcessorService.processAiFilters(
        candidateData,
        [aiFilterConfig],
        resolveOpenAiApiKey(),
      );

    const enrichedById = new Map(
      filterResults.map((result) => [result.candidateId, result.enrichedData]),
    );

    const enrichedCandidates = candidateData.map((candidate) => ({
      ...candidate,
      aiFilter: enrichedById.get(candidate.id) ?? {},
    }));

    return {
      success: true,
      total: enrichedCandidates.length,
      candidates: enrichedCandidates,
    };
  }

  async processQueuedJob(
    jobData: ProcessWorkflowAiFilteringJobData,
  ): Promise<void> {
    try {
      const result = await this.processAndBuildResult({
        candidates: jobData.candidates,
        filter: jobData.filter,
      });

      await this.aiFilteringWorkflowResumeService.finalizeSuccess({
        workflowRunId: jobData.workflowRunId,
        workflowStepId: jobData.workflowStepId,
        workspaceId: jobData.workspaceId,
        sessionId: jobData.sessionId,
        result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Workflow AI filtering failed session=${jobData.sessionId}: ${message}`,
      );

      await this.aiFilteringWorkflowResumeService.finalizeFailure({
        workflowRunId: jobData.workflowRunId,
        workflowStepId: jobData.workflowStepId,
        workspaceId: jobData.workspaceId,
        sessionId: jobData.sessionId,
        errorMessage: message,
      });
    }
  }
}
