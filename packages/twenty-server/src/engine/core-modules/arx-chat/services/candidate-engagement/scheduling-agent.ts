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
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

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
    private readonly workspaceQueryService: WorkspaceQueryService
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

  
  async runWorkspaceServiceCandidateEngagement(transactionManager?: EntityManager) {
    const workspaceIds = await this.workspaceQueryService.getWorkspaces();
    console.log("workspaceIds::", workspaceIds);
    const dataSources = await this.workspaceQueryService.dataSourceRepository.find({
      where: {
        workspaceId: In(workspaceIds),
      },
    });
    const workspaceIdsWithDataSources = new Set(
      dataSources.map((dataSource) => dataSource.workspaceId),
    );
    for (const workspaceId of workspaceIdsWithDataSources) {
      const dataSourceSchema = this.workspaceQueryService.workspaceDataSourceService.getSchemaName(workspaceId);
      console.log("dataSourceSchema::", dataSourceSchema);
      const apiKeys = await this.workspaceQueryService.getApiKeys(workspaceId, dataSourceSchema, transactionManager);
      if (apiKeys.length > 0) {
        const apiKeyToken = await this.workspaceQueryService.tokenService.generateApiKeyToken(
          workspaceId,
          apiKeys[0].id,
          apiKeys[0].expiresAt,
        );
        if (apiKeyToken) {
          const candidateEngagementArx = new CandidateEngagementArx(this.workspaceQueryService);
          await candidateEngagementArx.checkCandidateEngagement(apiKeyToken?.token);
        }
      }
    }
  }
}