import CandidateEngagementArx from './candidate-engagement';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { In } from 'typeorm';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { UpdateChat } from './update-chat';
import { workspacesWithOlderSchema } from 'src/engine/core-modules/candidate-sourcing/graphql-queries';
import { TimeManagement } from '../time-management';


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

    const token = await this.workspaceQueryService.tokenService.generateApiKeyToken(workspaceId, apiKeys[0].id, apiKeys[0].expiresAt);

    return token?.token || null;
  }
}

const CRON_DISABLED = false;

@Injectable()
export class CandidateEngagementCronService extends BaseCronService {
  @Cron(TimeManagement.crontabs.crontTabToExecuteCandidateEngagement, { disabled: CRON_DISABLED })
  async handleCron() {
    if (CRON_DISABLED) return;
    await this.executeWorkspaceTask(async token => {
      await new CandidateEngagementArx(this.workspaceQueryService).executeCandidateEngagement(token);
    });
  }
}

@Injectable()
export class CandidateStatusClassificationCronService extends BaseCronService {
  @Cron(TimeManagement.crontabs.crontTabToMakeUpdatesForNewChats, { disabled: CRON_DISABLED })
  async handleFiveMinutesCron() {
    if (CRON_DISABLED) return;
    await this.executeWorkspaceTask(async token => {
      const service = new UpdateChat(this.workspaceQueryService).makeUpdatesForNewChats(token);
    });
  }

  @Cron(TimeManagement.crontabs.crontTabToUpdateRecentCandidatesChatControls, { disabled: CRON_DISABLED })
  async handleFiveHoursCron() {
    if (CRON_DISABLED) return;
    await this.executeWorkspaceTask(async token => {
      await new CandidateEngagementArx(this.workspaceQueryService).updateRecentCandidatesChatControls(token);
    });
  }
}
