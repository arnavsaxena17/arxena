import { Injectable, Logger } from '@nestjs/common';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { FindOneProject } from 'twenty-shared';

export type RecruiterProjectContext = {
  projectId: string;
  jobTitle?: string;
  companyName?: string;
  jobLocation?: string;
  searchName?: string;
  createdAt?: string;
  updatedAt?: string;
};

@Injectable()
export class ProjectContextService {
  private readonly logger = new Logger(ProjectContextService.name);

  constructor(private readonly staticGraphQLService: StaticGraphQLService) {}

  async fetchProjectContext(
    apiToken: string,
    projectId: string,
  ): Promise<RecruiterProjectContext | null> {
    if (!projectId) {
      return null;
    }

    try {
      const result = await this.staticGraphQLService.executeGraphQL(
        FindOneProject,
        { objectRecordId: projectId },
        apiToken,
      );

      const project = result?.project ?? result?.data?.project;
      if (!project?.id) {
        return null;
      }

      return {
        projectId: project.id as string,
        jobTitle:
          (project.position as string | undefined) ??
          (project.name as string | undefined),
        companyName:
          (project.companyName as string | undefined) ??
          (project.company?.name as string | undefined),
        jobLocation: project.jobLocation as string | undefined,
        searchName: project.searchName as string | undefined,
        createdAt: (project.createdAt as string | undefined) ?? undefined,
        updatedAt: (project.updatedAt as string | undefined) ?? undefined,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch project context for projectId=${projectId}: ${(error as Error).message}`,
      );
      return null;
    }
  }
}
