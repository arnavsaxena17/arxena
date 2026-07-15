import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';

import {
  COMPANY_NEWS_DEVELOPER_PROMPT,
  buildCompanyNewsUserPrompt,
} from '../prompts/company-news.prompt';
import {
  companyNewsFetchRecordSchema,
  companyNewsLlmResultSchema,
  companyNewsStorageSchema,
  type CompanyNewsFetchRecord,
  type CompanyNewsItem,
  type CompanyNewsLlmResult,
  type CompanyNewsStorage,
} from '../schemas/company-news.schema';
import { OrgChartS3Service } from './orgchart-s3.service';

const COMPANY_NEWS_MODEL = 'gpt-5.4-nano';

@Injectable()
export class OrgChartCompanyNewsService {
  private readonly logger = new Logger(OrgChartCompanyNewsService.name);

  constructor(private readonly orgChartS3Service: OrgChartS3Service) {}

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
  }): Promise<CompanyNewsStorage> {
    const companyId = input.companyId.trim();
    const companyName = input.companyName.trim() || companyId;
    const location = input.location?.trim();

    this.logger.log(
      `Fetching company news for companyId=${companyId} companyName="${companyName}" location="${location ?? ''}"`,
    );

    const llmResult = await this.fetchCompanyNewsFromLlm({
      companyName,
      location,
    });
    const fetchedAt = new Date().toISOString();
    const fetchRecord = companyNewsFetchRecordSchema.parse({
      fetchedAt,
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
    this.logger.log(
      `Saved company news to S3 for companyId=${companyId} fetchCount=${nextStorage.fetches.length}`,
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
        format: zodTextFormat(companyNewsLlmResultSchema, 'company_news'),
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
    if (typeof response.output_text === 'string' && response.output_text.trim()) {
      return response.output_text.trim();
    }

    const message = response.output?.find((item) => item.type === 'message');
    const textPart = message?.content?.find((part) => part.type === 'output_text');
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
