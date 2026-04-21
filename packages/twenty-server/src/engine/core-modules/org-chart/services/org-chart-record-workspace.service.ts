import { Injectable, Logger } from '@nestjs/common';

import {
  graphqlToCreateOneOrgChart,
  type OrgchartSearchMode,
} from 'twenty-shared';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

type OrgchartSearchType = 'classic' | 'sales_navigator' | 'recruiter';

export type PersistOrgChartWorkspaceRecordParams = {
  apiToken: string | undefined;
  mode: OrgchartSearchMode;
  searchType: OrgchartSearchType;
  resolvedCompanyName: string;
  companyId?: string;
  linkedinCompanyUrl?: string;
  itemCount: number;
  orgChartS3RelativePath: string;
  functionRoot?: string;
  country?: string;
  keywordsHash?: string;
  chartKindOverride?:
    | 'FULL'
    | 'LEADERSHIP'
    | 'FUNCTION_GRADE'
    | 'CANDIDATES_ONLY';
};

@Injectable()
export class OrgChartRecordWorkspaceService {
  private readonly logger = new Logger(OrgChartRecordWorkspaceService.name);

  constructor(
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {}

  async tryPersistOrgChartRecord(
    params: PersistOrgChartWorkspaceRecordParams,
  ): Promise<void> {
    const { apiToken } = params;

    if (!apiToken) {
      return;
    }

    try {
      const workspaceMemberId =
        await this.workspaceQueryService.getWorkspaceMemberIdFromToken(
          apiToken,
        );

      if (!workspaceMemberId) {
        return;
      }

      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const createdByProfileId =
        (await this.workspaceQueryService.getWorkspaceMemberProfileIdForMember(
          workspaceId,
          workspaceMemberId,
        )) ?? undefined;

      const chartKind =
        params.chartKindOverride ?? this.mapModeToChartKind(params.mode);
      const searchTypeGql = this.mapSearchType(params.searchType);
      const name = this.buildDisplayName(
        params.resolvedCompanyName,
        chartKind,
        params.functionRoot,
      );

      const input: Record<string, unknown> = {
        name,
        chartKind,
        searchType: searchTypeGql,
        s3RelativePath: params.orgChartS3RelativePath,
        itemCount: params.itemCount,
        createdById: workspaceMemberId,
      };

      const trimmedCompanyId = params.companyId?.trim();

      if (trimmedCompanyId) {
        input.externalCompanyId = trimmedCompanyId;
      }

      const linkedinUrl = params.linkedinCompanyUrl?.trim();

      if (linkedinUrl) {
        input.linkedinCompanyUrl = linkedinUrl;
      }

      const fnRoot = params.functionRoot?.trim();

      if (fnRoot) {
        input.functionRoot = fnRoot;
      }

      const country = params.country?.trim();

      if (country) {
        input.country = country;
      }

      const keywordsHash = params.keywordsHash?.trim();

      if (keywordsHash) {
        input.keywordsHash = keywordsHash;
      }

      if (createdByProfileId) {
        input.createdByProfileId = createdByProfileId;
      }

      await this.staticGraphQLService.executeGraphQL(
        graphqlToCreateOneOrgChart,
        { input },
        apiToken,
      );
      this.logger.log(
        `Persisted orgChart row for company="${params.resolvedCompanyName}" path=${params.orgChartS3RelativePath}`,
      );
    } catch (error) {
      this.logger.warn(
        `Could not persist orgChart CRM row: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private mapModeToChartKind(
    mode: OrgchartSearchMode,
  ): 'FULL' | 'LEADERSHIP' | 'FUNCTION_GRADE' | 'CANDIDATES_ONLY' {
    if (mode === 'leadership') {
      return 'LEADERSHIP';
    }
    if (mode === 'function_grade') {
      return 'FUNCTION_GRADE';
    }
    if (mode === 'current_node' || mode === 'selected_nodes') {
      return 'FUNCTION_GRADE';
    }
    if (mode === 'entire_company' || mode === 'business_division_map') {
      return 'FULL';
    }
    return 'FULL';
  }

  private mapSearchType(
    searchType: OrgchartSearchType,
  ): 'CLASSIC' | 'SALES_NAVIGATOR' | 'RECRUITER' {
    if (searchType === 'sales_navigator') {
      return 'SALES_NAVIGATOR';
    }
    if (searchType === 'recruiter') {
      return 'RECRUITER';
    }
    return 'CLASSIC';
  }

  private buildDisplayName(
    companyName: string,
    chartKind: 'FULL' | 'LEADERSHIP' | 'FUNCTION_GRADE' | 'CANDIDATES_ONLY',
    functionRoot?: string,
  ): string {
    let suffix: string;

    if (chartKind === 'LEADERSHIP') {
      suffix = 'Leadership';
    } else if (chartKind === 'FUNCTION_GRADE') {
      suffix = functionRoot?.trim() ? functionRoot.trim() : 'Function / grade';
    } else if (chartKind === 'CANDIDATES_ONLY') {
      suffix = 'Candidates';
    } else {
      suffix = 'Org chart';
    }

    return `${companyName} — ${suffix}`;
  }
}
