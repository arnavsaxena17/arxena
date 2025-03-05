import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { In } from 'typeorm';
import { TimeManagement } from '../time-management';
import CandidateEngagementArx, { workspacesWithOlderSchema } from './candidate-engagement';


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
      where: { workspaceId: In(workspaceIds) },
    });
    return Array.from(new Set(dataSources.map(ds => ds.workspaceId))).filter(id => !workspacesWithOlderSchema.includes(id));
  }

  private async getWorkspaceToken(workspaceId: string): Promise<string | null> {
    const schema = this.workspaceQueryService.workspaceDataSourceService.getSchemaName(workspaceId);
    const apiKeys = await this.workspaceQueryService.getApiKeys(workspaceId, schema);
    if (!apiKeys.length) return null;
    const token = await this.workspaceQueryService.apiKeyService.generateApiKeyToken(workspaceId, apiKeys[0].id);
    return token?.token || null;
  }
}

const CRON_DISABLED = true;

@Injectable()
export class CandidateEngagementCronService extends BaseCronService {
  @Cron(TimeManagement.crontabs.crontTabToExecuteCandidateEngagement, { name:'my-scheduled-task2', disabled: CRON_DISABLED })
  async handleCron() {
    if (CRON_DISABLED) return;
    await this.executeWorkspaceTask(async token => {
      await new CandidateEngagementArx(this.workspaceQueryService).executeCandidateEngagement(token);
    });
  }
}

@Injectable()
export class CandidateStatusClassificationCronService extends BaseCronService {

  @Cron(TimeManagement.crontabs.crontTabToUpdateCandidatesChatControls, { name: 'my-scheduled-task1', disabled: true })
  async handleFiveHoursCron() {
    if (CRON_DISABLED) return;
    await this.executeWorkspaceTask(async token => {
      await new CandidateEngagementArx(this.workspaceQueryService).updateCandidatesChatControls(token);
    });
  }
}


