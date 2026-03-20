import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Injectable } from '@nestjs/common';
import { IterativeLinkedinQueryGenerationService } from 'src/engine/core-modules/linkedin-query-generation/services/iterative-linkedin-query-generation.service';
import { AssistantThreadService } from './assistant-thread.service';
import { StreamEventSender } from './assistant.types';
import { REGENERATION_CHECKPOINT_TOOLS } from './mcp-assistant.constants';

const buildIterativeRequirement = (
  baseRequirement: string,
  steeringHistory: Array<Record<string, unknown>>,
): string => {
  return [
    `Base requirement: ${baseRequirement}`,
    steeringHistory.length > 0
      ? `User steering updates:\n${steeringHistory
          .map((entry, index) => `${index + 1}. ${String(entry.message ?? '')}`)
          .join('\n')}`
      : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join('\n\n');
};

@Injectable()
export class McpLinkedinQueryRegenerationService {
  constructor(
    private readonly assistantThreadService: AssistantThreadService,
    private readonly iterativeLinkedinQueryGenerationService: IterativeLinkedinQueryGenerationService,
  ) {}

  async maybeRegenerateLinkedinQuerySet(
    client: Client,
    apiToken: string,
    sendEvent: StreamEventSender,
    assistantThreadId?: string,
    toolName?: string,
    _searchType?: 'classic' | 'sales_navigator' | 'recruiter',
  ): Promise<string | null> {
    if (
      !assistantThreadId ||
      !toolName ||
      !REGENERATION_CHECKPOINT_TOOLS.has(toolName)
    ) {
      return null;
    }

    const thread = await this.assistantThreadService.getThread(
      apiToken,
      assistantThreadId,
    );
    if (!thread?.assistantParameters) {
      return null;
    }

    const iterativeState =
      thread.assistantParameters.iterativeQueryState &&
      typeof thread.assistantParameters.iterativeQueryState === 'object'
        ? (thread.assistantParameters.iterativeQueryState as Record<
            string,
            unknown
          >)
        : null;

    if (!iterativeState?.needsRegeneration) {
      return null;
    }

    const baseRequirement =
      typeof iterativeState.baseRequirement === 'string'
        ? iterativeState.baseRequirement
        : (thread.messages.find(
            (message) =>
              message.role === 'user' &&
              !message.content.startsWith('Steer query set:'),
          )?.content ?? '');

    if (!baseRequirement) {
      return null;
    }

    const steeringHistory = Array.isArray(iterativeState.steeringHistory)
      ? (iterativeState.steeringHistory as Array<Record<string, unknown>>)
      : [];
    const effectiveRequirement = buildIterativeRequirement(
      baseRequirement,
      steeringHistory,
    );

    sendEvent('status', {
      message:
        'Steering update detected. Recomputing LinkedIn query generation from the updated thread state...',
    });
    await this.assistantThreadService.appendIterativeProgressLog(
      apiToken,
      assistantThreadId,
      {
        message:
          'Detected queued steering and started regenerating the LinkedIn query set.',
        stage: 'regeneration_started',
      },
    );

    const regeneratedResult =
      await this.iterativeLinkedinQueryGenerationService.generateIterativeSearchQuerySet(
        effectiveRequirement,
        {
          mode: 'offline',
          searchType:
            _searchType === 'classic' ||
            _searchType === 'sales_navigator' ||
            _searchType === 'recruiter'
              ? _searchType
              : thread.searchType === 'classic' ||
                  thread.searchType === 'sales_navigator' ||
                  thread.searchType === 'recruiter'
                ? thread.searchType
                : 'classic',
          maxIterations: 1,
          returnAlternatives: false,
          apiToken,
          onProgress: (message) => sendEvent('status', { message }),
        },
      );

    const regeneratedText = JSON.stringify(regeneratedResult);
    const finalQuerySet =
      regeneratedResult.final_query_set &&
      typeof regeneratedResult.final_query_set === 'object'
        ? (regeneratedResult.final_query_set as unknown as Record<
            string,
            unknown
          >)
        : null;

    const nextIterativeState = {
      ...iterativeState,
      effectiveRequirement,
      needsRegeneration: false,
      pendingSteeringInstruction: null,
      queryGenerationStatus: 'ready',
      lastGeneratedQuerySet: finalQuerySet,
      lastGeneratedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.assistantThreadService.mergeAssistantParameters(
      apiToken,
      assistantThreadId,
      { iterativeQueryState: nextIterativeState },
    );
    await this.assistantThreadService.appendIterativeProgressLog(
      apiToken,
      assistantThreadId,
      {
        message: `Completed regeneration with ${regeneratedResult.final_query_set.search_query_set.length} steered queries.`,
        stage: 'regeneration_completed',
      },
    );

    await this.assistantThreadService.setThreadSearchStrategy(
      apiToken,
      assistantThreadId,
      {
        source: 'iterative_query_generation',
        updatedAt: new Date().toISOString(),
        baseRequirement,
        effectiveRequirement,
        steeringHistory,
        queryGenerationStatus: 'ready',
        finalQuerySet,
      },
    );

    return [
      'Thread steering updated during the active loop.',
      'Ignore earlier LinkedIn query-generation/search assumptions and use this regenerated query set as the new source of truth.',
      regeneratedText,
    ].join('\n\n');
  }
}
