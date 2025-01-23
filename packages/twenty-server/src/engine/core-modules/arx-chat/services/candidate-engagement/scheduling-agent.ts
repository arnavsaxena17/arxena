import CandidateEngagementArx from './candidate-engagement';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {  In, EntityManager } from 'typeorm';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { FetchAndUpdateCandidatesChatsWhatsapps } from './update-chat';
import { workspacesWithOlderSchema } from 'src/engine/core-modules/candidate-sourcing/graphql-queries';
// const workspacesToIgnore = ["",""];



// @Injectable()
// export class CandidateEngagementCronService {
//   private isProcessing = false;

//   constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}
//   @Cron(CronExpression.EVERY_30_SECONDS)
//   async handleCron() {
//     if (this.isProcessing) {
//       console.log('Previous cron job still running, skipping this run');
//       return;
//     }
//     try {
//       this.isProcessing = true;
//       console.log('Starting CRON CYCLE');
//       await this.runWorkspaceServiceCandidateEngagement();
//     } catch (error) {
//       console.log('Error in cron job', error);
//     } finally {
//       this.isProcessing = false;
//       console.log('ENDING CRON CYCLE');
//     }
//   }
//   async runWorkspaceServiceCandidateEngagement(transactionManager?: EntityManager) {
//     const workspaceIds = await this.workspaceQueryService.getWorkspaces();
//     const dataSources = await this.workspaceQueryService.dataSourceRepository.find({ where: { workspaceId: In(workspaceIds), }, });
//     const workspaceIdsWithDataSources = new Set(dataSources.map(dataSource => dataSource.workspaceId));
//     const filteredWorkspaceIds = Array.from(workspaceIdsWithDataSources).filter(workspaceId => !workspacesWithOlderSchema.includes(workspaceId));
//     console.log("Going after filteredWorkspaceIds:", filteredWorkspaceIds)
//     for (const workspaceId of filteredWorkspaceIds) {
//       const dataSourceSchema = this.workspaceQueryService.workspaceDataSourceService.getSchemaName(workspaceId);
//       const apiKeys = await this.workspaceQueryService.getApiKeys(workspaceId, dataSourceSchema, transactionManager);
//       if (apiKeys.length > 0) {
//       const apiKeyToken = await this.workspaceQueryService.tokenService.generateApiKeyToken(workspaceId, apiKeys[0].id, apiKeys[0].expiresAt);
//       if (apiKeyToken) {
//         await new CandidateEngagementArx(this.workspaceQueryService).checkCandidateEngagement(apiKeyToken?.token);
//       }
//       }
//     }
//   }


// }

// @Injectable()
// export class CandidateStatusClassificationCronService {
//   private isProcessing = false;
//   constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}
//   @Cron(CronExpression.EVERY_5_MINUTES)
//   async handleFiveMinutesCronToUpdateChatStatuses() {
//     if (this.isProcessing) {
//       console.log('Previous 5 minutes cron job still running, skipping this run');
//       return;
//     }
//     try {
//       this.isProcessing = true;
//       console.log('Starting 5 minutes for Chat Count Chat Processing  CRON CYCLE');
//       const workspaceIds = await this.workspaceQueryService.getWorkspaces();
//       const dataSources = await this.workspaceQueryService.dataSourceRepository.find({ where: { workspaceId: In(workspaceIds), }, });
//       const workspaceIdsWithDataSources = new Set(dataSources.map(dataSource => dataSource.workspaceId));
//       const filteredWorkspaceIds = Array.from(workspaceIdsWithDataSources).filter(workspaceId => !workspacesWithOlderSchema.includes(workspaceId));
//       for (const workspaceId of filteredWorkspaceIds) {
//         const dataSourceSchema = this.workspaceQueryService.workspaceDataSourceService.getSchemaName(workspaceId);
//         const apiKeys = await this.workspaceQueryService.getApiKeys(workspaceId, dataSourceSchema);
//         if (apiKeys.length > 0) {
//           const apiKeyToken = await this.workspaceQueryService.tokenService.generateApiKeyToken(workspaceId, apiKeys[0].id, apiKeys[0].expiresAt);
//           if (apiKeyToken) {
//             await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).updateRecentCandidatesChatCount(apiKeyToken.token);
//             await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).updateRecentCandidatesProcessCandidateChatsGetStatuses(apiKeyToken.token);
//           }
//         }
//       }
//     } catch (error) {
//       console.log('Error in 5 minutes cron job', error);
//     } finally {
//       this.isProcessing = false;
//       console.log('ENDING 5 minutes CRON CYCLE');
//     }
//   }
//   @Cron(CronExpression.EVERY_5_HOURS)
//   async handleFiveHoursCronToUpdateChatControls() {
//     if (this.isProcessing) {
//       console.log('Previous 5 minutes cron job still running, skipping this run');
//       return;
//     }
//     try {
//       this.isProcessing = true;
//       console.log('Starting 5 minutes for Chat Count Chat Processing  CRON CYCLE');
//       const workspaceIds = await this.workspaceQueryService.getWorkspaces();
//       const dataSources = await this.workspaceQueryService.dataSourceRepository.find({ where: { workspaceId: In(workspaceIds), }, });
//       const workspaceIdsWithDataSources = new Set(dataSources.map(dataSource => dataSource.workspaceId));
//       const filteredWorkspaceIds = Array.from(workspaceIdsWithDataSources).filter(workspaceId => !workspacesWithOlderSchema.includes(workspaceId));
//       for (const workspaceId of filteredWorkspaceIds) {
//         const dataSourceSchema = this.workspaceQueryService.workspaceDataSourceService.getSchemaName(workspaceId);
//         const apiKeys = await this.workspaceQueryService.getApiKeys(workspaceId, dataSourceSchema);
//         if (apiKeys.length > 0) {
//           const apiKeyToken = await this.workspaceQueryService.tokenService.generateApiKeyToken(workspaceId, apiKeys[0].id, apiKeys[0].expiresAt);
//           if (apiKeyToken) {
//             await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).updateRecentCandidatesChatControls(apiKeyToken.token);
//           }
//         }
//       }
//     } catch (error) {
//       console.log('Error in 5 minutes cron job', error);
//     } finally {
//       this.isProcessing = false;
//       console.log('ENDING 5 minutes CRON CYCLE');
//     }
//   }

// }




@Injectable()
abstract class BaseCronService {
  protected isProcessing = false;
  
  constructor(protected readonly workspaceQueryService: WorkspaceQueryService) {}

  protected async executeWorkspaceTask(callback: (token: string) => Promise<void>) {
    if (this.isProcessing) {
      console.log('Previous job still running, skipping');
      return;
    }

    try {
      this.isProcessing = true;
      console.log('Starting cycle');
      
      const workspaces = await this.getFilteredWorkspaces();
      
      for (const workspaceId of workspaces) {
        const token = await this.getWorkspaceToken(workspaceId);
        if (token) await callback(token);
      }
    } catch (error) {
      console.log('Error in job', error);
    } finally {
      this.isProcessing = false;
      console.log('Ending cycle');
    }
  }

  private async getFilteredWorkspaces(): Promise<string[]> {
    const workspaceIds = await this.workspaceQueryService.getWorkspaces();
    const dataSources = await this.workspaceQueryService.dataSourceRepository.find({
      where: { workspaceId: In(workspaceIds) }
    });
    return Array.from(new Set(dataSources.map(ds => ds.workspaceId)))
      .filter(id => !workspacesWithOlderSchema.includes(id));
  }

  private async getWorkspaceToken(workspaceId: string): Promise<string | null> {
    const schema = this.workspaceQueryService.workspaceDataSourceService.getSchemaName(workspaceId);
    const apiKeys = await this.workspaceQueryService.getApiKeys(workspaceId, schema);
    
    if (!apiKeys.length) return null;
    
    const token = await this.workspaceQueryService.tokenService
      .generateApiKeyToken(workspaceId, apiKeys[0].id, apiKeys[0].expiresAt);
    
    return token?.token || null;
  }
}


@Injectable()
export class CandidateEngagementCronService extends BaseCronService {
  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleCron() {
    await this.executeWorkspaceTask(async (token) => {
      await new CandidateEngagementArx(this.workspaceQueryService)
        .checkCandidateEngagement(token);
    });
  }
}

@Injectable()
export class CandidateStatusClassificationCronService extends BaseCronService {
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleFiveMinutesCron() {
    await this.executeWorkspaceTask(async (token) => {
      const service = new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService);
      await service.updateRecentCandidatesChatCount(token);
      await service.updateRecentCandidatesProcessCandidateChatsGetStatuses(token);
    });
  }

  @Cron(CronExpression.EVERY_5_HOURS)
  async handleFiveHoursCron() {
    await this.executeWorkspaceTask(async (token) => {
      await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService)
        .updateRecentCandidatesChatControls(token);
    });
  }
}