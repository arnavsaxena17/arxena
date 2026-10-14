import { Injectable, Logger } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

export const JEV_DECISIONS_URL = 'https://openrouter.ai/api/alpha/decisions';
export const JEV_DECISIONS_MODEL_ID = 'typesafe/jev-1.13';

// noul = a yes/no question; the answer is the probability of "true"
export type JevNoulQuestion = {
  type: 'noul';
  instructions: string;
  criteria: { true: string; false: string };
};

export type JevChoiceQuestion = {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string>;
};

export type JevDecisionQuestion = JevNoulQuestion | JevChoiceQuestion;

export type JevDecisionAnswer = {
  type?: string;
  noul?: number;
  choice?: string;
};

// Jev (typesafe/jev-1.13) on OpenRouter's decisions endpoint. It is not a chat
// model: it takes a state and a set of questions and answers each one.
@Injectable()
export class JevDecisionsService {
  private readonly logger = new Logger(JevDecisionsService.name);

  isConfigured(): boolean {
    return isDefined(this.getApiKey());
  }

  async decide({
    state,
    questions,
  }: {
    state: Record<string, unknown>;
    questions: Record<string, JevDecisionQuestion>;
  }): Promise<Record<string, JevDecisionAnswer>> {
    const apiKey = this.getApiKey();

    if (!isDefined(apiKey)) {
      throw new Error('OPENROUTER_API_KEY is required to use Jev decisions.');
    }

    const response = await fetch(JEV_DECISIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: JEV_DECISIONS_MODEL_ID,
        state,
        questions,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const errorText = await response.text();

      this.logger.error(
        `Jev decisions failed (${response.status}): ${errorText}`,
      );

      throw new Error(`Jev decisions failed with status ${response.status}`);
    }

    const body = (await response.json()) as {
      answers?: Record<string, JevDecisionAnswer>;
    };

    if (!isDefined(body.answers)) {
      throw new Error('Jev decisions returned no answers');
    }

    return body.answers;
  }

  private getApiKey(): string | undefined {
    const key = process.env.OPENROUTER_API_KEY?.trim();

    return isDefined(key) && key !== '' ? key : undefined;
  }
}
