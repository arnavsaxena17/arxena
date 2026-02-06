import { Body, Controller, Headers, Logger, Post } from '@nestjs/common';
import { CandidateSearchHandlerService } from '../services/candidate-search-handler.service';
import { extractApiToken } from '../utils/auth.utils';

type OrgchartSearchMode =
  | 'current_node'
  | 'leadership'
  | 'entire_company'
  | 'function_grade'
  | 'all_people'
  | 'selected_nodes';

type OrgchartSearchType = 'classic' | 'sales_navigator' | 'recruiter';

interface OrgchartSearchRequestBody {
  companyName?: string;
  companyId?: string;
  jobTitles?: string[];
  mode: OrgchartSearchMode;
  maxPages?: number;
  searchType?: OrgchartSearchType;
}

@Controller('candidate-search')
export class CandidateSearchOrgchartController {
  private readonly logger = new Logger(CandidateSearchOrgchartController.name);

  constructor(
    private readonly candidateSearchHandlerService: CandidateSearchHandlerService,
  ) {}

  @Post('orgchart')
  async searchOrgchart(
    @Body() body: {
      rawQuery: string;
      cleanedQuery: string;
      companyName?: string;
      companyId?: string;
      jobTitles?: string[];
      mode: OrgchartSearchMode;
      maxPages?: number;
      searchType?: OrgchartSearchType;
    },
    @Headers() headers: any,
  ) {
    const apiToken = extractApiToken(headers);
    if (!apiToken) {
      throw new Error('API token is required');
    }

    const {
      companyName,
      companyId,
      jobTitles = [],
      mode,
      searchType = 'classic',
    } = body;

    const resolvedCompanyName =
      companyName || (companyId ? String(companyId) : '');

    // Build a concise natural language requirement string for the multi-agent pipeline
    let requirement: string;
    switch (mode) {
      case 'leadership':
        requirement = `Find all leadership positions at ${resolvedCompanyName}.`;
        break;
      case 'entire_company':
      case 'all_people':
        requirement = `Find all people currently working at ${resolvedCompanyName}.`;
        break;
      case 'function_grade': {
        const titlesText =
          jobTitles && jobTitles.length > 0
            ? jobTitles.join(', ')
            : 'the relevant function and seniority described by the node';
        requirement = `Find people at ${resolvedCompanyName} with job titles similar to: ${titlesText}.`;
        break;
      }
      case 'selected_nodes':
        requirement = `Find people for the selected nodes at ${resolvedCompanyName}.`;
        break;
      case 'current_node':
      default:
        {
          const titlesText =
            jobTitles && jobTitles.length > 0
              ? jobTitles.join(', ')
              : 'this role';
          requirement = `Find people matching ${titlesText} at ${resolvedCompanyName}.`;
        }
        break;
    }

    this.logger.log(
      `Orgchart search requested. Mode=${mode}, searchType=${searchType}, company="${resolvedCompanyName}", jobTitles=${JSON.stringify(
        jobTitles,
      )}`,
    );

    const result =
      await this.candidateSearchHandlerService.runOrgchartLinkedInSearch(
        body.rawQuery,
        body.cleanedQuery,
        searchType,
        apiToken,
        undefined,
        {
          mode,
          companyName: resolvedCompanyName,
        },
      );

    return {
      success: true,
      mode,
      searchType,
      companyName: resolvedCompanyName,
      jobTitles,
      itemCount: result.itemCount,
      items: result.items,
    };
  }
}

