import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Injectable } from '@nestjs/common';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
// import { WorkspaceQueryService } from '../workspace-query.service';

@Injectable()
export class LLMProviders {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService
  ) {}

  async initializeLLMClients(workspaceId: string) {
    const openAIKey = await this.getWorkspaceApiKey(workspaceId, 'OPENAI_API_KEY') || process.env.OPENAI_API_KEY;
    const anthropicKey = await this.getWorkspaceApiKey(workspaceId, 'ANTHROPIC_API_KEY') || process.env.ANTHROPIC_API_KEY;

    return {
      openAIclient: new OpenAI({ apiKey: openAIKey }),
      anthropic: new Anthropic({ apiKey: anthropicKey })
    };
  }

  private async getWorkspaceApiKey(workspaceId: string, keyName: string): Promise<string | null> {
    try {
      const dataSourceSchema = this.workspaceQueryService.workspaceDataSourceService.getSchemaName(workspaceId);
      
      const workspaceSettings = await this.workspaceQueryService.executeRawQuery(
        `SELECT * FROM ${dataSourceSchema}."workspaceSettings" WHERE "settingKey" = $1 LIMIT 1`,
        [keyName],
        workspaceId
      );

      return workspaceSettings[0]?.settingValue || null;
    } catch (error) {
      console.error(`Error fetching ${keyName} for workspace ${workspaceId}:`, error);
      return null;
    }
  }
}