import { UseFilters, UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';

import { WhatsAppMonitoringUnifiedService } from 'src/engine/core-modules/arx-chat/services/whatsapp-monitoring-unified.service';
import { AuthGraphqlApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-graphql-api-exception.filter';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { UserAuthGuard } from 'src/engine/guards/user-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

import { WhatsAppHealthStatus } from './dtos/whatsapp-health-status.dto';
import { WhatsAppSessionStats } from './dtos/whatsapp-session-stats.dto';
import { WhatsAppSessions } from './dtos/whatsapp-sessions.dto';

@Resolver()
@UseFilters(AuthGraphqlApiExceptionFilter)
export class WhatsAppMonitoringResolver {
  constructor(
    private readonly whatsAppMonitoringUnifiedService: WhatsAppMonitoringUnifiedService,
  ) {}

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard)
  @Query(() => WhatsAppHealthStatus)
  async getWhatsAppHealthStatus(
    @AuthWorkspace() workspace: Workspace,
  ): Promise<WhatsAppHealthStatus> {
    return this.whatsAppMonitoringUnifiedService.getWhatsAppHealthStatus(
      workspace,
    );
  }

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard)
  @Query(() => WhatsAppSessionStats)
  async getWhatsAppSessionStats(
    @AuthWorkspace() workspace: Workspace,
  ): Promise<WhatsAppSessionStats> {
    return this.whatsAppMonitoringUnifiedService.getWhatsAppSessionStats(
      workspace,
    );
  }

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard)
  @Query(() => WhatsAppSessions)
  async getWhatsAppSessions(
    @AuthWorkspace() workspace: Workspace,
  ): Promise<WhatsAppSessions> {
    return this.whatsAppMonitoringUnifiedService.getWhatsAppSessions(workspace);
  }
}
