import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { In } from 'typeorm';

import { CandidateEngagementArx } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/candidate-engagement';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { TimeManagement } from '../../arx-chat/services/time-management';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';

const CRON_DISABLED = process.env.NODE_ENV === 'production' ? false : false;

@Injectable()
export class CandidateEngagementCronService {
  private isProcessing = false;
  private readonly logger = new Logger(CandidateEngagementCronService.name);

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

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
      const uniqueWorkspaceIds = Array.from(new Set(dataSources.map((ds) => ds.workspaceId)));
      for (const workspaceId of uniqueWorkspaceIds) {
        try {
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
      this.logger.log('Ending candidate engagement cycle');
    }
  }
} 