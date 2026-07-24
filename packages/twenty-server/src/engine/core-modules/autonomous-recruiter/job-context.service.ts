import { Injectable, Logger } from '@nestjs/common';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { FindOneJob } from 'twenty-shared';

export type RecruiterJobContext = {
  jobId: string;
  jobTitle?: string;
  companyName?: string;
  jobLocation?: string;
  searchName?: string;
  createdAt?: string;
  updatedAt?: string;
};

@Injectable()
export class JobContextService {
  private readonly logger = new Logger(JobContextService.name);

  constructor(private readonly staticGraphQLService: StaticGraphQLService) {}

  async fetchJobContext(apiToken: string, jobId: string): Promise<RecruiterJobContext | null> {
    if (!jobId) {
      return null;
    }

    try {
      const result = await this.staticGraphQLService.executeGraphQL(
        FindOneJob,
        { objectRecordId: jobId },
        apiToken,
      );

      const job = result?.job;
      if (!job?.id) {
        return null;
      }

      return {
        jobId: job.id as string,
        jobTitle: (job.position as string | undefined) ?? (job.name as string | undefined),
        companyName:
          (job.companyName as string | undefined) ??
          (job.company?.name as string | undefined),
        jobLocation: job.jobLocation as string | undefined,
        searchName: job.searchName as string | undefined,
        createdAt: (job.createdAt as string | undefined) ?? undefined,
        updatedAt: (job.updatedAt as string | undefined) ?? undefined,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch job context for jobId=${jobId}: ${(error as Error).message}`,
      );
      return null;
    }
  }
}

