import { Injectable, Logger } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import {
  JEV_EVALUATE_URL,
  JEV_MODEL_ID,
} from 'src/engine/metadata-modules/ai/ai-evaluation/constants/jev.const';
import {
  type JevEvaluateRequest,
  type JevEvaluateResponse,
} from 'src/engine/metadata-modules/ai/ai-evaluation/types/jev-evaluation.type';
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
        'AI_GATEWAY_API_KEY is required to use TypeSafe Jev evaluation.',
        AiExceptionCode.AGENT_EXECUTION_FAILED,
      );
    }

    const body: JevEvaluateRequest = {
      model: request.model ?? JEV_MODEL_ID,
      state: request.state,
      questions: request.questions,
    };

    const response = await fetch(JEV_EVALUATE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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

    return (await response.json()) as JevEvaluateResponse;
  }

  private getApiKey(): string | undefined {
    const configuredApiKey = this.twentyConfigService.get('AI_GATEWAY_API_KEY');

    if (isDefined(configuredApiKey) && configuredApiKey.trim() !== '') {
      return configuredApiKey.trim();
    }

    return undefined;
  }
}
