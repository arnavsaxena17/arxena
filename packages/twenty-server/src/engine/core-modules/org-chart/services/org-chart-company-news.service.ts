import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

import { CreditsService } from 'src/engine/core-modules/billing/services/credits.service';
import { BrightDataBillingService } from 'src/engine/core-modules/bright-data/services/ludicrous/bright-data-billing.service';
import { BrightDataSerpService } from 'src/engine/core-modules/bright-data/services/bright-data-serp.service';
import { toOpenAiResponsesJsonSchemaFormat } from 'src/engine/core-modules/llm-chat-model/utils/to-openai-json-schema-format.util';
import { NATIVE_WEB_SEARCH_COST_PER_CALL_DOLLARS } from 'src/engine/metadata-modules/ai/ai-billing/constants/native-web-search-cost-per-call-dollars';
import {
  COMPANY_NEWS_DEVELOPER_PROMPT,
  buildCompanyNewsUserPrompt,
} from '../prompts/company-news.prompt';
import {
  companyNewsFetchRecordSchema,
  companyNewsLlmResultSchema,
  companyNewsSourceSchema,
  companyNewsStorageSchema,
  type CompanyNewsItem,
  type CompanyNewsLlmResult,
  type CompanyNewsSource,
  type CompanyNewsStorage,
} from '../schemas/company-news.schema';
import {
  buildCompanyNewsSearchQuery,
  mapBrightDataNewsToCompanyNewsResult,
} from '../utils/map-bright-data-news-to-company-news.util';
import { OrgChartS3Service } from './orgchart-s3.service';

const COMPANY_NEWS_MODEL = 'gpt-5.4-nano';
const DEFAULT_COMPANY_NEWS_SOURCE: CompanyNewsSource = 'bright_data';

@Injectable()
export class OrgChartCompanyNewsService {
  private readonly logger = new Logger(OrgChartCompanyNewsService.name);

  constructor(
    private readonly orgChartS3Service: OrgChartS3Service,
    private readonly brightDataSerpService: BrightDataSerpService,
    private readonly brightDataBillingService: BrightDataBillingService,
    private readonly creditsService: CreditsService,
  ) {}

  private createOpenAiClient(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY;
    if (!apiKey?.trim()) {
      throw new HttpException(
        'OpenAI API key is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return new OpenAI({ apiKey });
  }

  async getStoredCompanyNews(
    companyId: string,
  ): Promise<CompanyNewsStorage | null> {
    const raw = await this.orgChartS3Service.getCompanyNews(companyId);
    if (!raw) {
      return null;
    }
    return companyNewsStorageSchema.parse(raw);
  }

  async fetchAndStoreCompanyNews(input: {
    companyId: string;
    companyName: string;
    location?: string;
    source?: CompanyNewsSource;
    workspaceId?: string;
    userWorkspaceId?: string | null;
  }): Promise<CompanyNewsStorage> {
    const companyId = input.companyId.trim();
    const companyName = input.companyName.trim() || companyId;
    const location = input.location?.trim();
    const source = this.resolveSource(input.source);
    const workspaceId = input.workspaceId?.trim() || undefined;

    this.logger.log(
      `Fetching company news for companyId=${companyId} companyName="${companyName}" location="${location ?? ''}" source=${source}`,
    );

    if (workspaceId !== undefined && source === 'bright_data') {
      await this.brightDataBillingService.validateCreditsOrThrow(workspaceId);
    }

    if (workspaceId !== undefined && source === 'openai') {
      await this.creditsService.assertCanSpend({
        workspaceId,
        feature: 'AI_WEB_SEARCH',
      });
    }

    const { result: llmResult, source: usedSource } =
      await this.fetchCompanyNews({
        companyName,
        location,
        source,
      });
    const fetchedAt = new Date().toISOString();
    const fetchRecord = companyNewsFetchRecordSchema.parse({
      fetchedAt,
      source: usedSource,
      result: llmResult,
    });

    const existing = await this.getStoredCompanyNews(companyId);
    const nextStorage = companyNewsStorageSchema.parse({
      companyId,
      companyName,
      location: location || llmResult.location || existing?.location,
      updatedAt: fetchedAt,
      fetches: [...(existing?.fetches ?? []), fetchRecord],
    });

    await this.orgChartS3Service.saveCompanyNews(companyId, nextStorage);

    if (workspaceId !== undefined) {
      await this.billCompanyNewsFetch({
        workspaceId,
        companyId,
        usedSource,
        userWorkspaceId: input.userWorkspaceId,
      });
    }

    this.logger.log(
      `Saved company news to S3 for companyId=${companyId} fetchCount=${nextStorage.fetches.length} source=${usedSource}`,
    );

    return nextStorage;
  }

  mergeNewsItemsFromStorage(
    storage: CompanyNewsStorage | null | undefined,
  ): Array<CompanyNewsItem & { fetchedAt: string }> {
    if (!storage?.fetches?.length) {
      return [];
    }

    const byUrl = new Map<string, CompanyNewsItem & { fetchedAt: string }>();
    const orderedFetches = [...storage.fetches].sort((a, b) =>
      b.fetchedAt.localeCompare(a.fetchedAt),
    );

    for (const fetchRecord of orderedFetches) {
      for (const item of fetchRecord.result.news_items) {
        const url = item.url.trim();
        if (!url || byUrl.has(url)) {
          continue;
        }
        byUrl.set(url, {
          ...item,
          fetchedAt: fetchRecord.fetchedAt,
        });
      }
    }

    return Array.from(byUrl.values());
  }

  private async billCompanyNewsFetch(input: {
    workspaceId: string;
    companyId: string;
    usedSource: CompanyNewsSource;
    userWorkspaceId?: string | null;
  }): Promise<void> {
    if (input.usedSource === 'bright_data') {
      await this.brightDataBillingService.billSerpRequest({
        workspaceId: input.workspaceId,
        resourceContext: 'company_news',
        resourceId: input.companyId,
        userWorkspaceId: input.userWorkspaceId,
      });

      return;
    }

    await this.creditsService.record({
      workspaceId: input.workspaceId,
      feature: 'AI_WEB_SEARCH',
      quantity: 1,
      providerCostUsd: NATIVE_WEB_SEARCH_COST_PER_CALL_DOLLARS,
      userWorkspaceId: input.userWorkspaceId ?? null,
      resourceId: input.companyId,
      resourceContext: 'company_news',
    });
  }

  private resolveSource(source?: CompanyNewsSource): CompanyNewsSource {
    if (source !== undefined) {
      return companyNewsSourceSchema.parse(source);
    }

    return DEFAULT_COMPANY_NEWS_SOURCE;
  }

  private async fetchCompanyNews(input: {
    companyName: string;
    location?: string;
    source: CompanyNewsSource;
  }): Promise<{ result: CompanyNewsLlmResult; source: CompanyNewsSource }> {
    if (input.source === 'bright_data') {
      if (!this.brightDataSerpService.isGoogleNewsConfigured()) {
        this.logger.warn(
          'Bright Data SERP is not configured; falling back to OpenAI web search for company news',
        );

        return {
          result: await this.fetchCompanyNewsFromLlm(input),
          source: 'openai',
        };
      }

      try {
        return {
          result: await this.fetchCompanyNewsFromBrightData(input),
          source: 'bright_data',
        };
      } catch (error) {
        this.logger.warn(
          `Bright Data company news failed, falling back to OpenAI: ${error instanceof Error ? error.message : String(error)}`,
        );

        return {
          result: await this.fetchCompanyNewsFromLlm(input),
          source: 'openai',
        };
      }
    }

    return {
      result: await this.fetchCompanyNewsFromLlm(input),
      source: 'openai',
    };
  }

  private async fetchCompanyNewsFromBrightData(input: {
    companyName: string;
    location?: string;
  }): Promise<CompanyNewsLlmResult> {
    const query = buildCompanyNewsSearchQuery(input);
    const serp = await this.brightDataSerpService.requestGoogleNewsJson(query);
    const mapped = mapBrightDataNewsToCompanyNewsResult({
      companyName: input.companyName,
      location: input.location,
      serp,
    });

    this.logger.log(
      `Company news Bright Data returned ${mapped.news_items.length} items for "${mapped.company_name}"`,
    );

    return mapped;
  }

  private async fetchCompanyNewsFromLlm(input: {
    companyName: string;
    location?: string;
  }): Promise<CompanyNewsLlmResult> {
    const openai = this.createOpenAiClient();
    const userPrompt = buildCompanyNewsUserPrompt(input);

    const response = await openai.responses.create({
      model: COMPANY_NEWS_MODEL,
      reasoning: { effort: 'medium' },
      tools: [{ type: 'web_search' }],
      tool_choice: 'required',
      input: [
        {
          role: 'developer',
          content: COMPANY_NEWS_DEVELOPER_PROMPT,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      text: {
        format: toOpenAiResponsesJsonSchemaFormat(
          companyNewsLlmResultSchema,
          'company_news',
        ),
      },
      store: true,
    });

    const outputText = this.extractResponseOutputText(response);
    if (!outputText?.trim()) {
      throw new HttpException(
        'Empty response received from company news search',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const parsed = companyNewsLlmResultSchema.parse(
      this.parseJson(outputText),
    ) as CompanyNewsLlmResult;

    this.logger.log(
      `Company news LLM returned ${parsed.news_items.length} items for "${parsed.company_name}"`,
    );

    return parsed;
  }

  private extractResponseOutputText(response: {
    output_text?: string | null;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  }): string | null {
    if (
      typeof response.output_text === 'string' &&
      response.output_text.trim()
    ) {
      return response.output_text.trim();
    }

    const message = response.output?.find((item) => item.type === 'message');
    const textPart = message?.content?.find(
      (part) => part.type === 'output_text',
    );
    return typeof textPart?.text === 'string' ? textPart.text.trim() : null;
  }

  private parseJson(content: string): unknown {
    const cleaned = content
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    return JSON.parse(cleaned) as unknown;
  }
}
