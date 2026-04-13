import { Injectable, Logger } from '@nestjs/common';
import { CandidateSearchHandlerService } from 'src/engine/core-modules/candidate-search/services/candidate-search-handler.service';
import { StreamEventSender } from './assistant.types';
import { STREAMING_TOOL_NAMES } from './mcp-assistant.constants';
import { McpToolCallCacheService } from './mcp-tool-call-cache.service';
import { throwIfAborted } from './utils/mcp-assistant-abort.util';
import { sanitizeArgsForLog } from './utils/mcp-assistant-args.util';

@Injectable()
export class McpInProcessToolRunnerService {
  private readonly logger = new Logger(McpInProcessToolRunnerService.name);

  constructor(
    private readonly candidateSearchHandlerService: CandidateSearchHandlerService,
    private readonly toolCallCache: McpToolCallCacheService,
  ) {}

  /**
   * If this tool is a streaming candidate-search tool, run the same message/stream flow
   * in-process with sendEvent and return the tool result string. Otherwise return null.
   */
  async runStreamingToolInProcess(
    name: string,
    args: Record<string, unknown>,
    apiToken: string,
    sendEvent: StreamEventSender,
    abortSignal?: AbortSignal,
  ): Promise<string | null> {
    throwIfAborted(abortSignal);
    const isStreamingTool = STREAMING_TOOL_NAMES.includes(
      name as (typeof STREAMING_TOOL_NAMES)[number],
    );
    if (!isStreamingTool) {
      this.logger.warn(
        `Tool "${name}" not in STREAMING_TOOL_NAMES [${STREAMING_TOOL_NAMES.join(', ')}]; delegating to MCP subprocess. ` +
          'If this tool should run in-process and produce server logs, add it to STREAMING_TOOL_NAMES in mcp-assistant.constants.ts.',
      );
      this.logger.log(
        `Tool call: ${name} (args: ${JSON.stringify(sanitizeArgsForLog(args))})`,
      );
      return null;
    }
    this.logger.log(
      `Executing tool in-process: ${name} (args: ${JSON.stringify(sanitizeArgsForLog(args))})`,
    );

    const cacheKey = this.toolCallCache.buildKey(name, args);
    const cachedResult = this.toolCallCache.getCachedToolResult(cacheKey);
    if (cachedResult !== null) {
      this.logger.log(
        `Returning cached result for ${name} (duplicate call detected)`,
      );
      sendEvent?.('status', { message: `Using cached result for ${name}...` });
      return cachedResult;
    }

    const isGenerateSearchParams =
      name === 'generate_search_parameters' ||
      name === 'generate_unresolved_search_parameters';
    if (isGenerateSearchParams) {
      sendEvent?.('status', {
        message:
          'Generating search parameters from LinkedIn query generation...',
      });
      this.logger.log(
        `Generating search parameters from LinkedIn query generation...`,
      );
      const prompt = (args.prompt ?? args.query) as string | undefined;
      const searchType =
        (args.searchType as 'classic' | 'sales_navigator' | 'recruiter') ??
        'classic';
      const searchCategory =
        (args.searchCategory as 'people' | 'companies' | 'posts' | 'jobs') ??
        'people';
      if (typeof prompt !== 'string' || !prompt.trim()) {
        this.logger.warn(
          `Tool ${name}: missing or empty prompt/query (prompt=${typeof prompt}, value length=${typeof prompt === 'string' ? prompt.length : 0}); delegating to MCP.`,
        );
        return null;
      }
      if (searchCategory !== 'people') {
        this.logger.log(
          `Tool ${name}: searchCategory=${searchCategory}; only people is supported, returning error to caller.`,
        );
        return JSON.stringify({
          error:
            'Only people search is supported for generate_search_parameters with streaming.',
        });
      }
      try {
        throwIfAborted(abortSignal);
        const rawQuery = (args.rawQuery as string) ?? prompt;
        const unresolvedSearchParams =
          await this.candidateSearchHandlerService.generateUnresolvedSearchParametersFromLinkedinQueryGeneration(
            rawQuery,
            searchType,
            sendEvent,
          );
        throwIfAborted(abortSignal);
        sendEvent?.('status', {
          message: 'Produced unresolved search parameters...',
        });
        this.logger.log(`Produced unresolved search parameters...`);
        const result = JSON.stringify(unresolvedSearchParams);
        this.toolCallCache.cacheToolResult(cacheKey, result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Tool ${name} failed (in-process): ${message}`,
          err instanceof Error ? err.stack : undefined,
        );
        return JSON.stringify({
          error: message,
          searchParameters: null,
          searchStrategies: null,
        });
      }
    }

    if (
      name === 'search_linkedin_people' ||
      name === 'search_linkedin_with_query'
    ) {
      const query = args.query;
      const assistantThreadId = args.assistantThreadId;
      this.logger.log('This is the search linkedin people tool being called');
      this.logger.log(`query:: ${query}`);
      this.logger.log(`assistantThreadId:: ${assistantThreadId}`);
      if (
        typeof query !== 'string' ||
        !query.trim() ||
        typeof assistantThreadId !== 'string' ||
        !assistantThreadId.trim()
      ) {
        this.logger.log(
          `Tool ${name}: missing query or assistantThreadId; delegating to MCP subprocess instead of in-process candidate-search handler.`,
        );
        return null;
      }
    }
    sendEvent?.('status', { message: 'Running streaming tool in process...' });
    this.logger.log(`Running streaming tool in process...`);

    const body = {
      message: String(args.query ?? args.message ?? ''),
      assistantThreadId: String(args.assistantThreadId ?? ''),
      searchType:
        (args.searchType as 'classic' | 'sales_navigator' | 'recruiter') ??
        'classic',
      searchCategory:
        (args.searchCategory as 'people' | 'companies' | 'posts' | 'jobs') ??
        'people',
      parsedJD: args.parsedJD as Record<string, unknown> | undefined,
      includeJd: args.includeJd !== false,
    };

    try {
      const result =
        await this.candidateSearchHandlerService.handleMessageStream(
          body,
          apiToken,
          (event, data) => sendEvent(event, data),
          abortSignal,
        );
      throwIfAborted(abortSignal);
      if (result.response?.error) {
        const errorMessage =
          typeof result.response.error === 'string'
            ? result.response.error
            : JSON.stringify(result.response.error);

        const toolErrorResult = JSON.stringify({
          text: '',
          error: errorMessage,
        });

        this.toolCallCache.cacheToolResult(cacheKey, toolErrorResult);

        return toolErrorResult;
      }

      const candidates =
        this.candidateSearchHandlerService.extractCandidatesFromResponse(
          result.response,
        );
      const toolResult = JSON.stringify({
        text: result.response?.chatMessage ?? result.assistantMessage ?? '',
        ...(candidates.length > 0
          ? {
              candidateCount: candidates.length,
              searchRef: String(args.assistantThreadId ?? ''),
            }
          : {}),
        ...(result.response?.error ? { error: result.response.error } : {}),
      });
      this.toolCallCache.cacheToolResult(cacheKey, toolResult);
      return toolResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ text: '', error: message });
    }
  }
}
