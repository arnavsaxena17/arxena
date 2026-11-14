import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    AiFilter,
    mutationToCreateOneCandidateEnrichment,
} from 'twenty-shared';

import { WorkspaceMemberArxService } from 'src/engine/core-modules/arx-chat/services/workspace-member-arx.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { AiFilterEngineService } from './ai-filter-engine/ai-filter-engine.service';
import {
  type CandidateFilterConfig,
  type CandidateFilterResult,
  estimateFilterTokens,
  mergeVerdicts,
  toFilterSpec,
} from './ai-filter-engine/candidate-filter-spec.util';
import { AiFilteringProgressPubSubService } from './ai-filtering-progress-pubsub.service';
import { CandidateDataService } from './candidate-data.service';
import { OtherFieldsService } from './other-fields.service';

export interface ProcessAiFiltersRequest {
  aiFilters: AiFilter[];
  objectNameSingular: string;
  availableSortDefinitions: any[];
  availableFilterDefinitions: any[];
  objectRecordId: string;
  selectedRecordIds: string[];
  projectId: string;
}

export interface ProcessAiFiltersResponse {
  status: 'Success' | 'Failed';
  error?: any;
}

@Injectable()
export class AiFilteringService {
  constructor(
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly configService: ConfigService,
    private readonly candidateDataService: CandidateDataService,
    private readonly otherFieldsService: OtherFieldsService,
    private readonly aiFilterEngineService: AiFilterEngineService,
    private readonly aiFilteringProgressPubSubService: AiFilteringProgressPubSubService,
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {}

  async processAiFilters(
    request: ProcessAiFiltersRequest,
    apiToken: string,
    origin: string,
  ): Promise<ProcessAiFiltersResponse> {
    let recruiterId: string | null = null;

    try {
      console.log('Processing AI filters locally in TypeScript service');

      if (!request) {
        throw new Error('Request object is required');
      }

      if (!apiToken || apiToken.trim().length === 0) {
        throw new Error('API token is required');
      }

      const {
        aiFilters,
        projectId,
        selectedRecordIds,
      } = request;

      if (!aiFilters || !Array.isArray(aiFilters)) {
        throw new Error('AI filters array is required');
      }

      if (!projectId || projectId.trim().length === 0) {
        throw new Error('Project ID is required');
      }

      console.log('aiFilters:', aiFilters?.length);
      console.log('selectedRecordIds:', selectedRecordIds?.length);

      try {
        const currentUser = await new WorkspaceMemberArxService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
        recruiterId = currentUser?.workspaceMember?.id;
      } catch (userError) {
        console.warn('Could not get current user for progress reporting:', userError.message);
      }

      const validAiFilters = aiFilters.filter(e =>
        e &&
        e.modelName &&
        e.modelName.trim() !== '' &&
        e.prompt &&
        e.prompt.trim() !== ''
      );

      if (validAiFilters.length === 0) {
        console.log('No valid AI filters to process');
        return { status: 'Success' };
      }

      console.log(`Processing ${validAiFilters.length} valid AI filters out of ${aiFilters.length} total`);

      for (const aiFilter of validAiFilters) {
        try {
          await this.createOneAiFilter(aiFilter, request.projectId, apiToken);
        } catch (createError) {
          console.error('Error creating AI filter:', createError.message);
        }
      }

      console.log('Fetching candidates data');
      const needsResumeText = validAiFilters.some(
        (filter) =>
          filter.includeResume === true ||
          (filter.selectedMetadataFields || []).includes('resume'),
      );
      const candidates = await this.candidateDataService.fetchCandidatesForJob(
        projectId,
        selectedRecordIds,
        apiToken,
        { includeResumeText: needsResumeText },
      );

      if (recruiterId) {
        try {
          await this.aiFilteringProgressPubSubService.publishAiFilteringStarted(
            recruiterId,
            validAiFilters.length,
            candidates.length
          );
        } catch (pubSubError) {
          console.warn('Pub-sub notification failed:', pubSubError.message);
        }
      }

      if (candidates.length === 0) {
        console.log('No candidates found for processing');
        return { status: 'Success' };
      }

      console.log(`Found ${candidates.length} candidates to process`);

      const aiFilterConfigs: CandidateFilterConfig[] = validAiFilters.map(e => {
        const selectedMetadataFields = e.selectedMetadataFields || [];
        const includeResume =
          e.includeResume === true || selectedMetadataFields.includes('resume');

        return {
          modelName: e.modelName,
          prompt: e.prompt,
          selectedModel: e.selectedModel || 'gpt-6-luna',
          fields: e.fields || e.filterFields || [],
          selectedMetadataFields: selectedMetadataFields.filter(
            (field) => field !== 'resume',
          ),
          includeResume,
        };
      });

      for (const config of aiFilterConfigs) {
        if (!config.fields || config.fields.length === 0) {
          throw new Error(`AI filter "${config.modelName}" has no output fields defined`);
        }
        if (
          (!config.selectedMetadataFields ||
            config.selectedMetadataFields.length === 0) &&
          !config.includeResume
        ) {
          throw new Error(
            `AI filter "${config.modelName}" has no input fields selected`,
          );
        }
      }

      // One engine run per filter: every model call, retry and answer check
      // is the engine's. Progress is reported as each filter finishes.
      const resultsByCandidate = new Map<string, CandidateFilterResult>();
      const totalOperations = candidates.length * aiFilterConfigs.length;

      for (const [index, config] of aiFilterConfigs.entries()) {
        const { verdicts, stats } = await this.aiFilterEngineService.run(
          candidates,
          toFilterSpec(config),
        );

        mergeVerdicts(resultsByCandidate, verdicts);
        console.log(
          `AI filter "${config.modelName}": ${verdicts.filter((verdict) => verdict.status === 'answered').length}/${verdicts.length} answered on ${stats.engine} (${stats.model}), ${stats.calls} calls, est. $${stats.estimatedCostUsd ?? 0}`,
        );

        if (recruiterId) {
          const current = candidates.length * (index + 1);

          try {
            await this.aiFilteringProgressPubSubService.publishAiFilteringProcessing(
              recruiterId,
              Math.round((current / totalOperations) * 100),
              current,
              totalOperations,
              validAiFilters.length,
            );
          } catch (pubSubError) {
            console.warn('Pub-sub progress notification failed:', pubSubError.message);
          }
        }
      }

      const aiFilterResults = [...resultsByCandidate.values()];

      console.log(`AI filter processing completed. Got ${aiFilterResults.length} results`);

      const allFieldNames = new Set<string>();
      aiFilterConfigs.forEach(config => {
        config.fields.forEach(field => allFieldNames.add(field.name));
      });

      if (allFieldNames.size > 0) {
        try {
          await this.otherFieldsService.processAiFilterResults(
            aiFilterResults,
            Array.from(allFieldNames),
            apiToken
          );
        } catch (fieldError) {
          console.error('Error processing field values:', fieldError.message);
        }
      }

      if (recruiterId) {
        try {
          await this.aiFilteringProgressPubSubService.publishAiFilteringCompleted(
            recruiterId,
            candidates.length,
            validAiFilters.length
          );
        } catch (pubSubError) {
          console.warn('Pub-sub completion notification failed:', pubSubError.message);
        }
      }

      console.log('AI filter processing completed successfully');
      return { status: 'Success' };
    } catch (err) {
      console.error('Error in AI filtering service:', err);

      if (recruiterId) {
        try {
          await this.aiFilteringProgressPubSubService.publishAiFilteringError(
            recruiterId,
            err.message || 'Unknown error occurred'
          );
        } catch (pubSubError) {
          console.warn('Pub-sub error notification failed:', pubSubError.message);
        }
      }

      return { status: 'Failed', error: err.message || 'Unknown error occurred' };
    }
  }

  async createOneAiFilter(
    aiFilter: AiFilter,
    projectId: string,
    apiToken: string,
  ): Promise<any> {
    const selectedMetadataFields = [...(aiFilter.selectedMetadataFields || [])];
    if (
      aiFilter.includeResume === true &&
      !selectedMetadataFields.includes('resume')
    ) {
      selectedMetadataFields.push('resume');
    }

    const graphqlVariables = {
      input: {
        name: aiFilter.modelName,
        modelName: aiFilter.modelName,
        prompt: aiFilter.prompt,
        selectedModel: aiFilter.selectedModel,
        filterFields: aiFilter.fields,
        selectedMetadataFields,
        projectId: projectId,
      },
    };

    const response = await this.staticGraphQLService.executeGraphQL(
      mutationToCreateOneCandidateEnrichment,
      graphqlVariables,
      apiToken
    );

    return response.data;
  }

  async computeTokens(
    request: ProcessAiFiltersRequest,
    apiToken: string
  ): Promise<{
    totalInputTokens: number;
    totalOutputTokens: number;
    estimatedCost: number;
    totalCandidates: number;
  }> {
    try {
      const { aiFilters, projectId, selectedRecordIds } = request;

      const validAiFilters = aiFilters.filter(e => e.modelName && e.modelName.trim() !== '');

      if (validAiFilters.length === 0) {
        return {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          estimatedCost: 0,
          totalCandidates: 0
        };
      }

      const needsResumeText = validAiFilters.some(
        (filter) =>
          filter.includeResume === true ||
          (filter.selectedMetadataFields || []).includes('resume'),
      );

      const candidates = await this.candidateDataService.fetchCandidatesForJob(
        projectId,
        selectedRecordIds,
        apiToken,
        { includeResumeText: needsResumeText },
      );

      if (candidates.length === 0) {
        return {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          estimatedCost: 0,
          totalCandidates: 0
        };
      }

      const aiFilterConfigs: CandidateFilterConfig[] = validAiFilters.map(e => {
        const selectedMetadataFields = e.selectedMetadataFields || [];
        const includeResume =
          e.includeResume === true || selectedMetadataFields.includes('resume');

        return {
          modelName: e.modelName,
          prompt: e.prompt,
          selectedModel: e.selectedModel || 'gpt-6-luna',
          fields: e.fields || e.filterFields || [],
          selectedMetadataFields: selectedMetadataFields.filter(
            (field) => field !== 'resume',
          ),
          includeResume,
        };
      });

      return estimateFilterTokens(candidates, aiFilterConfigs);
    } catch (error) {
      console.error('Error computing tokens:', error);
      throw error;
    }
  }
}
