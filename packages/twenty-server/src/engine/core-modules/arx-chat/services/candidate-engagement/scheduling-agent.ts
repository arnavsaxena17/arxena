import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { In } from 'typeorm';

import { TimeManagement } from 'src/engine/core-modules/arx-chat/services/time-management';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

import { Semaphore } from 'src/engine/core-modules/arx-chat/utils/semaphore';
import CandidateEngagementArx, {
  workspacesWithOlderSchema,
} from './candidate-engagement';

@Injectable()
abstract class BaseCronService {
  protected isProcessing = false;
  private readonly maxConcurrency = 50; // Adjust based on your resources

  constructor(
    protected readonly workspaceQueryService: WorkspaceQueryService,
  ) {}

  protected async executeWorkspaceTask(
    callback: (token: string) => Promise<void>,
  ) {
    if (this.isProcessing) {
      console.log('Previous job still running, skipping');
      return;
    }

    try {
      this.isProcessing = true;
      console.log('Starting cycle');
      
      const workspaces = await this.getFilteredWorkspaces();
      console.log(`Processing ${workspaces.length} workspaces`);

      // Process in batches with controlled concurrency
      await this.processConcurrently(workspaces, callback);
      
    } catch (error) {
      console.log('Error in job', error);
    } finally {
      this.isProcessing = false;
      console.log('Ending cycle');
    }
  }

  private async processConcurrently(
    workspaces: string[],
    callback: (token: string) => Promise<void>,
  ) {
    const semaphore = new Semaphore(this.maxConcurrency);
    
    const processWorkspace = async (workspaceId: string) => {
      await semaphore.acquire();
      try {
        const token = await this.getWorkspaceToken(workspaceId);
        if (token) {
          await callback(token); // Only pass token
        }
      } catch (error) {
        console.error(`Error processing workspace ${workspaceId}:`, error);
      } finally {
        semaphore.release();
      }
    };
      // Process all workspaces concurrently with controlled concurrency
    await Promise.all(workspaces.map(processWorkspace));
  }

  private async getFilteredWorkspaces(): Promise<string[]> {
    const workspaceIds = await this.workspaceQueryService.getWorkspaces();
    const dataSources =
      await this.workspaceQueryService.dataSourceRepository.find({
        where: { workspaceId: In(workspaceIds) },
      });

    return Array.from(new Set(dataSources.map((ds) => ds.workspaceId))).filter(
      (id) => !workspacesWithOlderSchema.includes(id),
    );
  }

  private async getWorkspaceToken(workspaceId: string): Promise<string | null> {
    const schema =
      this.workspaceQueryService.workspaceDataSourceService.getSchemaName(
        workspaceId,
      );
    const apiKeys = await this.workspaceQueryService.getApiKeys(
      workspaceId,
      schema,
    );

    if (!apiKeys.length) return null;
    const token =
      await this.workspaceQueryService.apiKeyService.generateApiKeyToken(
        workspaceId,
        apiKeys[0].id,
      );

    return token?.token || null;
  }
}

// const CRON_DISABLED = process.env.ENV_NODE === 'production' ? false : true;
const CRON_DISABLED = false;

@Injectable()
export class CandidateEngagementCronService extends BaseCronService {
  @Cron(TimeManagement.crontabs.crontTabToExecuteCandidateEngagement, {
    name: 'my-scheduled-task2', 
    disabled: CRON_DISABLED,
  })
  async handleCron() {
    console.log('========== SCHEDULING AGENT MODULE LOADED ==========');
    console.log('handleCron');
    if (CRON_DISABLED) return;
    await this.executeWorkspaceTask(async (token) => {
      await new CandidateEngagementArx(
        this.workspaceQueryService,
      ).executeCandidateEngagement(token);
    });
  }
}

@Injectable()
export class CandidateStatusClassificationCronService extends BaseCronService {
  @Cron(TimeManagement.crontabs.crontTabToUpdateCandidatesChatControls, {
    name: 'my-scheduled-task1',
    disabled: true,
  })
  async handleFiveHoursCron() {
    if (CRON_DISABLED) return;
    await this.executeWorkspaceTask(async (token) => {
      await new CandidateEngagementArx(
        this.workspaceQueryService,
      ).updateCandidatesChatControls(token);
    });
  }
}


@Injectable()
export class LinkedinSockIncomingMessageFetchingCronService extends BaseCronService {
  @Cron(TimeManagement.crontabs.crontTabToFetchLinkedinSockMessages, {
    name: 'fetch-linkedin-messages',
    disabled: true,
  })
  async handleFiveHoursCron() {
    if (CRON_DISABLED) return;
    await this.executeWorkspaceTask(async (token) => {
      await new CandidateEngagementArx(
        this.workspaceQueryService,
      ).fetchLinkedinSockMessages(token);
    });
  }
}
