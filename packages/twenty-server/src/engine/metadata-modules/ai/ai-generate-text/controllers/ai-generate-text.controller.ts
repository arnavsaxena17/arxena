import { Body, Controller, Post, UseFilters, UseGuards } from '@nestjs/common';

import { PermissionFlagType } from 'twenty-shared/constants';

import { RestApiExceptionFilter } from 'src/engine/api/rest/rest-api-exception.filter';
import { UsageOperationType } from 'src/engine/core-modules/usage/enums/usage-operation-type.enum';
import type { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthUserWorkspaceId } from 'src/engine/decorators/auth/auth-user-workspace-id.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { SettingsPermissionGuard } from 'src/engine/guards/settings-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { AiBillingService } from 'src/engine/metadata-modules/ai/ai-billing/services/ai-billing.service';
import { AiSdkExecutionService } from 'src/engine/metadata-modules/ai/ai-billing/services/ai-sdk-execution.service';
import { AiRestApiExceptionFilter } from 'src/engine/metadata-modules/ai/filters/ai-api-exception.filter';
import { GenerateTextInput } from 'src/engine/metadata-modules/ai/ai-generate-text/dtos/generate-text.input';
import { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';
import { PermissionsRestApiExceptionFilter } from 'src/engine/metadata-modules/permissions/utils/permissions-rest-api-exception.filter';

@Controller('rest/ai')
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
@UseFilters(
  PermissionsRestApiExceptionFilter,
  AiRestApiExceptionFilter,
  RestApiExceptionFilter,
)
export class AiGenerateTextController {
  constructor(
    private readonly aiModelRegistryService: AiModelRegistryService,
    private readonly aiBillingService: AiBillingService,
    private readonly aiSdkExecutionService: AiSdkExecutionService,
  ) {}

  @Post('generate-text')
  @UseGuards(SettingsPermissionGuard(PermissionFlagType.AI))
  async handleGenerateText(
    @Body() body: GenerateTextInput,
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUserWorkspaceId() userWorkspaceId: string,
  ) {
    const resolvedModelId = body.modelId ?? workspace.fastModel;

    this.aiModelRegistryService.validateModelAvailability(
      resolvedModelId,
      workspace,
    );

    await this.aiBillingService.assertHasAvailableCreditsOrThrow(
      workspace.id,
      resolvedModelId,
    );

    const registeredModel =
      await this.aiModelRegistryService.resolveModelForAgentInWorkspace(
        { modelId: resolvedModelId },
        workspace.id,
      );

    const modelConfig = this.aiModelRegistryService.getEffectiveModelConfig(
      registeredModel.modelId,
    );

    const result = await this.aiSdkExecutionService.generateText({
      workspaceId: workspace.id,
      modelId: registeredModel.modelId,
      operationType: UsageOperationType.AI_WORKFLOW_TOKEN,
      userWorkspaceId,
      options: {
        model: registeredModel.model,
        system: body.systemPrompt,
        prompt: body.userPrompt,
        maxOutputTokens: modelConfig.maxOutputTokens,
      },
    });

    return {
      text: result.text,
      usage: {
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
      },
    };
  }
}
