import { Injectable, Logger } from '@nestjs/common';

import { TestWorkflowAiFilteringDTO } from 'src/engine/core-modules/workflow/dtos/test-workflow-ai-filtering.dto';
import { WorkflowAiFilteringService } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/workflow-ai-filtering.service';

const DEFAULT_SAMPLE_CANDIDATES: Record<string, unknown>[] = [
  {
    id: 'sample-1',
    name: 'Arapa Hara',
    title: 'Head of Sales',
    company: 'Acme',
    location: 'San Francisco',
  },
  {
    id: 'sample-2',
    name: 'Jordan Lee',
    title: 'SDR',
    company: 'Acme',
    location: 'New York',
  },
];

@Injectable()
export class WorkflowAiFilteringTestService {
  private readonly logger = new Logger(WorkflowAiFilteringTestService.name);

  constructor(
    private readonly workflowAiFilteringService: WorkflowAiFilteringService,
  ) {}

  async test({
    prompt,
    selectedModel,
    name,
    selectedMetadataFields,
    includeResume,
    fields,
    candidates,
  }: {
    prompt: string;
    selectedModel?: string;
    name?: string;
    selectedMetadataFields?: string[];
    includeResume?: boolean;
    fields: Array<{
      name: string;
      type: string;
      description?: string;
      enumValues?: string[];
    }>;
    candidates?: unknown;
  }): Promise<TestWorkflowAiFilteringDTO> {
    const startedAtMs = Date.now();

    try {
      if (!prompt.trim()) {
        return this.buildFailure({
          message: 'Prompt is required',
          startedAtMs,
        });
      }

      if (!fields || fields.length === 0) {
        return this.buildFailure({
          message: 'At least one structured output field is required',
          startedAtMs,
        });
      }

      const sampleCandidates = Array.isArray(candidates)
        ? (candidates as Record<string, unknown>[])
        : DEFAULT_SAMPLE_CANDIDATES;

      const result =
        await this.workflowAiFilteringService.processAndBuildResult({
          candidates: sampleCandidates,
          filter: {
            name: name || 'AiFilteringTest',
            prompt,
            selectedModel: selectedModel || 'typesafe-ai/jev',
            selectedMetadataFields:
              selectedMetadataFields && selectedMetadataFields.length > 0
                ? selectedMetadataFields
                : ['name', 'title', 'company', 'location'],
            includeResume: includeResume === true,
            fields,
          },
        });

      return {
        success: result.success,
        message: result.success
          ? `Filtered ${result.total} candidates`
          : result.error || 'AI filtering test failed',
        result,
        error: result.error,
        durationMs: Date.now() - startedAtMs,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(`AI filtering test failed: ${message}`);

      return this.buildFailure({
        message,
        startedAtMs,
      });
    }
  }

  private buildFailure({
    message,
    startedAtMs,
  }: {
    message: string;
    startedAtMs: number;
  }): TestWorkflowAiFilteringDTO {
    return {
      success: false,
      message,
      result: null,
      error: message,
      durationMs: Date.now() - startedAtMs,
    };
  }
}
