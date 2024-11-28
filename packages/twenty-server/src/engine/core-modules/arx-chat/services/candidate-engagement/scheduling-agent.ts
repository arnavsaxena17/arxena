import CandidateEngagementArx from '../candidate-engagement/check-candidate-engagement';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Repository, In, EntityManager } from 'typeorm';
import { EnvironmentService } from 'src/engine/integrations/environment/environment.service';
import { InjectRepository } from '@nestjs/typeorm';

import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';
import { TokenService } from 'src/engine/core-modules/auth/services/token.service';

let timeScheduleCron:string
console.log("Current Environment Is:", process.env.NODE_ENV)
if(process.env.NODE_ENV === 'development'){
  // cron to run every 30 seconds in development
  timeScheduleCron = '*/30 * * * * *'
}
else{
  // cron to run every 5 minutes
  // timeScheduleCron = '*/3 * * * *'
  timeScheduleCron = '*/30 * * * * *'

}

@Injectable()
export class TasksService {
  constructor(
    private readonly tokenService: TokenService,


  @InjectRepository(Workspace, 'core')
  private readonly workspaceRepository: Repository<Workspace>,
  @InjectRepository(DataSourceEntity, 'metadata')
  private readonly dataSourceRepository: Repository<DataSourceEntity>,
  private readonly environmentService: EnvironmentService,
  private readonly workspaceDataSourceService: WorkspaceDataSourceService,

) {}
@Cron(timeScheduleCron)
  async handleCron() {
    // this.logger.log("Evert 5 seconds check Candidate Engagement is called");
    console.log("Starting CRON CYCLE")
    await this.runWorkspaceServiceCandidateEngagement()
    if (process.env.RUN_SCHEDULER === 'true') {
      console.log("Checking Engagement")
      // await new CandidateEngagementArx().checkCandidateEngagement();
    } else {
      console.log('Scheduler is turned off');
    }
    console.log("ENDING CRON CYCLE")
  }

  
  private async getWorkspaces(): Promise<string[]> {
    const workspaceIds = (
      await this.workspaceRepository.find({
        where: this.environmentService.get('IS_BILLING_ENABLED')
          ? { subscriptionStatus: In(['active', 'trialing', 'past_due']) }
          : {},
        select: ['id'],
      })
    ).map((workspace) => workspace.id);
    return workspaceIds;
  }

  private async getApiKeys(workspaceId: string, dataSourceSchema: string, transactionManager?: EntityManager) {
    try {
      const apiKeys = await this.workspaceDataSourceService.executeRawQuery(
        `SELECT * FROM ${dataSourceSchema}."apiKey" where "apiKey"."revokedAt" IS NULL ORDER BY "apiKey"."createdAt" ASC`,
        [],
        workspaceId,
        transactionManager,
      );
      return apiKeys;
    } catch (e) {
      console.log("Error in  ID", workspaceId, "for dataSourceSchema", dataSourceSchema);
      return [];
    }
  }

  async runWorkspaceServiceCandidateEngagement(transactionManager?: EntityManager) {
    const workspaceIds = await this.getWorkspaces();
    console.log("workspaceIds::", workspaceIds);
    const dataSources = await this.dataSourceRepository.find({
      where: {
        workspaceId: In(workspaceIds),
      },
    });
    const workspaceIdsWithDataSources = new Set(
      dataSources.map((dataSource) => dataSource.workspaceId),
    );
    for (const workspaceId of workspaceIdsWithDataSources) {
      const dataSourceSchema = this.workspaceDataSourceService.getSchemaName(workspaceId);
      console.log("dataSourceSchema::", dataSourceSchema);
      const apiKeys = await this.getApiKeys(workspaceId, dataSourceSchema, transactionManager);
      if (apiKeys.length > 0) {
        const apiKeyToken = await this.tokenService.generateApiKeyToken(
          workspaceId,
          apiKeys[0].id,
          apiKeys[0].expiresAt,
        );
        if (apiKeyToken) {
          const candidateEngagementArx = new CandidateEngagementArx();
          await candidateEngagementArx.checkCandidateEngagement(apiKeyToken?.token);
        }
      }
    }
  }
}