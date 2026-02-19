import { Injectable } from '@nestjs/common';

import {
    FindManyVideoInterviewModels,
    getExistingRelationsQuery,
    graphqlToFindManyJobs,
    Job,
    PageInfo,
} from 'twenty-shared';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { CreateMetaDataStructure } from 'src/engine/core-modules/workspace-modifications/object-apis/object-apis-creation';
import { createRelations } from 'src/engine/core-modules/workspace-modifications/object-apis/services/relation-service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

@Injectable()
export class CandidateWorkspaceGraphQLService {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  async checkExistingRelations(
    objectMetadataId: string,
    apiToken: string,
  ): Promise<any[]> {
    try {
      const response = await this.staticGraphQLService.executeGraphQL(
        getExistingRelationsQuery,
        { objectMetadataId },
        apiToken,
      );

      const relations = response?.data?.data?.relations as {
        edges: any[];
        pageInfo: PageInfo;
      } | undefined;
      const relationEdges = relations?.edges?.map((edge: any) => edge.node) || ([] as any[]);
      return relationEdges;
    } catch (error) {
      console.error('Error checking existing relations:', error);
      return [];
    }
  }

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

  async createRelationsBasedonObjectMap(
    jobCandidateObjectId: string,
    jobCandidateObjectName: string,
    apiToken: string,
    origin: string,
  ): Promise<void> {
    const objectsNameIdMap = await new CreateMetaDataStructure(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).fetchObjectsNameIdMap(apiToken, origin);

    const existingRelations = await this.checkExistingRelations(
      jobCandidateObjectId,
      apiToken,
    );

    const relationsToCreate = [
      {
        relationMetadata: {
          fromObjectMetadataId: objectsNameIdMap['person'],
          toObjectMetadataId: jobCandidateObjectId,
          relationType: 'ONE_TO_MANY' as const,
          fromName: jobCandidateObjectName,
          toName: 'person',
          fromDescription: 'Job Candidate',
          toDescription: 'Person',
          fromLabel: 'Job Candidate',
          toLabel: 'Person',
          fromIcon: 'IconUserCheck',
          toIcon: 'IconUser',
        },
      },
      {
        relationMetadata: {
          fromObjectMetadataId: objectsNameIdMap['candidate'],
          toObjectMetadataId: jobCandidateObjectId,
          relationType: 'ONE_TO_MANY' as const,
          fromName: jobCandidateObjectName,
          toName: 'candidate',
          fromDescription: 'Job Candidate',
          toDescription: 'Candidate',
          fromLabel: 'Job Candidate',
          toLabel: 'Candidate',
          fromIcon: 'IconUserCheck',
          toIcon: 'IconUser',
        },
      },
      {
        relationMetadata: {
          fromObjectMetadataId: objectsNameIdMap['job'],
          toObjectMetadataId: jobCandidateObjectId,
          relationType: 'ONE_TO_MANY' as const,
          fromName: jobCandidateObjectName,
          toName: 'job',
          fromDescription: 'Job Candidate',
          toDescription: 'Job',
          fromLabel: 'Job Candidate',
          toLabel: 'Job',
          fromIcon: 'IconUserCheck',
          toIcon: 'IconUser',
        },
      },
    ].filter((relation) => {
      return !existingRelations.some(
        (existing) =>
          existing.fromObjectMetadataId ===
            relation.relationMetadata.fromObjectMetadataId &&
          existing.toObjectMetadataId ===
            relation.relationMetadata.toObjectMetadataId,
      );
    });

    console.log('Relations to create:', relationsToCreate);
    if (relationsToCreate.length > 0) {
      try {
        await createRelations(relationsToCreate, apiToken, origin, 3);
      } catch (error) {
        if (!error.message?.includes('already exists')) {
          throw error;
        }
      }
    }
  }

  async getJobDetails(
    jobId: string,
    jobName: string,
    apiToken: string,
  ): Promise<Job> {
    console.log('Getting job details - jobId:', jobId, 'jobName:', jobName);

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

    if (isValidUUIDv4(jobId)) {
      queryType = 'UUID';
      variables = {
        filter: { id: { in: [jobId] } },
        limit: 30,
        orderBy: [{ position: 'AscNullsFirst' }],
      };
    } else if (isValidMongoDBId(jobId)) {
      queryType = 'MongoDB ID';
      variables = {
        filter: { arxenaSiteId: { in: [jobId] } },
        limit: 30,
        orderBy: [{ position: 'AscNullsFirst' }],
      };
    } else if (jobName) {
      queryType = 'Job Name';
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
      const response = await this.staticGraphQLService.executeGraphQL(
        graphqlToFindManyJobs,
        variables,
        apiToken,
      );
      const job = response?.data?.data?.jobs?.edges[0]?.node;

      if (!job) {
        console.error('No job found in response:', response?.data);
        throw new Error(`Job not found using ${queryType}`);
      }

      if (!job.id) {
        console.error('Invalid job data returned:', job);
        throw new Error('Job found but missing ID');
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
