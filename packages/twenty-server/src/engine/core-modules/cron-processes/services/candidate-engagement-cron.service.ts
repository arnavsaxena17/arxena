import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { In } from 'typeorm';

import { CandidateEngagementArx } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/candidate-engagement';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { TimeManagement } from '../../arx-chat/services/time-management';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';

const CRON_DISABLED = process.env.NODE_ENV === 'production' ? false : false;
const WORKSPACE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes timeout per workspace
const MAX_CONCURRENT_WORKSPACES = 3; // Process 3 workspaces at a time

@Injectable()
export class CandidateEngagementCronService {
  private isProcessing = false;
  private readonly logger = new Logger(CandidateEngagementCronService.name);

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  private async processWorkspaceWithTimeout(
    workspaceId: string,
    schema: string,
  ): Promise<void> {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout processing workspace ${workspaceId}`));
      }, WORKSPACE_TIMEOUT_MS);
    });

    const processingPromise = async () => {
      const apiKeys = await this.workspaceQueryService.getApiKeys(workspaceId, schema);
      
      if (!apiKeys.length) {
        this.logger.warn(`No API keys found for workspace ${workspaceId}`);
        return;
      }

      const token = await this.workspaceQueryService.apiKeyService.generateApiKeyToken(workspaceId, apiKeys[0].id);
      if (!token?.token) {
        this.logger.warn(`Could not generate token for workspace ${workspaceId}`);
        return;
      }

      await new CandidateEngagementArx(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).executeCandidateEngagement(token.token);
    };

    try {
      await Promise.race([processingPromise(), timeoutPromise]);
      this.logger.log(`Successfully processed workspace ${workspaceId}`);
    } catch (error) {
      if (error.message.includes('Timeout')) {
        this.logger.error(`Timeout processing workspace ${workspaceId}`);
      } else {
        this.logger.error(`Error processing workspace ${workspaceId}:`, error);
      }
      throw error;
    }
  }

  private async processBatch(workspaces: Array<{ id: string; schema: string }>) {
    const results = await Promise.allSettled(
      workspaces.map(({ id, schema }) =>
        this.processWorkspaceWithTimeout(id, schema),
      ),
    );

    results.forEach((result, index) => {
      const workspaceId = workspaces[index].id;
      if (result.status === 'rejected') {
        this.logger.error(
          `Failed to process workspace ${workspaceId}: ${result.reason}`,
        );
      }
    });
  }

  @Cron(TimeManagement.crontabs.crontTabToExecuteCandidateEngagement, {
    name: 'candidate-engagement-task',
    disabled: CRON_DISABLED,
  })
  async handleCron() {
    if (this.isProcessing) {
      this.logger.warn('Previous job still running, skipping');
      return;
    }

    try {
      this.isProcessing = true;
      this.logger.log('Starting candidate engagement cycle');
      
      const workspaceIds = await this.workspaceQueryService.getWorkspaces();
      this.logger.log(`Processing ${workspaceIds.length} workspaces`);

      const dataSources = await this.workspaceQueryService.dataSourceRepository.find({
        where: { workspaceId: In(workspaceIds) },
      });

      const uniqueWorkspaces = Array.from(
        new Set(dataSources.map((ds) => ds.workspaceId)),
      ).map((id) => ({
        id,
        schema: this.workspaceQueryService.workspaceDataSourceService.getSchemaName(id),
      }));

      // Process workspaces in batches
      for (let i = 0; i < uniqueWorkspaces.length; i += MAX_CONCURRENT_WORKSPACES) {
        const batch = uniqueWorkspaces.slice(i, i + MAX_CONCURRENT_WORKSPACES);
        await this.processBatch(batch);
        
        // Add a small delay between batches to prevent overwhelming the system
        if (i + MAX_CONCURRENT_WORKSPACES < uniqueWorkspaces.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      
    } catch (error) {
      this.logger.error('Error in candidate engagement job:', error);
    } finally {
      this.isProcessing = false;
      this.logger.log('Ending candidate engagement cycle');
    }
  }
} 