import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isAxiosError } from 'axios';

import { SecureHttpClientService } from 'src/engine/core-modules/secure-http-client/secure-http-client.service';
import { SearchHelpCenterInputZodSchema } from 'src/engine/core-modules/tool/tools/search-help-center-tool/search-help-center-tool.schema';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

// ponytail: undocumented Mintlify endpoint, the same one docs.arxena.com itself
// searches through. It needs no credentials; if Mintlify changes it, swap this
// constant for the documented Discovery API (api-dsc.mintlify.com + API key).
const MINTLIFY_SEARCH_URL = 'https://leaves.mintlify.com/api/search/arxena';
const DOCS_BASE_URL = 'https://docs.arxena.com';
const MAX_RESULTS = 8;

type MintlifySearchHit = {
  page?: string;
  header?: string;
  content?: string;
  metadata?: {
    title?: string;
  };
};

type HelpCenterArticle = {
  title: string;
  url: string;
  content?: string;
};

const isEnglishHit = (
  hit: MintlifySearchHit,
): hit is MintlifySearchHit & { page: string } =>
  isNonEmptyString(hit.page) && hit.page.startsWith('l/') === false;

const toArticle = (
  hit: MintlifySearchHit & { page: string },
): HelpCenterArticle => ({
  title: hit.metadata?.title ?? hit.header ?? hit.page,
  url: `${DOCS_BASE_URL}/${hit.page}`,
  content: hit.content,
});

@Injectable()
export class SearchHelpCenterTool implements Tool {
  description =
    'Search the Arxena documentation and help center for information about features, setup, usage, and troubleshooting. Documentation only; do not use it to find companies or people.';
  inputSchema = SearchHelpCenterInputZodSchema;

  constructor(
    private readonly secureHttpClientService: SecureHttpClientService,
  ) {}

  async execute(
    parameters: ToolInput,
    _context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const { query } = parameters;

    try {
      const httpClient = this.secureHttpClientService.getHttpClient();

      const response = await httpClient.post(
        MINTLIFY_SEARCH_URL,
        { query, pageSize: MAX_RESULTS * 3 },
        { headers: { 'Content-Type': 'application/json' } },
      );

      const hits: MintlifySearchHit[] = Array.isArray(response.data?.results)
        ? response.data.results
        : [];

      // Every translated locale is indexed under l/<language>/ and crowds out
      // the English pages an agent should quote.
      const articles: HelpCenterArticle[] = hits
        .filter(isEnglishHit)
        .slice(0, MAX_RESULTS)
        .map(toArticle);

      if (articles.length === 0) {
        return {
          success: true,
          message: `No help center articles found for "${query}"`,
          result: [],
        };
      }

      return {
        success: true,
        message: `Found ${articles.length} relevant help center article${articles.length === 1 ? '' : 's'} for "${query}"`,
        result: articles,
      };
    } catch (error) {
      const errorDetail = isAxiosError(error)
        ? error.response?.data?.message || error.message
        : error instanceof Error
          ? error.message
          : 'Help center search failed';

      return {
        success: false,
        message: `Failed to search help center for "${query}"`,
        error: errorDetail,
      };
    }
  }
}
