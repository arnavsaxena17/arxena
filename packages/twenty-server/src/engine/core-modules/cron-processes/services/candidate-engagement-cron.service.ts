import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { In } from 'typeorm';

import { CandidateEngagementArx } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/candidate-engagement';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { TimeManagement } from '../../arx-chat/services/time-management';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';

const CRON_DISABLED = process.env.NODE_ENV === 'production' ? false : true;
const MAX_JOB_DURATION_MS = 2 * 60 * 1000; // 2 minutes in milliseconds

@Injectable()
export class CandidateEngagementCronService {
  private isProcessing = false;
  private jobStartTime: number | null = null;
  private readonly logger = new Logger(CandidateEngagementCronService.name);

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  private checkAndResetStaleJob(): boolean {
    if (!this.isProcessing || !this.jobStartTime) {
      return false;
    }

    const jobDuration = Date.now() - this.jobStartTime;
    if (jobDuration > MAX_JOB_DURATION_MS) {
      this.logger.warn(`Job running for ${jobDuration}ms exceeded max duration of ${MAX_JOB_DURATION_MS}ms. Force resetting.`);
      this.isProcessing = false;
      this.jobStartTime = null;
      return true;
    }
    return false;
  }

  @Cron(TimeManagement.crontabs.crontTabToExecuteCandidateEngagement, {
    name: 'candidate-engagement-task',
    disabled: CRON_DISABLED,
  })
  async handleCron() {
    // Check for and reset stale job before starting new one
    this.checkAndResetStaleJob();

    if (this.isProcessing) {
      this.logger.warn('Previous job still running, skipping');
      return;
    }

    try {
      this.isProcessing = true;
      this.jobStartTime = Date.now();
      this.logger.log('Starting candidate engagement cycle');
      
      const workspaceIds = await this.workspaceQueryService.getWorkspaces();
      this.logger.log(`Processing ${workspaceIds.length} workspaces`);

      const dataSources = await this.workspaceQueryService.dataSourceRepository.find({
        where: { workspaceId: In(workspaceIds) },
      });

      const uniqueWorkspaceIds = Array.from(new Set(dataSources.map((ds) => ds.workspaceId)));
      
      for (const workspaceId of uniqueWorkspaceIds) {
        try {
          // Check job duration before processing each workspace
          if (this.checkAndResetStaleJob()) {
            this.logger.warn('Job exceeded maximum duration, stopping processing');
            return;
          }

          const schema = this.workspaceQueryService.workspaceDataSourceService.getSchemaName(workspaceId);
          const apiKeys = await this.workspaceQueryService.getApiKeys(workspaceId, schema);
          
          if (!apiKeys.length) {
            continue;
          }

          const token = await this.workspaceQueryService.apiKeyService.generateApiKeyToken(workspaceId, apiKeys[0].id);
          if (!token?.token) {
            continue;
          }

          await new CandidateEngagementArx(
            this.workspaceQueryService,
            this.staticGraphQLService,
          ).executeCandidateEngagement(token.token);

        } catch (error) {
          this.logger.error(`Error processing workspace ${workspaceId}:`, error);
        }
      }
      
    } catch (error) {
      this.logger.error('Error in candidate engagement job:', error);
    } finally {
      this.isProcessing = false;
      this.jobStartTime = null;
      this.logger.log('Ending candidate engagement cycle');
    }
  }
} 