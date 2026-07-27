import { Args, Mutation, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { PermissionFlagType } from 'twenty-shared/constants';

import { MetadataResolver } from 'src/engine/api/graphql/graphql-config/decorators/metadata-resolver.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { SettingsPermissionGuard } from 'src/engine/guards/settings-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import type { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

import { AiProviderCredentialEntity } from '../entities/ai-provider-credential.entity';
import { UpsertAiProviderCredentialInput } from '../dtos/upsert-ai-provider-credential.input';
import { AiProviderCredentialsService } from '../services/ai-provider-credentials.service';

@UseGuards(
  WorkspaceAuthGuard,
  SettingsPermissionGuard(PermissionFlagType.AI_SETTINGS),
)
@MetadataResolver()
export class AiProviderCredentialsResolver {
  constructor(
    private readonly aiProviderCredentialsService: AiProviderCredentialsService,
  ) {}

  @Query(() => AiProviderCredentialEntity, { nullable: true })
  async aiProviderCredential(
    @Args('providerName') providerName: string,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<AiProviderCredentialEntity | null> {
    return this.aiProviderCredentialsService.findOne(
      workspace.id,
      providerName,
    );
  }

  @Mutation(() => AiProviderCredentialEntity)
  async upsertAiProviderCredential(
    @Args('input') input: UpsertAiProviderCredentialInput,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<AiProviderCredentialEntity> {
    return this.aiProviderCredentialsService.setApiKeyForWorkspace({
      workspaceId: workspace.id,
      providerName: input.providerName,
      apiKey: input.apiKey,
    });
  }
}

