import { Injectable, Logger } from '@nestjs/common';

import {
    LinkedInUnipileHealthStatus,
    LinkedInUnipileSessionStats,
} from 'src/engine/core-modules/arx-chat/dtos/linkedin-unipile-monitoring.dto';
import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';

type LinkedInAccountRow = {
  id?: string;
  username?: string;
  name?: string;
  status?: 'connected' | 'disconnected' | 'pending' | 'checkpoint_required';
  created_at?: string;
};

@Injectable()
export class LinkedInUnipileMonitoringService {
  private readonly logger = new Logger(LinkedInUnipileMonitoringService.name);

  constructor(
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {}

  async getLinkedInUnipileHealthStatus(
    workspace: Workspace,
  ): Promise<LinkedInUnipileHealthStatus> {
    const accounts = await this.fetchAccounts(workspace);
    const metrics = accounts.map((a) => this.accountToMetric(a));
    const active = metrics.filter((m) => m.isActive).length;

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      sessions: {
        total: metrics.length,
        active,
        inactive: metrics.length - active,
      },
      metrics,
    };
  }

  async getLinkedInUnipileSessionStats(
    workspace: Workspace,
  ): Promise<LinkedInUnipileSessionStats> {
    const accounts = await this.fetchAccounts(workspace);
    const metrics = accounts.map((a) => this.accountToMetric(a));
    const active = metrics.filter((m) => m.isActive).length;
    const total = metrics.length;

    return {
      totalSessions: total,
      activeSessions: active,
      inactiveSessions: total - active,
      registeredSessions: total,
      totalMemoryUsageMB: 0,
      averageMemoryPerSessionMB: 0,
      memoryEfficiency: total > 0 ? (active / total) * 100 : 0,
    };
  }

  private async fetchAccounts(workspace: Workspace): Promise<LinkedInAccountRow[]> {
    const keys = await this.workspaceQueryService.getWorkspaceKeys(workspace.id);
    if (
      !keys.linkedin_url?.trim() &&
      !keys.linkedin_unipile_account_id?.trim()
    ) {
      return [];
    }

    try {
      const result = await this.linkedinUnipileRequestService.getAllAccounts(
        workspace,
      );
      return (result?.accounts ?? []) as LinkedInAccountRow[];
    } catch (err) {
      this.logger.warn(
        `LinkedIn getAllAccounts failed for monitoring: ${err instanceof Error ? err.message : err}`,
      );
      return [];
    }
  }

  private accountToMetric(account: LinkedInAccountRow) {
    const status = account.status ?? 'disconnected';
    const isActive = status === 'connected';
    const lastActivity = account.created_at
      ? new Date(account.created_at).toISOString()
      : new Date().toISOString();
    const label =
      account.username ||
      account.name ||
      account.id ||
      'linkedin';

    return {
      recruiterId: `linkedin:${label}`,
      lastActivity,
      connectionCount: isActive ? 1 : 0,
      isActive,
      memoryUsageMB: 0,
      isRegistered: true,
      hasAuthFiles: true,
      hasWebSocketConnection: isActive,
      linkedinConnectionStatus: this.mapStatusForUi(status),
    };
  }

  private mapStatusForUi(
    status: LinkedInAccountRow['status'],
  ): string {
    if (status === 'connected') {
      return 'connected';
    }
    if (status === 'pending') {
      return 'connecting';
    }
    if (status === 'checkpoint_required') {
      return 'connecting';
    }
    return 'disconnected';
  }
}
