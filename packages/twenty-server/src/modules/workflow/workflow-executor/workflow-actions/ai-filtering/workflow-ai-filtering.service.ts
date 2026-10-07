import { Injectable, Logger } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';
import { v4 } from 'uuid';

import {
  type FilterFieldSpec,
  type FilterSpec,
} from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-contract';
import { AiFilterEngineService } from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-engine.service';
import { AiFilterContextService } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/ai-filter-context.service';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import {
  type WorkflowAiFilteringRecord,
  type WorkflowAiFilteringResult,
} from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/types/workflow-ai-filtering-result.type';
import { type WorkflowAiFilteringActionInput } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/types/workflow-ai-filtering-action-input.type';
import { AiFilteringWorkflowResumeService } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/ai-filtering-workflow-resume.service';
import { type ProcessWorkflowAiFilteringJobData } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/types/process-workflow-ai-filtering-job-data.type';

export type { WorkflowAiFilteringResult };

const START_DELAY_MS = 2000;
const PROCESS_WORKFLOW_AI_FILTERING_JOB_NAME = 'ProcessWorkflowAiFilteringJob';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const toFieldType = (type: string): FilterFieldSpec['type'] => {
  const normalized = type.toLowerCase();

  return normalized === 'boolean' || normalized === 'enum'
    ? normalized
    : 'text';
};

export const EMPTY_AI_FILTERING_RESULT: WorkflowAiFilteringResult = {
  success: true,
  total: 0,
  candidates: [],
  kept: [],
  rejected: [],
  failed: [],
};

const normalizeCandidates = (input: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(input)) {
    const single = asRecord(input);

    return single ? [single] : [];
  }

  return input.map((entry) => asRecord(entry)).filter(isDefined);
};

@Injectable()
export class WorkflowAiFilteringService {
  private readonly logger = new Logger(WorkflowAiFilteringService.name);

  constructor(
    private readonly aiFilterEngineService: AiFilterEngineService,
    private readonly aiFilteringWorkflowResumeService: AiFilteringWorkflowResumeService,
    @InjectMessageQueue(MessageQueue.aiFilteringQueue)
    private readonly messageQueueService: MessageQueueService,
    private readonly aiFilterContextService: AiFilterContextService,
  ) {}

  // A search that found nothing is a normal outcome, not an error.
  hasCandidates(candidates: unknown): boolean {
    return normalizeCandidates(candidates).length > 0;
  }

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
        keepField: input.keepField,
        concurrency: input.concurrency,
        batchSize: input.batchSize,
        subject: input.subject,
        context: input.context,
      },
    };

    await this.messageQueueService.add<ProcessWorkflowAiFilteringJobData>(
      PROCESS_WORKFLOW_AI_FILTERING_JOB_NAME,
      jobData,
      // The executor marks the step PENDING after enqueue returns; a job that
      // finishes first would have its SUCCESS overwritten and the run would
      // hang. Start the job after that write.
      { retryLimit: 2, delay: START_DELAY_MS },
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
    filter: ProcessWorkflowAiFilteringJobData['filter'];
    // Workspace facts resolved by the caller; appended to filter.context.
    workspaceContext?: string;
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

    const records = candidates.map((candidate, index) => ({
      ...candidate,
      id:
        typeof candidate.id === 'string' && candidate.id.trim()
          ? candidate.id
          : `row-${index}`,
    }));
    const fields: FilterFieldSpec[] = input.filter.fields.map((field) => ({
      name: field.name,
      type: toFieldType(field.type),
      description: field.description,
      enumValues: field.enumValues,
      optional: field.optional,
    }));
    const keepField =
      input.filter.keepField ??
      fields.find((field) => field.type === 'boolean')?.name ??
      fields[0]?.name;
    const metadataFields = (input.filter.selectedMetadataFields ?? []).filter(
      (field) => field !== 'resume',
    );
    const spec: FilterSpec = {
      name: input.filter.name || 'AiFiltering',
      subject: input.filter.subject ?? 'record',
      criteria: input.filter.prompt,
      context: [input.filter.context, input.workspaceContext]
        .filter((part): part is string => Boolean(part?.trim()))
        .join('\n'),
      fields,
      keepField,
      model: input.filter.selectedModel || 'typesafe-ai/jev',
      metadataFields:
        metadataFields.length > 0
          ? metadataFields
          : ['name', 'title', 'company', 'location', 'headline'],
      batchSize: input.filter.batchSize,
      concurrency: input.filter.concurrency,
    };

    const { verdicts, stats } = await this.aiFilterEngineService.run(
      records,
      spec,
    );

    if (verdicts.every((verdict) => verdict.status === 'failed')) {
      // The model never answered (provider down, missing key, bad config).
      // Fail the step rather than report every record as rejected.
      throw new Error(
        `AI filter "${spec.name}" got no valid answer for any of ${records.length} records: ${verdicts[0]?.error ?? 'unknown error'}`,
      );
    }

    const enriched: WorkflowAiFilteringRecord[] = [];
    const kept: WorkflowAiFilteringRecord[] = [];
    const rejected: Array<WorkflowAiFilteringRecord & { reason: string }> = [];
    const failed: Array<WorkflowAiFilteringRecord & { error: string }> = [];

    records.forEach((record, index) => {
      const verdict = verdicts[index];
      const withAnswers: WorkflowAiFilteringRecord = {
        ...record,
        aiFilter: verdict.answers,
      };

      enriched.push(withAnswers);

      if (verdict.status === 'failed') {
        failed.push({
          ...withAnswers,
          error: verdict.error ?? 'No answer from the filter model',
        });
      } else if (verdict.keep) {
        kept.push(withAnswers);
      } else {
        rejected.push({
          ...withAnswers,
          reason: verdict.reason ?? `Did not meet "${keepField}"`,
        });
      }
    });

    return {
      success: true,
      total: enriched.length,
      candidates: enriched,
      kept,
      rejected,
      failed,
      stats: {
        ...stats,
        kept: kept.length,
        rejected: rejected.length,
        failed: failed.length,
      },
    };
  }

  async processQueuedJob(
    jobData: ProcessWorkflowAiFilteringJobData,
  ): Promise<void> {
    try {
      const workspaceContext =
        await this.aiFilterContextService.resolveForWorkspace(
          jobData.workspaceId,
        );
      const result = await this.processAndBuildResult({
        candidates: jobData.candidates,
        filter: jobData.filter,
        workspaceContext,
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
