import { UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import { Args, Mutation, Query } from '@nestjs/graphql';

import { PermissionFlagType } from 'twenty-shared/constants';

import { CoreResolver } from 'src/engine/api/graphql/graphql-config/decorators/core-resolver.decorator';
import { AuthGraphqlApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-graphql-api-exception.filter';
import { CreateWorkspaceMcpServerInput } from 'src/engine/core-modules/mcp-federation/dtos/create-workspace-mcp-server.input';
import { UpdateWorkspaceMcpServerInput } from 'src/engine/core-modules/mcp-federation/dtos/update-workspace-mcp-server.input';
import { WorkspaceMcpServerEntity } from 'src/engine/core-modules/mcp-federation/entities/workspace-mcp-server.entity';
import { WorkspaceMcpServerService } from 'src/engine/core-modules/mcp-federation/services/workspace-mcp-server.service';
import { ResolverValidationPipe } from 'src/engine/core-modules/graphql/pipes/resolver-validation.pipe';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { SettingsPermissionGuard } from 'src/engine/guards/settings-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { PermissionsGraphqlApiExceptionFilter } from 'src/engine/metadata-modules/permissions/utils/permissions-graphql-api-exception.filter';
import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

@CoreResolver(() => WorkspaceMcpServerEntity)
@UseFilters(AuthGraphqlApiExceptionFilter, PermissionsGraphqlApiExceptionFilter)
@UseGuards(
  WorkspaceAuthGuard,
  SettingsPermissionGuard(PermissionFlagType.WORKSPACE),
)
@UsePipes(ResolverValidationPipe)
export class WorkspaceMcpServerResolver {
  constructor(
    private readonly workspaceMcpServerService: WorkspaceMcpServerService,
  ) {}

  @Query(() => [WorkspaceMcpServerEntity])
  async workspaceMcpServers(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<WorkspaceMcpServerEntity[]> {
    return this.workspaceMcpServerService.list(workspace.id);
  }

  @Mutation(() => WorkspaceMcpServerEntity)
  async createWorkspaceMcpServer(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('input') input: CreateWorkspaceMcpServerInput,
  ): Promise<WorkspaceMcpServerEntity> {
    return this.workspaceMcpServerService.create(workspace.id, {
      ...input,
      slug: input.slug ?? input.label,
    });
  }

  @Mutation(() => WorkspaceMcpServerEntity)
  async updateWorkspaceMcpServer(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('input') input: UpdateWorkspaceMcpServerInput,
  ): Promise<WorkspaceMcpServerEntity> {
    return this.workspaceMcpServerService.update(workspace.id, input);
  }

  @Mutation(() => Boolean)
  async deleteWorkspaceMcpServer(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('id', { type: () => UUIDScalarType }) id: string,
  ): Promise<boolean> {
    return this.workspaceMcpServerService.delete(workspace.id, id);
  }

  @Mutation(() => WorkspaceMcpServerEntity)
  async syncWorkspaceMcpServerTools(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('id', { type: () => UUIDScalarType }) id: string,
  ): Promise<WorkspaceMcpServerEntity> {
    return this.workspaceMcpServerService.syncTools(workspace.id, id);
  }
}
