import { UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import { Query } from '@nestjs/graphql';

import { PermissionFlagType } from 'twenty-shared/constants';

import { AdminResolver } from 'src/engine/api/graphql/graphql-config/decorators/admin-resolver.decorator';
import {
  LinkedInUnipileHealthStatus,
  LinkedInUnipileSessionStats,
} from 'src/engine/core-modules/arx-chat/dtos/linkedin-unipile-monitoring.dto';
import { LinkedInUnipileMonitoringService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-monitoring.service';
import { AuthGraphqlApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-graphql-api-exception.filter';
import { PreventNestToAutoLogGraphqlErrorsFilter } from 'src/engine/core-modules/graphql/filters/prevent-nest-to-auto-log-graphql-errors.filter';
import { ResolverValidationPipe } from 'src/engine/core-modules/graphql/pipes/resolver-validation.pipe';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { AdminPanelGuard } from 'src/engine/guards/admin-panel-guard';
import { SettingsPermissionGuard } from 'src/engine/guards/settings-permission.guard';
import { UserAuthGuard } from 'src/engine/guards/user-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

@UsePipes(ResolverValidationPipe)
@AdminResolver()
@UseFilters(
  AuthGraphqlApiExceptionFilter,
  PreventNestToAutoLogGraphqlErrorsFilter,
)
@UseGuards(
  WorkspaceAuthGuard,
  UserAuthGuard,
  SettingsPermissionGuard(PermissionFlagType.SECURITY),
)
export class LinkedInUnipileMonitoringResolver {
  constructor(
    private readonly linkedInUnipileMonitoringService: LinkedInUnipileMonitoringService,
  ) {}

  @UseGuards(AdminPanelGuard)
  @Query(() => LinkedInUnipileHealthStatus)
  async getLinkedInUnipileHealthStatus(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<LinkedInUnipileHealthStatus> {
    return this.linkedInUnipileMonitoringService.getLinkedInUnipileHealthStatus(
      workspace,
    );
  }

  @UseGuards(AdminPanelGuard)
  @Query(() => LinkedInUnipileSessionStats)
  async getLinkedInUnipileSessionStats(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<LinkedInUnipileSessionStats> {
    return this.linkedInUnipileMonitoringService.getLinkedInUnipileSessionStats(
      workspace,
    );
  }
}
