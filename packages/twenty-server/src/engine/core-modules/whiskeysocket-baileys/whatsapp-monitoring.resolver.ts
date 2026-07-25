import { UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import { Query } from '@nestjs/graphql';

import { PermissionFlagType } from 'twenty-shared/constants';

import { AdminResolver } from 'src/engine/api/graphql/graphql-config/decorators/admin-resolver.decorator';
import { WhatsAppMonitoringUnifiedService } from 'src/engine/core-modules/arx-chat/services/whatsapp-monitoring-unified.service';
import { AuthGraphqlApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-graphql-api-exception.filter';
import { PreventNestToAutoLogGraphqlErrorsFilter } from 'src/engine/core-modules/graphql/filters/prevent-nest-to-auto-log-graphql-errors.filter';
import { ResolverValidationPipe } from 'src/engine/core-modules/graphql/pipes/resolver-validation.pipe';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { AdminPanelGuard } from 'src/engine/guards/admin-panel-guard';
import { SettingsPermissionGuard } from 'src/engine/guards/settings-permission.guard';
import { UserAuthGuard } from 'src/engine/guards/user-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

import { WhatsAppHealthStatus } from './dtos/whatsapp-health-status.dto';
import { WhatsAppSessionStats } from './dtos/whatsapp-session-stats.dto';
import { WhatsAppSessions } from './dtos/whatsapp-sessions.dto';

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
export class WhatsAppMonitoringResolver {
  constructor(
    private readonly whatsAppMonitoringUnifiedService: WhatsAppMonitoringUnifiedService,
  ) {}

  @UseGuards(AdminPanelGuard)
  @Query(() => WhatsAppHealthStatus)
  async getWhatsAppHealthStatus(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<WhatsAppHealthStatus> {
    return this.whatsAppMonitoringUnifiedService.getWhatsAppHealthStatus(
      workspace,
    );
  }

  @UseGuards(AdminPanelGuard)
  @Query(() => WhatsAppSessionStats)
  async getWhatsAppSessionStats(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<WhatsAppSessionStats> {
    return this.whatsAppMonitoringUnifiedService.getWhatsAppSessionStats(
      workspace,
    );
  }

  @UseGuards(AdminPanelGuard)
  @Query(() => WhatsAppSessions)
  async getWhatsAppSessions(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<WhatsAppSessions> {
    return this.whatsAppMonitoringUnifiedService.getWhatsAppSessions(workspace);
  }
}
