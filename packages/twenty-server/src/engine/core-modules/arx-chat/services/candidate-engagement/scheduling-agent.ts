import CandidateEngagementArx from '../candidate-engagement/check-candidate-engagement';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository, In, EntityManager } from 'typeorm';
import { EnvironmentService } from 'src/engine/integrations/environment/environment.service';
import { InjectRepository } from '@nestjs/typeorm';

import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';
import { TokenService } from 'src/engine/core-modules/auth/services/token.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { FetchAndUpdateCandidatesChatsWhatsapps } from './update-chat';

let timeScheduleCron: string;
let fiveMinutesCron: string;
console.log('Current Environment Is:', process.env.NODE_ENV);
if (process.env.NODE_ENV === 'development') {
  // cron to run every 30 seconds in development
  timeScheduleCron = CronExpression.EVERY_30_SECONDS;
  fiveMinutesCron = CronExpression.EVERY_30_SECONDS; // for testing purposes
} else {
  // cron to run every 5 minutes
  timeScheduleCron = CronExpression.EVERY_30_SECONDS;
  fiveMinutesCron = CronExpression.EVERY_5_MINUTES;
}

@Injectable()
export class TasksService {
  private isProcessing = false;

  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}
  @Cron(timeScheduleCron)
  async handleCron() {
    if (this.isProcessing) {
      console.log('Previous cron job still running, skipping this run');
      return;
    }
    try {
      this.isProcessing = true;
      // this.logger.log("Evert 5 seconds check Candidate Engagement is called");
      console.log('Starting CRON CYCLE');
      await this.runWorkspaceServiceCandidateEngagement();
      if (process.env.RUN_SCHEDULER === 'true') {
        console.log('Checking Engagement');
        // await new CandidateEngagementArx().checkCandidateEngagement();
      } else {
        console.log('Scheduler is turned off');
      }
    } catch (error) {
      console.log('Error in cron job', error);
    } finally {
      this.isProcessing = false;
      console.log('ENDING CRON CYCLE');
    }
  }

  @Cron(fiveMinutesCron)
  async handleFiveMinutesCron() {
    if (this.isProcessing) {
      console.log('Previous 5 minutes cron job still running, skipping this run');
      return;
    }
    try {
      this.isProcessing = true;
      console.log('Starting 5 minutes for Chat Count Chat Processing  CRON CYCLE');
      const workspaceIds = await this.workspaceQueryService.getWorkspaces();
      const dataSources = await this.workspaceQueryService.dataSourceRepository.find({
        where: {
          workspaceId: In(workspaceIds),
        },
      });
      const workspaceIdsWithDataSources = new Set(dataSources.map(dataSource => dataSource.workspaceId));
      for (const workspaceId of workspaceIdsWithDataSources) {
        const dataSourceSchema = this.workspaceQueryService.workspaceDataSourceService.getSchemaName(workspaceId);
        // console.log('dataSourceSchema::', dataSourceSchema);
        const apiKeys = await this.workspaceQueryService.getApiKeys(workspaceId, dataSourceSchema);
        // console.log('these are the keys:', apiKeys);
        if (apiKeys.length > 0) {
          const apiKeyToken = await this.workspaceQueryService.tokenService.generateApiKeyToken(workspaceId, apiKeys[0].id, apiKeys[0].expiresAt);
          if (apiKeyToken) {
            await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).updateRecentCandidatesChatCount(apiKeyToken.token);
            await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).updateRecentCandidatesProcessCandidateChatsGetStatuses(apiKeyToken.token);
          }
        }
      }
    } catch (error) {
      console.log('Error in 5 minutes cron job', error);
    } finally {
      this.isProcessing = false;
      console.log('ENDING 5 minutes CRON CYCLE');
    }
  }



  async runWorkspaceServiceCandidateEngagement(transactionManager?: EntityManager) {
    const workspaceIds = await this.workspaceQueryService.getWorkspaces();
    // console.log("workspaceIds::", workspaceIds);
    const dataSources = await this.workspaceQueryService.dataSourceRepository.find({
      where: {
        workspaceId: In(workspaceIds),
      },
    });
    const workspaceIdsWithDataSources = new Set(dataSources.map(dataSource => dataSource.workspaceId));
    for (const workspaceId of workspaceIdsWithDataSources) {
      const dataSourceSchema = this.workspaceQueryService.workspaceDataSourceService.getSchemaName(workspaceId);
      // console.log('dataSourceSchema::', dataSourceSchema);
      const apiKeys = await this.workspaceQueryService.getApiKeys(workspaceId, dataSourceSchema, transactionManager);
      // console.log('these are the keys:', apiKeys);
      if (apiKeys.length > 0) {
        const apiKeyToken = await this.workspaceQueryService.tokenService.generateApiKeyToken(workspaceId, apiKeys[0].id, apiKeys[0].expiresAt);
        if (apiKeyToken) {
          const candidateEngagementArx = new CandidateEngagementArx(this.workspaceQueryService);
          await candidateEngagementArx.checkCandidateEngagement(apiKeyToken?.token);
        }
      }
    }
  }
}




