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
  requestId?: string;
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
      requestId?: string;
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
      requestId,
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

    if (mode === 'entire_company') {
      const cachedOrgChart =
        await this.candidateSearchHandlerService.getCachedCompanyOrgChart({
          companyName: resolvedCompanyName,
          companyId,
          mode: 'entire_company',
          searchType,
        });

      if (cachedOrgChart) {
        this.logger.log(
          `Serving cached company org chart for company="${resolvedCompanyName}"`,
        );

        return {
          success: true,
          mode,
          searchType,
          companyName: resolvedCompanyName,
          jobTitles,
          itemCount: cachedOrgChart.itemCount,
          items: cachedOrgChart.items,
          orgChart: cachedOrgChart.orgChart,
          isCached: true,
          cacheSource: 'orgchart',
          cachedAt: cachedOrgChart.cachedAt,
        };
      }

      const cachedCandidateList =
        await this.candidateSearchHandlerService.getCachedCompanyCandidateList({
          companyName: resolvedCompanyName,
          companyId,
          mode: 'entire_company',
          searchType,
        });

      if (cachedCandidateList && cachedCandidateList.itemCount > 0) {
        this.logger.log(
          `Building org chart from cached candidate list for company="${resolvedCompanyName}" (${cachedCandidateList.itemCount} candidates)`,
        );
        try {
          const orgChartFromCache =
            await this.candidateSearchHandlerService.buildOrgChartFromLinkedInCompanyCandidates(
              cachedCandidateList.items,
              {
                companyName: resolvedCompanyName,
                companyId,
              },
            );
          const shouldCacheBuiltOrgChartFromCandidateList =
            this.candidateSearchHandlerService.shouldCacheCompanyOrgChart({
              orgChart: orgChartFromCache,
              fallbackCandidateCount: cachedCandidateList.itemCount,
              companyName: resolvedCompanyName,
              companyId,
            });
          if (shouldCacheBuiltOrgChartFromCandidateList) {
            await this.candidateSearchHandlerService.setCachedCompanyOrgChart({
              companyName: resolvedCompanyName,
              companyId,
              mode: 'entire_company',
              searchType,
              orgChart: orgChartFromCache,
              items: cachedCandidateList.items,
              itemCount: cachedCandidateList.itemCount,
            });
          }
          return {
            success: true,
            mode,
            searchType,
            companyName: resolvedCompanyName,
            jobTitles,
            itemCount: cachedCandidateList.itemCount,
            items: cachedCandidateList.items,
            orgChart: orgChartFromCache,
            isCached: true,
            cacheSource: 'candidate_list',
            cachedAt: cachedCandidateList.cachedAt,
          };
        } catch (error) {
          this.logger.error(
            `Failed to build org chart from cached candidates for company="${resolvedCompanyName}"`,
            error as Error,
          );
          return {
            success: true,
            mode,
            searchType,
            companyName: resolvedCompanyName,
            jobTitles,
            itemCount: cachedCandidateList.itemCount,
            items: cachedCandidateList.items,
            orgChart: undefined,
            isCached: true,
            cacheSource: 'candidate_list',
            cachedAt: cachedCandidateList.cachedAt,
          };
        }
      }
    }

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
          requestId,
        },
      );

    let orgChart: Record<string, unknown> | undefined;

    if (mode === 'entire_company' && result.itemCount > 0) {
      await this.candidateSearchHandlerService.setCachedCompanyCandidateList({
        companyName: resolvedCompanyName,
        companyId,
        mode: 'entire_company',
        searchType,
        items: result.items,
        itemCount: result.itemCount,
      });
    }

    if (mode === 'entire_company' && result.itemCount > 0) {
      try {
        orgChart =
          await this.candidateSearchHandlerService.buildOrgChartFromLinkedInCompanyCandidates(
            result.items,
            {
              companyName: resolvedCompanyName,
              companyId,
            },
          );

        const shouldCacheBuiltOrgChartFromLinkedIn =
          this.candidateSearchHandlerService.shouldCacheCompanyOrgChart({
            orgChart,
            fallbackCandidateCount: result.itemCount,
            companyName: resolvedCompanyName,
            companyId,
          });
        if (shouldCacheBuiltOrgChartFromLinkedIn) {
          await this.candidateSearchHandlerService.setCachedCompanyOrgChart({
            companyName: resolvedCompanyName,
            companyId,
            mode: 'entire_company',
            searchType,
            orgChart,
            items: result.items,
            itemCount: result.itemCount,
          });
        }
      } catch (error) {
        this.logger.error(
          `Failed to build org chart from LinkedIn orgchart search for company="${resolvedCompanyName}"`,
          error as Error,
        );
      }
    }

    return {
      success: true,
      mode,
      searchType,
      companyName: resolvedCompanyName,
      jobTitles,
      itemCount: result.itemCount,
      items: result.items,
      orgChart,
      isCached: false,
      cacheSource: 'none',
    };
  }
}

