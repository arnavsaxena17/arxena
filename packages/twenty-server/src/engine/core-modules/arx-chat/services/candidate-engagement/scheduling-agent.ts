import CandidateEngagementArx from './candidate-engagement';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { In, EntityManager } from 'typeorm';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { UpdateChat } from './update-chat';
import { workspacesWithOlderSchema } from 'src/engine/core-modules/candidate-sourcing/graphql-queries';
import { ChatControls } from './chat-controls';
import * as allDataObjects from '../../services/data-model-objects';

export let TimeManagement;

const TimeManagementLocal = {
  crontabs: {
    crontTabToExecuteCandidateEngagement: CronExpression.EVERY_5_SECONDS,
    crontTabToMakeUpdatesForNewChats: CronExpression.EVERY_30_SECONDS,
    crontTabToUpdateRecentCandidatesChatControls: CronExpression.EVERY_10_SECONDS
  },
  timeDifferentials: {
    timeDifferentialinMinutesToCheckTimeDifferentialBetweenlastMessage: 0.33, // 20 seconds
    timeDifferentialinMinutesForCheckingCandidateIdsToMakeUpdatesOnChatsForNextChatControls: 0.5, // 30 seconds
    timeDifferentialinHoursForCheckingCandidateIdsWithStatusOfConversationClosed: 0.016, // ~1 minute
    timeDifferentialinHoursForCheckingCandidateIdsWithVideoInterviewCompleted: 0.016 // ~1 minute
  }
};

const TimeManagementProd = {
  crontabs: {
    crontTabToExecuteCandidateEngagement: CronExpression.EVERY_30_SECONDS,
    crontTabToMakeUpdatesForNewChats: CronExpression.EVERY_5_MINUTES,
    crontTabToUpdateRecentCandidatesChatControls: CronExpression.EVERY_10_SECONDS
  },
  timeDifferentials: {
    timeDifferentialinMinutesToCheckTimeDifferentialBetweenlastMessage: 4,
    timeDifferentialinMinutesForCheckingCandidateIdsToMakeUpdatesOnChatsForNextChatControls: 30,
    timeDifferentialinHoursForCheckingCandidateIdsWithStatusOfConversationClosed: 3,
    timeDifferentialinHoursForCheckingCandidateIdsWithVideoInterviewCompleted: 6
  }
};

const CRON_DISABLED = false;
console.log("process.env.ENV_NODE::", process.env.ENV_NODE)
if (process.env.ENV_NODE === 'production') {
  TimeManagement = TimeManagementProd;
} else {
  TimeManagement = TimeManagementLocal;
}

console.log("TimeManagement::", TimeManagement);

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
  @Cron(TimeManagement.crontabs.crontTabToExecuteCandidateEngagement, { disabled: CRON_DISABLED })
  async handleCron() {
    if (CRON_DISABLED) return;
    await this.executeWorkspaceTask(async (token) => {
      await new CandidateEngagementArx(this.workspaceQueryService)
        .executeCandidateEngagement(token);
    });
  }
}

@Injectable()
export class CandidateStatusClassificationCronService extends BaseCronService {
  @Cron(TimeManagement.crontabs.crontTabToMakeUpdatesForNewChats, {disabled: CRON_DISABLED})
  async handleFiveMinutesCron() {
    if (CRON_DISABLED) return;
    await this.executeWorkspaceTask(async (token) => {
      const service = new UpdateChat(this.workspaceQueryService)
        .makeUpdatesForNewChats(token);
    });
  }

  @Cron(TimeManagement.crontabs.crontTabToUpdateRecentCandidatesChatControls, { disabled: CRON_DISABLED })
  async handleFiveHoursCron() {
    if (CRON_DISABLED) return;
    await this.executeWorkspaceTask(async (token) => {
      await new ChatControls(this.workspaceQueryService)
        .updateRecentCandidatesChatControls(token);
    });
  }
}