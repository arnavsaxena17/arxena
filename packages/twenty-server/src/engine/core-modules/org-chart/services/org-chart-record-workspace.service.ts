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
    this.logger.log(
      `Attempting to persist orgChart CRM row for company="${params.resolvedCompanyName}" mode=${params.mode} searchType=${params.searchType} path=${params.orgChartS3RelativePath}`,
    );
    if (!apiToken) {
      this.logger.warn(
        `Skipping orgChart CRM persist for company="${params.resolvedCompanyName}": no apiToken`,
      );
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
        recruiterId: workspaceMemberId,
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

      const response = await this.staticGraphQLService.executeGraphQL(
        graphqlToCreateOneOrgChart,
        { input },
        apiToken,
      );

      const gqlResult = this.extractGraphQLResult(response);
      const gqlErrors = gqlResult?.errors;

      if (Array.isArray(gqlErrors) && gqlErrors.length > 0) {
        const summary = gqlErrors
          .map((err, idx) => {
            const message =
              err && typeof err === 'object' && 'message' in err
                ? String((err as { message?: unknown }).message ?? 'unknown')
                : String(err);
            const path =
              err && typeof err === 'object' && 'path' in err
                ? JSON.stringify((err as { path?: unknown }).path)
                : undefined;
            return `#${idx + 1} ${message}${path ? ` (path=${path})` : ''}`;
          })
          .join(' | ');

        this.logger.warn(
          `OrgChart CRM row NOT persisted for company="${params.resolvedCompanyName}" chartKind=${chartKind} path=${params.orgChartS3RelativePath}: ${summary}`,
        );
        return;
      }

      const createdId = this.extractCreatedOrgChartId(gqlResult);

      this.logger.log(
        `Persisted orgChart row for company="${params.resolvedCompanyName}" chartKind=${chartKind} path=${params.orgChartS3RelativePath}${
          createdId ? ` id=${createdId}` : ''
        }`,
      );
    } catch (error) {
      this.logger.warn(
        `Could not persist orgChart CRM row: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * `StaticGraphQLService.executeGraphQL` wraps the raw `graphql()` result as
   * `{ data: <rawResult>, metrics: {...} }` and, in particular, never throws
   * when the GraphQL response itself contains `errors`. We unwrap it here so
   * the caller can detect (and log) actual mutation failures.
   */
  private extractGraphQLResult(
    response: unknown,
  ): { data?: unknown; errors?: unknown[] } | undefined {
    if (!response || typeof response !== 'object') {
      return undefined;
    }
    const maybe = (response as { data?: unknown }).data;
    if (!maybe || typeof maybe !== 'object') {
      return undefined;
    }
    return maybe as { data?: unknown; errors?: unknown[] };
  }

  private extractCreatedOrgChartId(
    gqlResult: { data?: unknown } | undefined,
  ): string | undefined {
    const data = gqlResult?.data;
    if (!data || typeof data !== 'object') {
      return undefined;
    }
    const created = (data as { createOrgChart?: unknown }).createOrgChart;
    if (!created || typeof created !== 'object') {
      return undefined;
    }
    const id = (created as { id?: unknown }).id;
    return typeof id === 'string' ? id : undefined;
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
