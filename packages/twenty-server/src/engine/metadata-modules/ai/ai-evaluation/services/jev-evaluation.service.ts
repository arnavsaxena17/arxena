import { Injectable, Logger } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import {
  JEV_EVALUATE_URL,
  JEV_MODEL_ID,
  JEV_OPENROUTER_MODEL_ID,
} from 'src/engine/metadata-modules/ai/ai-evaluation/constants/jev.const';
import {
  type JevEvaluateRequest,
  type JevEvaluateResponse,
} from 'src/engine/metadata-modules/ai/ai-evaluation/types/jev-evaluation.type';
import {
  fromOpenRouterAnswers,
  toOpenRouterQuestions,
  type OpenRouterDecisionAnswer,
} from 'src/engine/metadata-modules/ai/ai-evaluation/utils/map-openrouter-jev-decisions.util';
import {
  AiException,
  AiExceptionCode,
} from 'src/engine/metadata-modules/ai/ai.exception';

@Injectable()
export class JevEvaluationService {
  private readonly logger = new Logger(JevEvaluationService.name);

  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  isConfigured(): boolean {
    return isDefined(this.getApiKey());
  }

  getDefaultModelId(): string {
    return JEV_MODEL_ID;
  }

  async evaluate(
    request: Omit<JevEvaluateRequest, 'model'> & { model?: string },
  ): Promise<JevEvaluateResponse> {
    const apiKey = this.getApiKey();

    if (!isDefined(apiKey)) {
      throw new AiException(
        'OPENROUTER_API_KEY is required to use TypeSafe Jev evaluation.',
        AiExceptionCode.AGENT_EXECUTION_FAILED,
      );
    }

    const model = request.model ?? JEV_OPENROUTER_MODEL_ID;
    const wireModel = model === JEV_MODEL_ID ? JEV_OPENROUTER_MODEL_ID : model;

    const response = await fetch(JEV_EVALUATE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: wireModel,
        state: request.state,
        questions: toOpenRouterQuestions(request.questions),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      this.logger.error(
        `Jev evaluate failed (${response.status}): ${errorText}`,
      );

      throw new AiException(
        `Jev evaluation failed with status ${response.status}`,
        AiExceptionCode.AGENT_EXECUTION_FAILED,
      );
    }

    const body = (await response.json()) as {
      model?: string;
      answers?: Record<string, OpenRouterDecisionAnswer>;
      usage?: JevEvaluateResponse['usage'];
    };

    if (!isDefined(body.answers)) {
      throw new AiException(
        'Jev evaluation returned no answers',
        AiExceptionCode.AGENT_EXECUTION_FAILED,
      );
    }

    return {
      model: body.model ?? wireModel,
      answers: fromOpenRouterAnswers(body.answers),
      usage: body.usage,
    };
  }

  private getApiKey(): string | undefined {
    const configuredApiKey = this.twentyConfigService.get('OPENROUTER_API_KEY');

    if (isDefined(configuredApiKey) && configuredApiKey.trim() !== '') {
      return configuredApiKey.trim();
    }

    return undefined;
  }
}
