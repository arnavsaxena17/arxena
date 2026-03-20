import { Injectable } from '@nestjs/common';

import { AssistantThreadService } from './assistant-thread.service';
import { AssistantIterativeQueryRequestBody } from './assistant.types';

import { buildIterativeRequirement } from './utils/assistant-iterative-query.utils';

@Injectable()
export class AssistantIterativeQueryService {
  private readonly iterativeQueryInFlightByThread = new Set<string>();

  constructor(
    private readonly assistantThreadService: AssistantThreadService,
  ) {}

  async steerIterativeQueryForThread(
    apiToken: string,
    threadId: string,
    body: AssistantIterativeQueryRequestBody,
  ): Promise<
    | {
        success: true;
        assistantMessage: string;
        iterativeQueryState: Record<string, unknown>;
        assistantParameters: Record<string, unknown>;
        assistantSearchStrategy: Record<string, unknown>;
      }
    | { error: string }
  > {
    const lockKey = `${apiToken.slice(0, 16)}:${threadId}`;

    try {
      if (this.iterativeQueryInFlightByThread.has(lockKey)) {
        return {
          error:
            'An iterative query-generation run is already in progress for this thread. Please wait for it to finish before steering again.',
        };
      }
      this.iterativeQueryInFlightByThread.add(lockKey);

      const thread = await this.assistantThreadService.getThread(
        apiToken,
        threadId,
      );

      if (!thread) {
        return { error: 'Thread not found' };
      }

      const assistantParameters =
        thread.assistantParameters &&
        typeof thread.assistantParameters === 'object'
          ? (thread.assistantParameters as Record<string, unknown>)
          : {};
      const existingState =
        assistantParameters.iterativeQueryState &&
        typeof assistantParameters.iterativeQueryState === 'object'
          ? (assistantParameters.iterativeQueryState as Record<string, unknown>)
          : {};
      const steeringHistory = Array.isArray(existingState.steeringHistory)
        ? (existingState.steeringHistory as Array<Record<string, unknown>>)
        : [];

      const baseRequirement =
        typeof body.rawRequirement === 'string' && body.rawRequirement.trim()
          ? body.rawRequirement.trim()
          : typeof existingState.baseRequirement === 'string'
            ? existingState.baseRequirement
            : (thread.messages.find(
                (message) =>
                  message.role === 'user' &&
                  !message.content.startsWith('Steer query set:'),
              )?.content ?? '');

      const steeringMessage =
        typeof body.steeringMessage === 'string' && body.steeringMessage.trim()
          ? body.steeringMessage.trim()
          : null;

      if (!steeringMessage) {
        return {
          error: 'Body must include a non-empty "steeringMessage"',
        };
      }
      if (!baseRequirement) {
        return {
          error:
            'No base requirement found on this thread yet. Start with the normal chat flow first, then steer.',
        };
      }

      const updatedSteeringHistory = [
        ...steeringHistory,
        {
          message: steeringMessage,
          createdAt: new Date().toISOString(),
        },
      ];

      const effectiveRequirement = buildIterativeRequirement(
        baseRequirement,
        updatedSteeringHistory,
      );

      const nextIterativeState = {
        baseRequirement,
        effectiveRequirement,
        steeringHistory: updatedSteeringHistory,
        pendingSteeringInstruction: steeringMessage,
        needsRegeneration: true,
        queryGenerationStatus: 'needs_regeneration',
        version: Number(existingState.version ?? 0) + 1,
        updatedAt: new Date().toISOString(),
      };

      const nextAssistantParameters =
        await this.assistantThreadService.mergeAssistantParameters(
          apiToken,
          threadId,
          {
            iterativeQueryState: nextIterativeState,
          },
        );

      await this.assistantThreadService.appendIterativeProgressLog(
        apiToken,
        threadId,
        {
          message: 'Steering request queued. Waiting for the next safe regeneration checkpoint.',
          stage: 'steering_queued',
        },
      );

      await this.assistantThreadService.setThreadSearchStrategy(
        apiToken,
        threadId,
        {
          source: 'iterative_query_generation',
          updatedAt: new Date().toISOString(),
          baseRequirement,
          effectiveRequirement,
          steeringHistory: updatedSteeringHistory,
          pendingSteeringInstruction: steeringMessage,
          queryGenerationStatus: 'needs_regeneration',
        },
      );

      const assistantMessage =
        'Queued steering update. The active LinkedIn generation/search loop will recompute the query set from the updated source of truth after the next safe checkpoint.';
      const userMessage = `Steer query set: ${steeringMessage}`;

      await this.assistantThreadService.appendMessages(apiToken, threadId, [
        { role: 'user', content: userMessage },
        { role: 'assistant', content: assistantMessage },
      ]);

      return {
        success: true,
        assistantMessage,
        iterativeQueryState: nextIterativeState,
        assistantParameters: nextAssistantParameters,
        assistantSearchStrategy: {
          source: 'iterative_query_generation',
          updatedAt: new Date().toISOString(),
          baseRequirement,
          effectiveRequirement,
          steeringHistory: updatedSteeringHistory,
          pendingSteeringInstruction: steeringMessage,
          queryGenerationStatus: 'needs_regeneration',
        },
      };
    } finally {
      this.iterativeQueryInFlightByThread.delete(lockKey);
    }
  }
}
