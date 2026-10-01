import { Injectable, Logger } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { type AgentExecutionResult } from 'src/engine/metadata-modules/ai/ai-agent-execution/types/agent-execution-result.type';
import {
  AI_AGENT_OUTPUT_VALIDATION_MAX_ATTEMPTS,
  type AiAgentOutputValidationCheck,
  type AiAgentOutputValidationFieldResult,
  type AiAgentOutputValidationReport,
  applyJevNouls,
  buildJevOutputValidationRequest,
  buildOutputValidationRepairPrompt,
  JEV_DECISIONS_URL,
  resolveOutputValidationChecks,
  scanOutputFields,
} from 'src/modules/workflow/workflow-executor/workflow-actions/ai-agent/utils/ai-agent-output-validation.util';

type JevDecisionsResponse = {
  answers?: Record<string, { type?: string; noul?: number }>;
};

@Injectable()
export class AiAgentOutputValidationService {
  private readonly logger = new Logger(AiAgentOutputValidationService.name);

  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  async runWithRetries({
    userPrompt,
    fieldKeys,
    checks,
    execute,
  }: {
    userPrompt: string;
    fieldKeys: string[];
    checks?: AiAgentOutputValidationCheck[];
    execute: (prompt: string) => Promise<AgentExecutionResult>;
  }): Promise<{
    executionResult: AgentExecutionResult;
    report: AiAgentOutputValidationReport;
  }> {
    let prompt = userPrompt;
    let executionResult = await execute(prompt);
    let report: AiAgentOutputValidationReport = {
      attempts: 1,
      cleared: false,
      fields: [],
    };

    for (
      let attempt = 1;
      attempt <= AI_AGENT_OUTPUT_VALIDATION_MAX_ATTEMPTS;
      attempt++
    ) {
      if (attempt > 1) {
        executionResult = await execute(prompt);
      }

      if (executionResult.hasNoMoreAvailableCredits) {
        return {
          executionResult,
          report: {
            attempts: attempt,
            cleared: false,
            fields: report.fields,
          },
        };
      }

      const fields = await this.judgeDraft(
        executionResult.result,
        fieldKeys,
        checks,
      );
      const cleared = fields.every((field) => field.cleared);

      report = { attempts: attempt, cleared, fields };

      if (cleared) {
        return { executionResult, report };
      }

      prompt = buildOutputValidationRepairPrompt(
        userPrompt,
        executionResult.result,
        fields,
      );
    }

    return { executionResult, report };
  }

  async judgeDraft(
    result: object,
    fieldKeys: string[],
    rawChecks?: AiAgentOutputValidationCheck[],
  ): Promise<AiAgentOutputValidationFieldResult[]> {
    const checks = resolveOutputValidationChecks(rawChecks);
    const scanned = scanOutputFields(result, fieldKeys);

    if (scanned.jevFields.length === 0) {
      return scanned.fields;
    }

    if (checks.length === 0) {
      return scanned.fields.map((field) =>
        field.skipped || field.codeFailure
          ? field
          : { ...field, cleared: true },
      );
    }

    const answers = await this.evaluate(scanned.jevFields, checks);

    return applyJevNouls(scanned.fields, answers, checks);
  }

  private async evaluate(
    jevFields: Array<{ fieldKey: string; channel: string; text: string }>,
    checks: AiAgentOutputValidationCheck[],
  ): Promise<Record<string, { type?: string; noul?: number }>> {
    const apiKey = this.twentyConfigService.get('OPENROUTER_API_KEY')?.trim();

    if (!isDefined(apiKey) || apiKey === '') {
      throw new Error(
        'OPENROUTER_API_KEY is required to validate AI agent output with Jev.',
      );
    }

    const requestBody = buildJevOutputValidationRequest(jevFields, checks);
    const response = await fetch(JEV_DECISIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();

      this.logger.error(
        `Jev output validation failed (${response.status}): ${errorText}`,
      );

      throw new Error(
        `Jev output validation failed with status ${response.status}`,
      );
    }

    const body = (await response.json()) as JevDecisionsResponse;

    if (!isDefined(body.answers)) {
      throw new Error('Jev output validation returned no answers');
    }

    for (const field of jevFields) {
      for (const check of checks) {
        const questionId = `${field.fieldKey}__${check.id}`;
        const answer = body.answers[questionId];

        if (answer?.type !== 'noul' || typeof answer.noul !== 'number') {
          throw new Error(
            `Jev output validation missing noul answer for ${questionId}`,
          );
        }
      }
    }

    return body.answers;
  }
}
