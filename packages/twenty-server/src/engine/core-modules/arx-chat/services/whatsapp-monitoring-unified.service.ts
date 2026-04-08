import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { WhatsappUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/whatsapp-unipile-request.service';
import { WhatsAppHealthStatus } from 'src/engine/core-modules/whiskeysocket-baileys/dtos/whatsapp-health-status.dto';
import { WhatsAppSessionStats } from 'src/engine/core-modules/whiskeysocket-baileys/dtos/whatsapp-session-stats.dto';
import { WhatsAppSessions } from 'src/engine/core-modules/whiskeysocket-baileys/dtos/whatsapp-sessions.dto';
import { EventsGateway } from 'src/engine/core-modules/whiskeysocket-baileys/events-gateway-module/events-gateway';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';

type UnipileAccountRow = {
  id?: string;
  username?: string;
  name?: string;
  phone_number?: string;
  status?: 'connected' | 'disconnected' | 'pending' | 'connecting';
  created_at?: string;
};

@Injectable()
export class WhatsAppMonitoringUnifiedService {
  private readonly logger = new Logger(WhatsAppMonitoringUnifiedService.name);

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly whatsappUnipileRequestService: WhatsappUnipileRequestService,
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {}

  async getWhatsAppHealthStatus(
    workspace: Workspace,
  ): Promise<WhatsAppHealthStatus> {
    const fromBaileys = await this.tryBaileysHealth();
    if (fromBaileys) {
      return fromBaileys;
    }
    return this.buildVendorHealth(workspace);
  }

  async getWhatsAppSessionStats(
    workspace: Workspace,
  ): Promise<WhatsAppSessionStats> {
    const fromBaileys = await this.tryBaileysStats();
    if (fromBaileys) {
      return fromBaileys;
    }
    return this.buildVendorSessionStats(workspace);
  }

  async getWhatsAppSessions(workspace: Workspace): Promise<WhatsAppSessions> {
    const fromBaileys = await this.tryBaileysSessions();
    if (fromBaileys) {
      return fromBaileys;
    }
    return this.buildVendorSessions(workspace);
  }

  private getEventsGateway(): EventsGateway | undefined {
    return this.moduleRef.get(EventsGateway, { strict: false });
  }

  private async tryBaileysHealth(): Promise<WhatsAppHealthStatus | null> {
    const eventsGateway = this.getEventsGateway();
    if (!eventsGateway) {
      return null;
    }
    const registeredSessionCount = eventsGateway.getRegisteredSessionCount();
    const activeSessionCount = eventsGateway.getActiveSessionCount();
    const sessionMetrics = await eventsGateway.getSessionMetrics();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      sessions: {
        total: registeredSessionCount,
        active: activeSessionCount,
        inactive: registeredSessionCount - activeSessionCount,
      },
      metrics: sessionMetrics.map((metric) => ({
        recruiterId: metric.recruiterId,
        lastActivity: new Date(metric.lastActivity).toISOString(),
        connectionCount: metric.connectionCount,
        isActive: metric.isActive,
        memoryUsageMB: Math.round(metric.memoryUsage / (1024 * 1024)),
        isRegistered: metric.isRegistered,
        hasAuthFiles: metric.hasAuthFiles,
        hasWebSocketConnection: metric.hasWebSocketConnection,
        whatsappConnectionStatus: metric.whatsappConnectionStatus,
      })),
    };
  }

  private async tryBaileysStats(): Promise<WhatsAppSessionStats | null> {
    const eventsGateway = this.getEventsGateway();
    if (!eventsGateway) {
      return null;
    }
    const sessionCount = eventsGateway.getSessionCount();
    const activeSessionCount = eventsGateway.getActiveSessionCount();
    const registeredSessionCount = eventsGateway.getRegisteredSessionCount();
    const sessionMetrics = await eventsGateway.getSessionMetrics();

    const totalMemoryUsage = sessionMetrics.reduce(
      (sum, metric) => sum + metric.memoryUsage,
      0,
    );
    const averageMemoryPerSession =
      sessionCount > 0 ? totalMemoryUsage / sessionCount : 0;

    return {
      totalSessions: registeredSessionCount,
      activeSessions: activeSessionCount,
      inactiveSessions: registeredSessionCount - activeSessionCount,
      registeredSessions: registeredSessionCount,
      totalMemoryUsageMB: Math.round(totalMemoryUsage / (1024 * 1024)),
      averageMemoryPerSessionMB: Math.round(
        averageMemoryPerSession / (1024 * 1024),
      ),
      memoryEfficiency:
        registeredSessionCount > 0
          ? (activeSessionCount / registeredSessionCount) * 100
          : 0,
    };
  }

  private async tryBaileysSessions(): Promise<WhatsAppSessions | null> {
    const eventsGateway = this.getEventsGateway();
    if (!eventsGateway) {
      return null;
    }
    const sessionMetrics = await eventsGateway.getSessionMetrics();

    return {
      sessions: sessionMetrics.map((metric) => ({
        recruiterId: metric.recruiterId,
        lastActivity: new Date(metric.lastActivity).toISOString(),
        connectionCount: metric.connectionCount,
        isActive: metric.isActive,
        uptime: Date.now() - metric.lastActivity,
        memoryUsageMB: Math.round(metric.memoryUsage / (1024 * 1024)),
        isRegistered: metric.isRegistered,
        hasAuthFiles: metric.hasAuthFiles,
        hasWebSocketConnection: metric.hasWebSocketConnection,
        whatsappConnectionStatus: metric.whatsappConnectionStatus,
      })),
    };
  }

  private async buildVendorHealth(
    workspace: Workspace,
  ): Promise<WhatsAppHealthStatus> {
    const unipile = await this.tryUnipileHealth(workspace);
    if (unipile && unipile.metrics.length > 0) {
      return unipile;
    }
    const meta = await this.tryMetaHealth(workspace);
    if (meta) {
      return meta;
    }
    if (unipile) {
      return unipile;
    }
    return this.emptyHealth();
  }

  private async buildVendorSessionStats(
    workspace: Workspace,
  ): Promise<WhatsAppSessionStats> {
    const unipile = await this.tryUnipileSessionStats(workspace);
    if (unipile && unipile.totalSessions > 0) {
      return unipile;
    }
    const meta = await this.tryMetaSessionStats(workspace);
    if (meta) {
      return meta;
    }
    if (unipile) {
      return unipile;
    }
    return {
      totalSessions: 0,
      activeSessions: 0,
      inactiveSessions: 0,
      registeredSessions: 0,
      totalMemoryUsageMB: 0,
      averageMemoryPerSessionMB: 0,
      memoryEfficiency: 0,
    };
  }

  private async buildVendorSessions(
    workspace: Workspace,
  ): Promise<WhatsAppSessions> {
    const unipile = await this.tryUnipileSessions(workspace);
    if (unipile && unipile.sessions.length > 0) {
      return unipile;
    }
    const meta = await this.tryMetaSessions(workspace);
    if (meta) {
      return meta;
    }
    if (unipile) {
      return unipile;
    }
    return { sessions: [] };
  }

  private emptyHealth(): WhatsAppHealthStatus {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      sessions: {
        total: 0,
        active: 0,
        inactive: 0,
      },
      metrics: [],
    };
  }

  private async tryUnipileHealth(
    workspace: Workspace,
  ): Promise<WhatsAppHealthStatus | null> {
    const accounts = await this.fetchUnipileAccounts(workspace);
    if (accounts === null) {
      return null;
    }
    const metrics = accounts.map((a) => this.unipileAccountToMetric(a));
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

  private async tryUnipileSessionStats(
    workspace: Workspace,
  ): Promise<WhatsAppSessionStats | null> {
    const accounts = await this.fetchUnipileAccounts(workspace);
    if (accounts === null) {
      return null;
    }
    const metrics = accounts.map((a) => this.unipileAccountToMetric(a));
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

  private async tryUnipileSessions(
    workspace: Workspace,
  ): Promise<WhatsAppSessions | null> {
    const accounts = await this.fetchUnipileAccounts(workspace);
    if (accounts === null) {
      return null;
    }

    return {
      sessions: accounts.map((account) => {
        const m = this.unipileAccountToMetric(account);
        const lastMs = Date.parse(m.lastActivity);

        return {
          recruiterId: m.recruiterId,
          lastActivity: m.lastActivity,
          connectionCount: m.connectionCount,
          isActive: m.isActive,
          uptime: Number.isFinite(lastMs) ? Date.now() - lastMs : 0,
          memoryUsageMB: m.memoryUsageMB,
          isRegistered: m.isRegistered,
          hasAuthFiles: m.hasAuthFiles,
          hasWebSocketConnection: m.hasWebSocketConnection,
          whatsappConnectionStatus: m.whatsappConnectionStatus,
        };
      }),
    };
  }

  private async fetchUnipileAccounts(
    workspace: Workspace,
  ): Promise<UnipileAccountRow[] | null> {
    const keys = await this.workspaceQueryService.getWorkspaceKeys(
      workspace.id,
    );
    const defaultClient =
      keys.whatsapp_key ||
      process.env.DEFAULT_WHATSAPP_CLIENT ||
      'whatsapp-unipile';
    const prefersUnipile = defaultClient
      .toLowerCase()
      .includes('unipile');

    if (!prefersUnipile) {
      return null;
    }

    try {
      const result = await this.whatsappUnipileRequestService.getAllAccounts(
        workspace,
      );
      const accounts = (result?.accounts ?? []) as UnipileAccountRow[];
      return accounts;
    } catch (err) {
      this.logger.warn(
        `Unipile getAllAccounts failed for WhatsApp monitoring: ${err instanceof Error ? err.message : err}`,
      );
      return [];
    }
  }

  private unipileAccountToMetric(account: UnipileAccountRow) {
    const status = account.status ?? 'disconnected';
    const isActive = status === 'connected';
    const lastActivity = account.created_at
      ? new Date(account.created_at).toISOString()
      : new Date().toISOString();
    const label =
      account.username ||
      account.name ||
      account.phone_number ||
      account.id ||
      'unipile';

    return {
      recruiterId: `unipile:${label}`,
      lastActivity,
      connectionCount: isActive ? 1 : 0,
      isActive,
      memoryUsageMB: 0,
      isRegistered: true,
      hasAuthFiles: true,
      hasWebSocketConnection: isActive,
      whatsappConnectionStatus: this.mapUnipileStatusToBaileysShape(status),
    };
  }

  private mapUnipileStatusToBaileysShape(
    status: UnipileAccountRow['status'],
  ): string {
    if (status === 'connected') {
      return 'connected';
    }
    if (status === 'connecting') {
      return 'connecting';
    }
    if (status === 'pending') {
      return 'connecting';
    }
    return 'disconnected';
  }

  private async tryMetaHealth(
    workspace: Workspace,
  ): Promise<WhatsAppHealthStatus | null> {
    const row = await this.buildMetaMetric(workspace);
    if (!row) {
      return null;
    }

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      sessions: {
        total: 1,
        active: row.isActive ? 1 : 0,
        inactive: row.isActive ? 0 : 1,
      },
      metrics: [
        {
          recruiterId: row.recruiterId,
          lastActivity: row.lastActivity,
          connectionCount: row.connectionCount,
          isActive: row.isActive,
          memoryUsageMB: 0,
          isRegistered: row.isRegistered,
          hasAuthFiles: row.hasAuthFiles,
          hasWebSocketConnection: row.hasWebSocketConnection,
          whatsappConnectionStatus: row.whatsappConnectionStatus,
        },
      ],
    };
  }

  private async tryMetaSessionStats(
    workspace: Workspace,
  ): Promise<WhatsAppSessionStats | null> {
    const row = await this.buildMetaMetric(workspace);
    if (!row) {
      return null;
    }

    return {
      totalSessions: 1,
      activeSessions: row.isActive ? 1 : 0,
      inactiveSessions: row.isActive ? 0 : 1,
      registeredSessions: 1,
      totalMemoryUsageMB: 0,
      averageMemoryPerSessionMB: 0,
      memoryEfficiency: row.isActive ? 100 : 0,
    };
  }

  private async tryMetaSessions(
    workspace: Workspace,
  ): Promise<WhatsAppSessions | null> {
    const row = await this.buildMetaMetric(workspace);
    if (!row) {
      return null;
    }

    return {
      sessions: [
        {
          recruiterId: row.recruiterId,
          lastActivity: row.lastActivity,
          connectionCount: row.connectionCount,
          isActive: row.isActive,
          uptime: 0,
          memoryUsageMB: 0,
          isRegistered: row.isRegistered,
          hasAuthFiles: row.hasAuthFiles,
          hasWebSocketConnection: row.hasWebSocketConnection,
          whatsappConnectionStatus: row.whatsappConnectionStatus,
        },
      ],
    };
  }

  private async buildMetaMetric(workspace: Workspace): Promise<{
    recruiterId: string;
    lastActivity: string;
    connectionCount: number;
    isActive: boolean;
    isRegistered: boolean;
    hasAuthFiles: boolean;
    hasWebSocketConnection: boolean;
    whatsappConnectionStatus: string;
  } | null> {
    const keys = await this.workspaceQueryService.getWorkspaceKeys(
      workspace.id,
    );
    const defaultClient =
      keys.whatsapp_key ||
      process.env.DEFAULT_WHATSAPP_CLIENT ||
      'whatsapp-unipile';
    const prefersMeta =
      defaultClient.toLowerCase().includes('facebook') ||
      defaultClient.toLowerCase().includes('meta');

    const hasToken = !!keys.facebook_whatsapp_api_token?.trim();
    const hasPhoneId = !!keys.facebook_whatsapp_phone_number_id?.trim();

    if (!prefersMeta && !(hasToken && hasPhoneId)) {
      return null;
    }

    if (!hasToken || !hasPhoneId) {
      return null;
    }

    return {
      recruiterId: `meta:${keys.facebook_whatsapp_phone_number_id}`,
      lastActivity: new Date().toISOString(),
      connectionCount: 1,
      isActive: true,
      isRegistered: true,
      hasAuthFiles: true,
      hasWebSocketConnection: true,
      whatsappConnectionStatus: 'connected',
    };
  }
}
