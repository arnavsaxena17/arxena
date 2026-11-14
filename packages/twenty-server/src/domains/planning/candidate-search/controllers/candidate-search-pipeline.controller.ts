import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { McpAssistantService } from 'src/engine/core-modules/assistant/mcp-assistant.service';
import { CandidateSearchHandlerService } from 'src/domains/planning/candidate-search/services/candidate-search-handler.service';
import {
  ClassicPeopleSearchStrategyResult,
  GeneratedSearchParameters,
  ParsedJobDescription,
  RecruiterPeopleSearchStrategyResult,
  SalesNavigatorPeopleSearchStrategyResult,
} from 'src/domains/discovery/query/types/candidate-search-request.type';

type PeopleSearchStrategyResult =
  | ClassicPeopleSearchStrategyResult
  | SalesNavigatorPeopleSearchStrategyResult
  | RecruiterPeopleSearchStrategyResult;

export interface SearchParametersResult {
  searchParameters: GeneratedSearchParameters;
  searchStrategies?: PeopleSearchStrategyResult[];
  searchUrls?: string[];
}

// What is left of the step-by-step debug surface: the two routes with live
// callers. generate-unresolved-search-parameters is called by the JD upload
// screen and the generate_unresolved_search_parameters tool;
// job-brief-understanding by the job_brief_understanding tool.
@Controller('candidate-search/pipeline')
export class CandidateSearchPipelineController {
  private readonly logger = new Logger(CandidateSearchPipelineController.name);

  constructor(
    private readonly candidateSearchHandlerService: CandidateSearchHandlerService,
    private readonly mcpAssistantService: McpAssistantService,
  ) {}

  private static readonly MCP_REQUEST_SOURCE_HEADER = 'x-request-source';
  private static readonly MCP_REQUEST_SOURCE_VALUE = 'mcp';

  @Post('generate-unresolved-search-parameters')
  async testGenerateUnresolvedSearchParameters(
    @Body() body: {
      prompt: string;
      rawQuery?: string;
      cleanedQuery?: string;
      parsedJobDescription?: ParsedJobDescription;
      searchType: 'classic' | 'sales_navigator' | 'recruiter';
      searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
      model?: string;
      assistantThreadId?: string;
    },
    @Req() req: Request,
  ): Promise<SearchParametersResult> {
    try {
      const fromMcp =
        (req.headers[
          CandidateSearchPipelineController.MCP_REQUEST_SOURCE_HEADER
        ] as string) ===
        CandidateSearchPipelineController.MCP_REQUEST_SOURCE_VALUE;
      if (fromMcp) {
        this.logger.log(
          `generate_unresolved search_parameters invoked via REST (caller: MCP assistant), prompt: "${body?.prompt?.substring(0, 60) ?? ''}..."`,
        );
      }
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException(
          'API token is required',
          HttpStatus.UNAUTHORIZED,
        );
      }
      this.logger.log(
        `Generating search parameters for prompt: "${body.prompt}..."`,
      );
      this.logger.log(
        `Generating search parameters for raw Query: "${body.rawQuery}..."`,
      );
      if (body.prompt == null || typeof body.prompt !== 'string') {
        throw new HttpException(
          'prompt is required and must be a string',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(
        `Generating search parameters for prompt substring: "${body.prompt.substring(0, 50)}..."`,
      );

      const rawQuery = body.rawQuery ?? body.prompt;
      const cleanedQuery = body.cleanedQuery ?? body.prompt;
      this.logger.log(
        `Generating search parameters for raw Query: "${rawQuery}..."`,
      );
      this.logger.log(
        `Generating search parameters for cleaned Query: "${cleanedQuery}..."`,
      );
      const unresolvedSearchParams: GeneratedSearchParameters =
        await this.candidateSearchHandlerService.generateUnresolvedSearchParams(
          rawQuery,
          cleanedQuery,
          body.searchType,
          body.searchCategory,
          apiToken,
          body.prompt,
          body.parsedJobDescription,
          undefined, // projectId
          undefined, // sendEvent
          false, // includeJd
          undefined, // onTokenUsage
        );

      const searchParamKey = `${body?.searchType?.replace(/_([a-z])/g, (_, l) =>
        l.toUpperCase(),
      )}${body.searchCategory.charAt(0).toUpperCase() + body.searchCategory.slice(1)}Search`;

      const primaryParams =
        unresolvedSearchParams[searchParamKey] || unresolvedSearchParams;
      const strategiesKey = `${searchParamKey}Strategies`;
      const strategies =
        body.searchCategory === 'people'
          ? unresolvedSearchParams[strategiesKey] || []
          : undefined;

      // Generate URLs
      this.logger.log(
        `Generated search parameters: ${JSON.stringify(primaryParams, null, 2)}`,
      );
      this.logger.log(
        `Generated search strategies: ${JSON.stringify(strategies, null, 2)}`,
      );

      return {
        searchParameters: primaryParams,
        searchStrategies: strategies,
      };
    } catch (error) {
      this.logger.error(
        'Error generating search parameters in testGenerateSearchParameters:',
        error,
      );
      throw new HttpException(
        error.message || 'Failed to generate search parameters',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('job-brief-understanding')
  async jobBriefUnderstanding(
    @Body() body: { jobBrief: string; assistantThreadId?: string },
    @Req() req: Request,
  ) {
    this.logger.log(
      'jobBriefUnderstanding body::',
      JSON.stringify(body, null, 2),
    );
    try {
      const apiToken = req.headers.authorization?.replace('Bearer ', '');
      if (!apiToken) {
        throw new HttpException(
          'API token is required',
          HttpStatus.UNAUTHORIZED,
        );
      }
      const SYSTEM_PROMPT = `You are an expert at understanding job briefs and generating a detailed job brief understanding.. 

      You can call find_company_by_name to get information about the company. If inspite of that you don't understand then ask about the  
      You will try to understand the nature of the company in terms of how long they have been in business, whats their turnover, how many employees, employee culture, number of working days, work hours, etc.
      You will also probe on understanding the nature of the hiring manager. How do they work, how do they communicate, how do they make decisions, etc. 
      You will try to ascertain the culture of the firm - is it an MNC, an Indian company, a startup, a family run business, etc.
      Generate questions until you are satisfied with the understanding of the role and the client.
      If you are satisfied with the understanding, return 'COMPLETELY_UNDERSTOOD'.
      If you are not entirely satisfied, generate a few more questions to ask the user and return 'PARTIALLY_UNDERSTOOD'.
      Return in the form of a json object
      `;

      const userPrompt = `Please understand the job brief and generate a detailed job brief understanding.
      Project Brief: ${body.jobBrief}`;

      const parsed = await this.mcpAssistantService.callJsonWithTools(
        apiToken,
        SYSTEM_PROMPT,
        userPrompt,
        {
          allowedToolNames: [
            'find_company_by_name',
            // Internal tools are explicitly allowed here so the assistant
            // can use candidate-search pipeline steps when needed.
            // 'generate_unresolved_search_parameters',
            // 'resolve_parameters',
          ],
        },
      );

      this.logger.log(
        `Project brief understanding completed. Parsed response: ${JSON.stringify(parsed, null, 2)}`,
      );
      return parsed;
    } catch (error) {
      this.logger.error('Project brief understanding failed', error);
      throw new HttpException(
        error.message || 'Project brief understanding failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
