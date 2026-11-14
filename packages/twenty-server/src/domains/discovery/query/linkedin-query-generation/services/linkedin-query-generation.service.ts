import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import OpenAI from 'openai';
import { toOpenAiJsonSchemaResponseFormat } from 'src/engine/core-modules/llm-chat-model/utils/to-openai-json-schema-format.util';
import { z } from 'zod';

import {
  PythonQueryGenerationService,
  type PythonQueryInput,
} from 'src/domains/discovery/query/python-query-generation.service';
import { StreamProcessingService } from 'src/engine/core-modules/llm-chat-model/services/stream-processing.service';
import {
  AGENT1_SYSTEM_PROMPT,
  buildAgent1UserPrompt,
} from 'src/domains/discovery/query/linkedin-query-generation/prompts/agent1-parser.prompt';
import { agent1ParserSchema } from 'src/domains/discovery/query/linkedin-query-generation/schemas';
import {
  OrchestratorResult,
  ParsedRequirement,
} from 'src/domains/discovery/query/linkedin-query-generation/types/linkedin-query-generation.types';
import { applyParsedRequirementToQuerySet } from 'src/domains/discovery/query/linkedin-query-generation/utils/apply-parsed-requirement.util';

type LlmOptions = {
  model?: string;
  temperature?: number;
  verbose?: boolean;
  queryIpLocation?: string;
  streaming?: boolean;
  sendEvent?: (event: string, data: Record<string, unknown>) => void;
};

// What the Python compiler needs from the parse: who, where and at which
// employers. Everything else in the requirement is folded onto the query set
// afterwards.
export const toPythonQueryInput = (
  requirement: ParsedRequirement,
): PythonQueryInput => {
  const title = requirement.position_title?.trim();
  const locations = (requirement.location ?? [])
    .map((location) => location.trim())
    .filter((location) => location.length > 0);

  return {
    company_names: (requirement.target_companies ?? [])
      .map((company) => company.trim())
      .filter((company) => company.length > 0),
    ...(title ? { raw_job_titles: [title] } : {}),
    ...(locations.length > 0 ? { locations } : {}),
  };
};

// The requirement is parsed by one LLM call; the query is built by the Python
// compiler, which is the only place query text and term limits are decided.
@Injectable()
export class LinkedinQueryGenerationService {
  private readonly logger = new Logger(LinkedinQueryGenerationService.name);
  private readonly defaultModel =
    process.env.SEARCH_QUERY_GENERATOR_MODEL ||
    process.env.SEARCH_MODELS_OPENAI_MODEL ||
    'gpt-6-luna';

  constructor(
    private readonly pythonQueryGenerationService: PythonQueryGenerationService,
    @Optional()
    private readonly streamProcessingService: StreamProcessingService | null,
  ) {}

  async runAgent1(
    rawRequirement: string,
    options?: LlmOptions,
  ): Promise<ParsedRequirement> {
    console.log(`Running Agent 1 with raw requirement: ${rawRequirement}`);
    const systemPrompt = AGENT1_SYSTEM_PROMPT;
    const userPrompt = buildAgent1UserPrompt(
      rawRequirement,
      options?.queryIpLocation,
    );

    if (options?.verbose) {
      console.log('[LinkedinQueryGeneration] Agent 1 - Input:', {
        rawRequirement,
        queryIpLocation: options?.queryIpLocation,
      });
      console.log(
        '[LinkedinQueryGeneration] Agent 1 - System Prompt:',
        systemPrompt,
      );
      console.log(
        '[LinkedinQueryGeneration] Agent 1 - User Prompt:',
        userPrompt,
      );
    }

    const response = await this.callLlm(systemPrompt, userPrompt, options, {
      schema: agent1ParserSchema,
      name: 'agent1Parser',
    });

    const parsed = response as ParsedRequirement;

    if (options?.verbose) {
      console.log(
        '[LinkedinQueryGeneration] Agent 1 - Output:',
        JSON.stringify(parsed, null, 2),
      );
    }

    return parsed;
  }

  async generateSearchQuerySet(
    rawRequirement: string,
    options?: LlmOptions,
  ): Promise<OrchestratorResult> {
    const startTime = Date.now();
    const sendEvent = options?.sendEvent;

    sendEvent?.('status', { message: 'Parsing requirement...' });

    const parsedRequirement = await this.runAgent1(rawRequirement, options);
    const agent1Time = Date.now() - startTime;

    sendEvent?.('message', {
      type: 'parsed_requirement',
      data: parsedRequirement,
    });
    sendEvent?.('status', { message: 'Building search queries...' });

    const generated = await this.pythonQueryGenerationService.generateQuerySet(
      toPythonQueryInput(parsedRequirement),
    );
    const { querySet, dropped } = applyParsedRequirementToQuerySet(
      generated,
      parsedRequirement,
    );

    if (dropped.length > 0) {
      this.logger.warn(
        `Requirement terms that did not fit the keyword budget: ${dropped.join(', ')}`,
      );
    }

    sendEvent?.('status', {
      message: `Generated ${querySet.search_query_set.length} search quer${querySet.search_query_set.length === 1 ? 'y' : 'ies'}`,
    });
    sendEvent?.('message', { type: 'query_set', data: querySet });

    return {
      parsed_requirement: parsedRequirement,
      final_query_set: querySet,
      dropped_requirement_terms: dropped,
      metadata: {
        processing_time_ms: Date.now() - startTime,
        agent1_time_ms: agent1Time,
        total_queries_generated: querySet.search_query_set.length,
      },
    };
  }

  async generateSearchQuerySetBatch(
    requirements: string[],
    options?: LlmOptions & { verbose?: boolean; parallel?: boolean },
  ): Promise<OrchestratorResult[]> {
    if (options?.parallel) {
      return Promise.all(
        requirements.map((requirement) =>
          this.generateSearchQuerySet(requirement, {
            ...options,
            verbose: false,
          }),
        ),
      );
    }

    const results: OrchestratorResult[] = [];
    for (const requirement of requirements) {
      const result = await this.generateSearchQuerySet(requirement, options);
      results.push(result);
    }

    return results;
  }

  private async callLlm<T>(
    systemPrompt: string,
    userPrompt: string,
    options: LlmOptions | undefined,
    schemaOption: { schema: z.ZodType<T>; name: string },
  ): Promise<T> {
    const openai = this.createOpenAiClient();
    const { schema, name } = schemaOption;
    const shouldStream = options?.streaming && options?.sendEvent;

    // When streaming, reuse StreamProcessingService when available (retries, timeout, event shape for assistant frontend)
    if (shouldStream) {
      const model = options?.model || this.defaultModel;
      const temperature = options?.temperature ?? 0;
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      if (this.streamProcessingService) {
        const streamFactory = async () =>
          openai.chat.completions.create({
            model,
            temperature,
            messages,
            stream: true,
            response_format: toOpenAiJsonSchemaResponseFormat(schema, name),
          });

        const { content: accumulatedContent } =
          await this.streamProcessingService.executeStreamingLlmCall(
            streamFactory,
            {
              sendEvent: options.sendEvent,
              chunkEventName: 'text',
              chunkPayloadKey: 'delta',
            },
          );

        if (!accumulatedContent?.trim()) {
          throw new HttpException(
            'Empty response received from LLM',
            HttpStatus.BAD_GATEWAY,
          );
        }

        const raw = this.parseJson(accumulatedContent);
        return schema.parse(raw) as T;
      }

      // Fallback when StreamProcessingService not injected (e.g. standalone LinkedinQueryGenerationModule)
      const stream = await openai.chat.completions.create({
        model,
        temperature,
        messages,
        stream: true,
        response_format: toOpenAiJsonSchemaResponseFormat(schema, name),
      });
      let accumulatedContent = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          accumulatedContent += delta;
          options.sendEvent?.('text', { delta });
        }
      }
      if (!accumulatedContent.trim()) {
        throw new HttpException(
          'Empty response received from LLM',
          HttpStatus.BAD_GATEWAY,
        );
      }
      const raw = this.parseJson(accumulatedContent);
      return schema.parse(raw) as T;
    }

    // Non-streaming path
    const model = options?.model || this.defaultModel;
    const temperature = options?.temperature ?? 0;

    // Only some models support `response_format: { type: "json_schema" }`.
    // For models that don't (e.g. gpt-3.5-turbo), fall back to plain JSON-in-text parsing.
    // const supportsStructuredOutputs = !/^gpt-3\.5/i.test(model);

    const completion = await openai.chat.completions.create({
      model,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: toOpenAiJsonSchemaResponseFormat(schema, name),
      // ...(supportsStructuredOutputs
      //   ? { response_format: toOpenAiJsonSchemaResponseFormat(schema, name) }
      //   : {}),
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new HttpException(
        'Empty response received from LLM',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const raw = this.parseJson(content);
    return schema.parse(raw) as T;
  }

  private parseJson(content: string): unknown {
    const cleaned = content
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch (error) {
      this.logger.error('Failed to parse LLM response as JSON', {
        error,
        response: cleaned,
      });
      throw new HttpException(
        'Invalid JSON returned from LLM',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private createOpenAiClient(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new HttpException(
        'OPENAI_API_KEY is not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return new OpenAI({ apiKey });
  }
}
