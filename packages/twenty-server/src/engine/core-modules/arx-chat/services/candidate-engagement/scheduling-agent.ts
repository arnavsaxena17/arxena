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



@Injectable()
export class WebhookTestCronService extends BaseCronService {
  @Cron(TimeManagement.crontabs.crontTabToExecuteCandidateEngagement) // or any timing you prefer
  async handleWebhookTest() {
    console.log('Starting webhook test:', new Date().toISOString());
    
    try {
      // Test GET verification
      // const verificationResponse = await fetch('https://mrvpnl3x-3000.inc1.devtunnels.ms/webhook?hub.mode=subscribe&hub.verify_token=12345&hub.challenge=test_challenge', {
      //   method: 'GET'
      // });
      
      // console.log('Webhook GET verification response:', {
      //   status: verificationResponse.status,
      //   // body: await verificationResponse.text()
      // });

      // Test POST message
      const testMessage = {
        entry: [{
          changes: [{
            value: {
              messages: [{
                from: '1234567890',
                text: { body: 'Test message from cron' },
                type: 'text',
                timestamp: Math.floor(Date.now() / 1000)
              }],
              metadata: {
                display_phone_number: '0987654321'
              }
            }
          }]
        }]
      };

      const messageResponse = await fetch('https://mrvpnl3x-3000.inc1.devtunnels.ms/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testMessage)
      });

      console.log('Webhook POST test response:', {
        status: messageResponse.status,
        body: await messageResponse.text()
      });

    } catch (error) {
      console.error('Webhook test failed:', error);
    }
    
    console.log('Webhook test completed:', new Date().toISOString());
  }
}