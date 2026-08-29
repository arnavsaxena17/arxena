import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

import {
  buildOutreachInboundReplyClassifierUserPrompt,
  OUTREACH_INBOUND_REPLY_CLASSIFIER_SYSTEM_PROMPT,
} from 'src/engine/core-modules/outreach-command/prompts/outreach-inbound-reply-next-step.prompt';
import {
  classificationFromIntent,
  classifyInboundReplyFallback,
  type OutreachInboundReplyClassification,
} from 'src/engine/core-modules/outreach-command/utils/outreach-inbound-reply-classifier.util';
import { concatenatedUserBurst } from 'src/engine/core-modules/outreach-command/utils/inbound-reply-window.util';
import { toOpenAiJsonSchemaResponseFormat } from 'src/engine/core-modules/llm-chat-model/utils/to-openai-json-schema-format.util';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

const inboundClassificationSchema = z.object({
  intent: z.enum([
    'unsubscribe',
    'not_now',
    'interested',
    'times_proposed',
    'book',
    'question',
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  extractedTimeHint: z.string(),
});

@Injectable()
export class OutreachInboundReplyClassifierService {
  private readonly logger = new Logger(OutreachInboundReplyClassifierService.name);

  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}

  async classify({
    workspaceId,
    inboundBurst,
    priorTurns,
  }: {
    workspaceId: string;
    inboundBurst: string;
    priorTurns?: string;
  }): Promise<OutreachInboundReplyClassification> {
    const burst = inboundBurst.trim();
    const fallback = classifyInboundReplyFallback(burst);

    if (!burst) {
      return fallback;
    }

    try {
      const { openAIclient: openai } =
        await this.workspaceQueryService.initializeLLMClients(workspaceId);

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: OUTREACH_INBOUND_REPLY_CLASSIFIER_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: buildOutreachInboundReplyClassifierUserPrompt({
              inboundBurst: burst,
              priorTurns,
            }),
          },
        ],
        response_format: toOpenAiJsonSchemaResponseFormat(
          inboundClassificationSchema,
          'gtmInboundReplyClassification',
        ),
      });

      const content = completion.choices[0]?.message?.content;

      if (!content) {
        throw new Error('Empty inbound classification response');
      }

      const parsed = inboundClassificationSchema.parse(JSON.parse(content));
      const result = classificationFromIntent(parsed);

      this.logger.log(
        `Inbound classified intent=${result.intent} stage=${result.stage} confidence=${result.confidence}`,
      );

      return result;
    } catch (error) {
      this.logger.warn(
        `Inbound classifier falling back: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return fallback;
    }
  }

  classifyTurns({
    workspaceId,
    turns,
  }: {
    workspaceId: string;
    turns: Array<{ role: string; content: string }>;
  }): Promise<OutreachInboundReplyClassification> {
    const inboundBurst = concatenatedUserBurst(
      turns.map((turn) => ({
        role: turn.role,
        content: turn.content,
      })),
    );
    const priorTurns = turns
      .map((turn) => `${turn.role}: ${turn.content}`)
      .join('\n');

    return this.classify({
      workspaceId,
      inboundBurst: inboundBurst || turns.map((turn) => turn.content).join('\n'),
      priorTurns,
    });
  }
}
