import { UseFilters, UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';

import {
    LinkedInUnipileHealthStatus,
    LinkedInUnipileSessionStats,
} from 'src/engine/core-modules/arx-chat/dtos/linkedin-unipile-monitoring.dto';
import { LinkedInUnipileMonitoringService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-monitoring.service';
import { AuthGraphqlApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-graphql-api-exception.filter';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { UserAuthGuard } from 'src/engine/guards/user-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

@Resolver()
@UseFilters(AuthGraphqlApiExceptionFilter)
export class LinkedInUnipileMonitoringResolver {
  constructor(
    private readonly linkedInUnipileMonitoringService: LinkedInUnipileMonitoringService,
  ) {}

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard)
  @Query(() => LinkedInUnipileHealthStatus)
  async getLinkedInUnipileHealthStatus(
    @AuthWorkspace() workspace: Workspace,
  ): Promise<LinkedInUnipileHealthStatus> {
    return this.linkedInUnipileMonitoringService.getLinkedInUnipileHealthStatus(
      workspace,
    );
  }

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard)
  @Query(() => LinkedInUnipileSessionStats)
  async getLinkedInUnipileSessionStats(
    @AuthWorkspace() workspace: Workspace,
  ): Promise<LinkedInUnipileSessionStats> {
    return this.linkedInUnipileMonitoringService.getLinkedInUnipileSessionStats(
      workspace,
    );
  }
}
