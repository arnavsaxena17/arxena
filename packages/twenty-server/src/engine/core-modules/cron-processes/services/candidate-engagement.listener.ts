import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { CandidateEngagementArx } from '../../arx-chat/services/candidate-engagement/candidate-engagement';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';

@Injectable()
export class CandidateEngagementListener {
  private readonly logger = new Logger(CandidateEngagementListener.name);

  @OnEvent('candidate.engagement.process')
  async handleCandidateEngagement(payload: {
    workspaceId: string;
    workspaceQueryService: WorkspaceQueryService;
    staticGraphQLService: StaticGraphQLService;
  }) {
    const { workspaceId, workspaceQueryService, staticGraphQLService } = payload;

    try {
      const schema = workspaceQueryService.workspaceDataSourceService.getSchemaName(workspaceId);
      const apiKeys = await workspaceQueryService.getApiKeys(workspaceId, schema);
      
      if (!apiKeys || !apiKeys.length) {
        return;
      }

      const token = await workspaceQueryService.apiKeyService.generateApiKeyToken(workspaceId, apiKeys[0].id);
      if (!token?.token) {
        return;
      }

      await new CandidateEngagementArx(
        workspaceQueryService,
        staticGraphQLService
      ).executeCandidateEngagement(token.token);

    } catch (error) {
      this.logger.error(`Error processing workspace ${workspaceId}:`, error);
    }
  }
} 