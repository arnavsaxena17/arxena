import { Injectable, Logger } from '@nestjs/common';

import { Sema } from 'async-sema';
import { OpenAI } from 'openai';

import {
  buildVerdict,
  failedVerdict,
  getRequiredFields,
  type FilterFieldSpec,
  type FilterRunStats,
  type FilterSpec,
  type RecordVerdict,
} from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-contract';
import {
  buildInstructions,
  buildRecordText,
  describeField,
} from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-prompt';
import { JevEvaluationService } from 'src/engine/metadata-modules/ai/ai-evaluation/services/jev-evaluation.service';
import { isJevModelId } from 'src/engine/metadata-modules/ai/ai-evaluation/utils/is-jev-model-id.util';
import { mapJevAnswersToRecord } from 'src/engine/metadata-modules/ai/ai-evaluation/utils/map-jev-answers-to-record.util';
import { type JevQuestions } from 'src/engine/metadata-modules/ai/ai-evaluation/types/jev-evaluation.type';

export type FilterRecord = { id: string } & Record<string, unknown>;

export const DEFAULT_FILTER_CONCURRENCY = 20;
export const DEFAULT_FILTER_BATCH_SIZE = 10;
const MAX_CONCURRENCY = 100;
const MAX_BATCH_SIZE = 25;
const OPENAI_ATTEMPTS = 4;
const OPENAI_FALLBACK_MODEL = 'gpt-4o-mini';
const DEFAULT_WEB_CONCURRENCY = 8;
const WEB_SEARCH_CALL_USD = 0.025;

// USD per 1M tokens (input, output).
const PRICE_PER_MILLION_TOKENS: Record<string, [number, number]> = {
  'gpt-4o-mini': [0.15, 0.6],
  'gpt-4o': [2.5, 10],
};

const OPENAI_MODEL_ALIASES: Record<string, string> = {
  gpt35turbo: 'gpt-3.5-turbo',
  gpt51chatlatest: 'gpt-4o-mini',
  gpt54mini: 'gpt-5.4-mini',
  gpt4o: 'gpt-4o',
  gpt4omini: 'gpt-4o-mini',
  // Web search runs on gpt-4o-mini through the Responses API web_search tool.
  gpt4ominisearchpreview: 'gpt-4o-mini',
};

const clamp = (value: number | undefined, fallback: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 1
    ? Math.min(Math.floor(value), max)
    : fallback;

// A drained OpenAI balance answers 429 too, but waiting never helps.
export const isQuotaExhaustedError = (error: unknown): boolean => {
  const code = (error as { code?: string } | null)?.code;

  return code === 'insufficient_quota' || code === 'credit_balance_exhausted';
};

const isRetryable = (error: unknown): boolean => {
  if (isQuotaExhaustedError(error)) {
    return false;
  }

  const status = (error as { status?: number } | null)?.status;

  return (
    status === 429 ||
    (typeof status === 'number' && status >= 500) ||
    status === undefined
  );
};

const isRateLimit = (error: unknown): boolean =>
  (error as { status?: number } | null)?.status === 429;

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

@Injectable()
export class AiFilterEngineService {
  private readonly logger = new Logger(AiFilterEngineService.name);
  private openAiClient: OpenAI | null = null;

  constructor(private readonly jevEvaluationService: JevEvaluationService) {}

  // jev only answers boolean / enum questions. A filter whose required fields
  // are all boolean / enum can use it; otherwise, or when jev has no key, the
  // OpenAI adapter answers the same contract.
  resolveEngine(spec: FilterSpec): 'jev' | 'openai' {
    const required = getRequiredFields(spec.fields);
    const jevCompatible =
      required.length > 0 &&
      required.every(
        (field) =>
          field.type === 'boolean' ||
          (field.type === 'enum' && (field.enumValues?.length ?? 0) >= 2),
      );

    return spec.webSearch !== true &&
      isJevModelId(spec.model) &&
      this.jevEvaluationService.isConfigured() &&
      jevCompatible
      ? 'jev'
      : 'openai';
  }

  async run(
    records: FilterRecord[],
    spec: FilterSpec,
  ): Promise<{ verdicts: RecordVerdict[]; stats: FilterRunStats }> {
    const startedAt = Date.now();
    const engine = this.resolveEngine(spec);
    const stats: FilterRunStats = {
      engine,
      model:
        engine === 'jev' ? spec.model : this.resolveOpenAiModel(spec.model),
      calls: 0,
      retriedRecords: 0,
      durationMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      webSearchCalls: 0,
      estimatedCostUsd: null,
    };
    const semaphore = new Sema(
      clamp(
        spec.concurrency,
        spec.webSearch === true
          ? DEFAULT_WEB_CONCURRENCY
          : DEFAULT_FILTER_CONCURRENCY,
        MAX_CONCURRENCY,
      ),
    );
    const byId = new Map<string, RecordVerdict>();

    const guarded = async <TResult>(task: () => Promise<TResult>) => {
      await semaphore.acquire();

      try {
        return await task();
      } finally {
        semaphore.release();
      }
    };

    if (engine === 'jev') {
      await Promise.all(
        records.map((record) =>
          guarded(async () => {
            stats.calls += 1;
            byId.set(record.id, await this.askJev(record, spec));
          }),
        ),
      );
    } else {
      // A web lookup is about one entity, so it is never batched.
      const batchSize =
        spec.webSearch === true
          ? 1
          : clamp(spec.batchSize, DEFAULT_FILTER_BATCH_SIZE, MAX_BATCH_SIZE);
      const batches: FilterRecord[][] = [];

      for (let index = 0; index < records.length; index += batchSize) {
        batches.push(records.slice(index, index + batchSize));
      }

      await Promise.all(
        batches.map((batch) =>
          guarded(async () => {
            stats.calls += 1;
            const answered = await this.askOpenAiBatch(batch, spec, stats);

            for (const [id, verdict] of answered) {
              byId.set(id, verdict);
            }
          }),
        ),
      );

      // Records the batch call did not answer validly get one single-record
      // retry, so one bad row never costs the whole batch.
      // Exhausted credits fail every call the same way, so no retry.
      const retry = records.filter((record) => {
        const verdict = byId.get(record.id);

        return (
          verdict?.status !== 'answered' &&
          verdict?.error?.includes('credits are exhausted') !== true
        );
      });

      if (batchSize > 1 && retry.length > 0) {
        stats.retriedRecords = retry.length;

        await Promise.all(
          retry.map((record) =>
            guarded(async () => {
              stats.calls += 1;
              const answered = await this.askOpenAiBatch([record], spec, stats);
              const verdict = answered.get(record.id);

              if (verdict) {
                byId.set(record.id, verdict);
              }
            }),
          ),
        );
      }
    }

    stats.durationMs = Date.now() - startedAt;
    stats.estimatedCostUsd =
      engine === 'jev' ? null : this.estimateCostUsd(stats);

    return {
      verdicts: records.map(
        (record) =>
          byId.get(record.id) ??
          failedVerdict(record.id, 'No answer from the filter model'),
      ),
      stats,
    };
  }

  protected getOpenAiClient(): OpenAI {
    if (!this.openAiClient) {
      const apiKey =
        process.env.OPENAI_API_KEY?.trim() || process.env.OPENAI_KEY?.trim();

      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required for the AI filter.');
      }

      this.openAiClient = new OpenAI({ apiKey });
    }

    return this.openAiClient;
  }

  private resolveOpenAiModel(model: string): string {
    if (isJevModelId(model)) {
      return OPENAI_FALLBACK_MODEL;
    }

    return OPENAI_MODEL_ALIASES[model] ?? model ?? OPENAI_FALLBACK_MODEL;
  }

  private async askJev(
    record: FilterRecord,
    spec: FilterSpec,
  ): Promise<RecordVerdict> {
    try {
      const instructions = buildInstructions(spec);
      const questions: JevQuestions = {};

      for (const field of getRequiredFields(spec.fields)) {
        const instruction = `${instructions}\n\nDecide "${field.name}"${field.description ? `: ${field.description}` : '.'}`;

        questions[field.name] =
          field.type === 'boolean'
            ? { type: 'boolean', instructions: instruction }
            : {
                type: 'choice',
                instructions: instruction,
                criteria: Object.fromEntries(
                  (field.enumValues ?? []).map((value) => [value, value]),
                ),
              };
      }

      const result = await this.jevEvaluationService.evaluate({
        state: {
          instructions,
          candidate: buildRecordText(record, spec.metadataFields),
        },
        questions,
      });

      return buildVerdict({
        id: record.id,
        raw: mapJevAnswersToRecord(result.answers),
        spec,
      });
    } catch (error) {
      return failedVerdict(
        record.id,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private buildResponseSchema(
    fields: FilterFieldSpec[],
    allowUnknown = false,
  ) {
    const properties: Record<string, Record<string, unknown>> = {
      id: { type: 'string' },
    };

    for (const field of fields) {
      properties[field.name] =
        field.type === 'boolean'
          ? { type: 'boolean' }
          : field.type === 'integer'
            ? { type: ['integer', 'null'] }
            : field.type === 'number'
              ? { type: ['number', 'null'] }
              : field.type === 'enum'
                ? {
                    type: 'string',
                    enum: [
                      ...(field.enumValues ?? []),
                      ...(allowUnknown ? ['unknown'] : []),
                    ],
                  }
                : { type: 'string' };
    }

    return {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties,
            required: Object.keys(properties),
            additionalProperties: false,
          },
        },
      },
      required: ['results'],
      additionalProperties: false,
    };
  }

  private estimateCostUsd(stats: FilterRunStats): number {
    const [inputPrice, outputPrice] =
      PRICE_PER_MILLION_TOKENS[stats.model] ??
      PRICE_PER_MILLION_TOKENS[OPENAI_FALLBACK_MODEL];

    return Number(
      (
        (stats.inputTokens * inputPrice + stats.outputTokens * outputPrice) /
          1_000_000 +
        stats.webSearchCalls * WEB_SEARCH_CALL_USD
      ).toFixed(6),
    );
  }

  // One model call. With web search it goes through the Responses API and its
  // web_search tool; otherwise through strict-schema chat completions. Token
  // and web-search usage are added to the run stats either way.
  private async completeOnce({
    system,
    user,
    spec,
    stats,
  }: {
    system: string;
    user: string;
    spec: FilterSpec;
    stats: FilterRunStats;
  }): Promise<string | null | undefined> {
    const schema = this.buildResponseSchema(
      spec.fields,
      spec.allowUnknown === true,
    );

    if (spec.webSearch === true) {
      const response = await this.getOpenAiClient().responses.create({
        model: stats.model,
        instructions: system,
        input: user,
        tools: [{ type: 'web_search_preview' }],
        text: {
          format: {
            type: 'json_schema',
            name: 'filter_results',
            strict: true,
            schema,
          },
        },
      });

      stats.inputTokens += response.usage?.input_tokens ?? 0;
      stats.outputTokens += response.usage?.output_tokens ?? 0;
      stats.webSearchCalls += response.output.filter(
        (item) => item.type === 'web_search_call',
      ).length;

      return response.output_text;
    }

    const completion = await this.getOpenAiClient().chat.completions.create({
      model: stats.model,
      temperature: 0,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'filter_results', strict: true, schema },
      },
    });

    stats.inputTokens += completion.usage?.prompt_tokens ?? 0;
    stats.outputTokens += completion.usage?.completion_tokens ?? 0;

    return completion.choices[0]?.message?.content;
  }

  // Strict structured output: the API itself guarantees booleans and enum
  // values, so the model cannot invent a label outside the contract.
  private async askOpenAiBatch(
    batch: FilterRecord[],
    spec: FilterSpec,
    stats: FilterRunStats,
  ): Promise<Map<string, RecordVerdict>> {
    const answered = new Map<string, RecordVerdict>();
    const system = [
      buildInstructions(spec),
      `Answer every record below with these fields:\n${spec.fields.map((field) => describeField(field, spec.allowUnknown === true)).join('\n')}`,
      'Return one result per record and echo its id exactly.',
    ].join('\n\n');
    const user = batch
      .map(
        (record) =>
          `RECORD ${record.id}\n${buildRecordText(record, spec.metadataFields)}`,
      )
      .join('\n\n---\n\n');

    for (let attempt = 1; attempt <= OPENAI_ATTEMPTS; attempt++) {
      try {
        const content = await this.completeOnce({ system, user, spec, stats });
        const parsed = content
          ? (JSON.parse(content) as {
              results?: Array<Record<string, unknown>>;
            })
          : null;

        for (const result of parsed?.results ?? []) {
          const id = typeof result.id === 'string' ? result.id : '';

          if (batch.some((record) => record.id === id)) {
            answered.set(id, buildVerdict({ id, raw: result, spec }));
          }
        }

        return answered;
      } catch (error) {
        if (attempt === OPENAI_ATTEMPTS || !isRetryable(error)) {
          const message = isQuotaExhaustedError(error)
            ? 'OpenAI credits are exhausted (credit_balance_exhausted). Top up the OpenAI account and run again.'
            : error instanceof Error
              ? error.message
              : String(error);

          this.logger.warn(`AI filter OpenAI call failed: ${message}`);

          for (const record of batch) {
            answered.set(record.id, failedVerdict(record.id, message));
          }

          return answered;
        }

        const baseMs = isRateLimit(error) ? 4000 : 1000;

        await sleep(2 ** (attempt - 1) * baseMs + Math.random() * 500);
      }
    }

    return answered;
  }
}
