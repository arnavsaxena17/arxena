import {
  Inject,
  Injectable,
  Logger,
  Optional,
  forwardRef,
} from '@nestjs/common';

import { Sema } from 'async-sema';
import { OpenAI } from 'openai';

import { ArxWebSearchService } from 'src/engine/core-modules/arx-web-search/arx-web-search.service';
import {
  resolveProviderConcurrency,
  resolveSonarSpillMs,
  resolveWebSearchProviderChain,
  type WebSearchProviderId,
} from 'src/engine/core-modules/arx-web-search/utils/web-search-provider-chain.util';
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
// Rows in flight for a web lookup. Each provider has its own, lower limit, so
// this only has to be wide enough to keep every provider of the chain busy.
const DEFAULT_WEB_CONCURRENCY = 32;
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

// An extraction counts as answered when at least one field holds a real value;
// all-empty output means the SERP evidence did not contain the answer.
const hasSubstantiveAnswer = (content: string): boolean => {
  try {
    const parsed = JSON.parse(content) as {
      results?: Array<Record<string, unknown>>;
    };

    return (parsed.results ?? []).some((result) =>
      Object.entries(result).some(
        ([key, value]) =>
          key !== 'id' &&
          (typeof value === 'boolean' ||
            typeof value === 'number' ||
            (typeof value === 'string' &&
              value.trim() !== '' &&
              value.trim().toLowerCase() !== 'unknown')),
      ),
    );
  } catch {
    return false;
  }
};

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
  private readonly providerLimiters = new Map<WebSearchProviderId, Sema>();

  constructor(
    private readonly jevEvaluationService: JevEvaluationService,
    // Cheap Google-SERP lookup used before the paid OpenAI web search tool
    @Optional()
    @Inject(forwardRef(() => ArxWebSearchService))
    private readonly arxWebSearchService?: ArxWebSearchService,
  ) {}

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
      groundedSearches: 0,
      groundedSearchCostUsd: 0,
      webSearchProviders: {},
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

  private buildResponseSchema(fields: FilterFieldSpec[], allowUnknown = false) {
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
        stats.webSearchCalls * WEB_SEARCH_CALL_USD +
        stats.groundedSearchCostUsd
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
      const grounded = await this.completeFromProviderChain({
        system,
        user,
        spec,
        stats,
        schema,
      });

      if (grounded !== undefined) {
        return grounded;
      }

      const response = await this.withProviderLimit('openai', () =>
        this.getOpenAiClient().responses.create({
          model: stats.model,
          instructions: system,
          input: user,
          // low context keeps each search at the cheapest price tier
          tools: [{ type: 'web_search_preview', search_context_size: 'low' }],
          text: {
            format: {
              type: 'json_schema',
              name: 'filter_results',
              strict: true,
              schema,
            },
          },
        }),
      );

      stats.inputTokens += response.usage?.input_tokens ?? 0;
      stats.outputTokens += response.usage?.output_tokens ?? 0;
      stats.webSearchCalls += response.output.filter(
        (item) => item.type === 'web_search_call',
      ).length;
      this.countProviderAnswer(stats, 'openai');

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

  private countProviderAnswer(
    stats: FilterRunStats,
    provider: WebSearchProviderId,
  ) {
    stats.webSearchProviders[provider] =
      (stats.webSearchProviders[provider] ?? 0) + 1;
  }

  // One limiter per provider, shared by every run in this process, so a big
  // column can keep SERP busy without flooding Sonar or the paid OpenAI tool.
  private withProviderLimit<TResult>(
    provider: WebSearchProviderId,
    task: () => Promise<TResult>,
  ): Promise<TResult> {
    let limiter = this.providerLimiters.get(provider);

    if (!limiter) {
      limiter = new Sema(resolveProviderConcurrency(provider));
      this.providerLimiters.set(provider, limiter);
    }

    const guard = limiter;

    return (async () => {
      await guard.acquire();

      try {
        return await task();
      } finally {
        guard.release();
      }
    })();
  }

  // Walks the provider chain (ARX_WEB_SEARCH_PROVIDERS, default perplexity,
  // serp, openai). A step that gives nothing usable (not configured, failed,
  // or evidence without an answer) hands the record to the next one. Returns
  // undefined to let the caller run the paid OpenAI web search, and an empty
  // result, an unanswered record, when the chain ends without "openai".
  private async completeFromProviderChain(input: {
    system: string;
    user: string;
    spec: FilterSpec;
    stats: FilterRunStats;
    schema: Record<string, unknown>;
  }): Promise<string | undefined> {
    for (const provider of resolveWebSearchProviderChain()) {
      if (provider === 'openai') {
        return undefined;
      }

      const answer =
        provider === 'perplexity'
          ? await this.completeFromSonar(input)
          : await this.completeFromSearchEvidence(input);

      if (answer !== undefined) {
        this.countProviderAnswer(input.stats, provider);

        return answer;
      }
    }

    return JSON.stringify({ results: [] });
  }

  // Perplexity Sonar: live web search and the structured answer in one call.
  private async completeFromSonar({
    system,
    user,
    stats,
    schema,
  }: {
    system: string;
    user: string;
    stats: FilterRunStats;
    schema: Record<string, unknown>;
  }): Promise<string | undefined> {
    const webSearch = this.arxWebSearchService;

    if (!webSearch?.isStructuredAvailable()) {
      return undefined;
    }

    // Sonar is paced to the key's rate limit; past this much queue the lookup
    // goes to the next provider instead of waiting (off unless configured).
    const spillMs = resolveSonarSpillMs();

    if (spillMs > 0 && (webSearch.sonarBacklogMs ?? 0) > spillMs) {
      return undefined;
    }

    const sonar = await this.withProviderLimit('perplexity', () =>
      webSearch.completeStructured({
        system: `${system}\n\nAnswer from live web search about the exact record: match its name and, when given, its domain. If only a similarly named, usually bigger, company matches, that is not the record: answer as if nothing was found. Prefer the most recent figure. When no credible answer exists, leave the field empty (null for numbers, "unknown" for text and lists). Never guess.`,
        user,
        schema,
      }),
    );

    if (sonar === null) {
      return undefined;
    }

    stats.groundedSearches += 1;
    stats.groundedSearchCostUsd += sonar.costUsd;
    stats.inputTokens += sonar.inputTokens;
    stats.outputTokens += sonar.outputTokens;

    // Valid schema JSON, empty values included: "no credible answer" is an
    // answer, not a failure, and trying another search would cost more.
    return sonar.content;
  }

  // Cheap web lookup: write one search query, fetch a Google SERP and extract
  // the answer from it with a strict-schema chat call. Returns undefined when
  // the search gave nothing usable or the evidence held no answer.
  private async completeFromSearchEvidence({
    system,
    user,
    spec,
    stats,
    schema,
  }: {
    system: string;
    user: string;
    spec: FilterSpec;
    stats: FilterRunStats;
    schema: Record<string, unknown>;
  }): Promise<string | undefined> {
    const webSearch = this.arxWebSearchService;

    if (!webSearch?.isSerpAvailable()) {
      return undefined;
    }

    try {
      const query = await this.writeSearchQuery({ user, spec, stats });
      const evidence = await this.withProviderLimit('serp', () =>
        webSearch.search(query, { serpOnly: true }),
      );

      if (evidence === null) {
        return undefined;
      }

      stats.groundedSearches += 1;
      stats.groundedSearchCostUsd += evidence.costUsd;

      const completion = await this.getOpenAiClient().chat.completions.create({
        model: stats.model,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: `${system}\n\nAnswer only from the WEB EVIDENCE below, which is web search output for the query "${evidence.query}". Prefer the most recent figure. When the evidence holds no credible answer, leave the field empty (null for numbers, "unknown" for text and lists). Never guess.`,
          },
          {
            role: 'user',
            content: `${user}\n\nWEB EVIDENCE\n${evidence.text}`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'filter_results', strict: true, schema },
        },
      });

      stats.inputTokens += completion.usage?.prompt_tokens ?? 0;
      stats.outputTokens += completion.usage?.completion_tokens ?? 0;

      const content = completion.choices[0]?.message?.content;

      return content && hasSubstantiveAnswer(content) ? content : undefined;
    } catch (error) {
      this.logger.warn(
        `Search-grounded lookup failed, trying the next provider: ${error instanceof Error ? error.message : String(error)}`,
      );

      return undefined;
    }
  }

  private async writeSearchQuery({
    user,
    spec,
    stats,
  }: {
    user: string;
    spec: FilterSpec;
    stats: FilterRunStats;
  }): Promise<string> {
    const completion = await this.getOpenAiClient().chat.completions.create({
      model: stats.model,
      temperature: 0,
      max_tokens: 40,
      messages: [
        {
          role: 'system',
          content:
            'Write one Google search query of at most 12 words that would surface the answer to the task for the record. Name the company or person explicitly. Reply with the query only.',
        },
        { role: 'user', content: `Task:\n${spec.criteria.trim()}\n\n${user}` },
      ],
    });

    stats.inputTokens += completion.usage?.prompt_tokens ?? 0;
    stats.outputTokens += completion.usage?.completion_tokens ?? 0;

    return (completion.choices[0]?.message?.content ?? '')
      .replace(/^["'\s]+|["'\s]+$/g, '')
      .slice(0, 200);
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
