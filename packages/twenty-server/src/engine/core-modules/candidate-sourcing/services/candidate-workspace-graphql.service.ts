import { Injectable } from '@nestjs/common';

import {
    FindManyVideoInterviewModels,
    getGraphqlToFindManyProjects,
    Project,
    PageInfo,
    resolveIsOrgChartEnabledFromWorkspace,
} from 'twenty-shared';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

@Injectable()
export class CandidateWorkspaceGraphQLService {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}



  async getVideoInterviewModels(apiToken: string): Promise<any[]> {
    try {
      const query = FindManyVideoInterviewModels;
      const variables = {
        filter: {},
        orderBy: [{ position: 'AscNullsFirst' }],
      };

      const response = await this.staticGraphQLService.executeGraphQL(
        query,
        variables,
        apiToken,
      );

      const videoInterviewModels = response?.data?.data?.videoInterviewModels as {
        edges: any[];
        pageInfo: PageInfo;
      } | undefined;
      return videoInterviewModels?.edges || ([] as any[]);
    } catch (error) {
      console.error('Error fetching video interview models:', error);
      return [];
    }
  }


  async getJobDetails(
    projectId: string,
    jobName: string,
    apiToken: string,
  ): Promise<Project> {
    console.log('Getting job details - projectId:', projectId, 'jobName:', jobName);

    function isValidMongoDBId(str: string) {
      if (!str || str.length !== 24) {
        return false;
      }
      const hexRegex = /^[0-9a-fA-F]{24}$/;
      return hexRegex.test(str);
    }

    function isValidUUIDv4(str: string) {
      const uuidV4Regex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return uuidV4Regex.test(str);
    }

    let queryType = '';
    let variables: Record<string, unknown>;

    if (isValidUUIDv4(projectId)) {
      queryType = 'UUID';
      variables = {
        filter: { id: { in: [projectId] } },
        limit: 30,
        orderBy: [{ position: 'AscNullsFirst' }],
      };
    } else if (isValidMongoDBId(projectId)) {
      queryType = 'MongoDB ID';
      variables = {
        filter: { arxenaSiteId: { in: [projectId] } },
        limit: 30,
        orderBy: [{ position: 'AscNullsFirst' }],
      };
    } else if (jobName) {
      queryType = 'Project Name';
      variables = {
        filter: { name: { in: [jobName] } },
        limit: 30,
        orderBy: [{ position: 'AscNullsFirst' }],
      };
    } else {
      throw new Error('Invalid job identifier provided - neither valid ID nor name');
    }

    console.log(`Querying job by ${queryType}`);

    try {
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const workspaceKeys =
        await this.workspaceQueryService.getWorkspaceKeys(workspaceId);
      const isOrgChartEnabled = resolveIsOrgChartEnabledFromWorkspace(
        workspaceKeys?.is_org_chart_enabled,
      );
      const query = getGraphqlToFindManyProjects(isOrgChartEnabled);

      const response = await this.staticGraphQLService.executeGraphQL(
        query,
        variables,
        apiToken,
      );
      const job = response?.data?.data?.projects?.edges[0]?.node;

      if (!job) {
        console.error('No job found in response:', response?.data);
        throw new Error(`Project not found using ${queryType}`);
      }

      if (!job.id) {
        console.error('Invalid job data returned:', job);
        throw new Error('Project found but missing ID');
      }

      console.log('Successfully found job:', {
        id: job.id,
        name: job.name,
        arxenaSiteId: job.arxenaSiteId,
      });

      return job;
    } catch (error) {
      console.error('Error fetching job details:', error);
      throw new Error(`Failed to fetch job details: ${error.message}`);
    }
  }
}
