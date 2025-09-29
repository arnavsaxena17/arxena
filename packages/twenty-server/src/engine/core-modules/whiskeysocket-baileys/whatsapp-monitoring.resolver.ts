import { UseFilters, UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';

import { AuthGraphqlApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-graphql-api-exception.filter';
import { UserAuthGuard } from 'src/engine/guards/user-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

import { WhatsAppHealthStatus } from './dtos/whatsapp-health-status.dto';
import { WhatsAppSessionStats } from './dtos/whatsapp-session-stats.dto';
import { WhatsAppSessions } from './dtos/whatsapp-sessions.dto';
import { EventsGateway } from './events-gateway-module/events-gateway';

@Resolver()
@UseFilters(AuthGraphqlApiExceptionFilter)
export class WhatsAppMonitoringResolver {
  constructor(private readonly eventsGateway: EventsGateway) {}

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard)
  @Query(() => WhatsAppHealthStatus)
  async getWhatsAppHealthStatus(): Promise<WhatsAppHealthStatus> {
    const sessionCount = this.eventsGateway.getSessionCount();
    const activeSessionCount = this.eventsGateway.getActiveSessionCount();
    const registeredSessionCount = this.eventsGateway.getRegisteredSessionCount();
    const sessionMetrics = await this.eventsGateway.getSessionMetrics();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      sessions: {
        total: registeredSessionCount,
        active: activeSessionCount,
        inactive: registeredSessionCount - activeSessionCount
      },
      metrics: sessionMetrics.map(metric => ({
        recruiterId: metric.recruiterId,
        lastActivity: new Date(metric.lastActivity).toISOString(),
        connectionCount: metric.connectionCount,
        isActive: metric.isActive,
        memoryUsageMB: Math.round(metric.memoryUsage / (1024 * 1024)),
        isRegistered: metric.isRegistered,
        hasAuthFiles: metric.hasAuthFiles,
        hasWebSocketConnection: metric.hasWebSocketConnection,
        whatsappConnectionStatus: metric.whatsappConnectionStatus
      }))
    };
  }

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard)
  @Query(() => WhatsAppSessionStats)
  async getWhatsAppSessionStats(): Promise<WhatsAppSessionStats> {
    const sessionCount = this.eventsGateway.getSessionCount();
    const activeSessionCount = this.eventsGateway.getActiveSessionCount();
    const registeredSessionCount = this.eventsGateway.getRegisteredSessionCount();
    const sessionMetrics = await this.eventsGateway.getSessionMetrics();

    const totalMemoryUsage = sessionMetrics.reduce((sum, metric) => sum + metric.memoryUsage, 0);
    const averageMemoryPerSession = sessionCount > 0 ? totalMemoryUsage / sessionCount : 0;

    return {
      totalSessions: registeredSessionCount,
      activeSessions: activeSessionCount,
      inactiveSessions: registeredSessionCount - activeSessionCount,
      registeredSessions: registeredSessionCount,
      totalMemoryUsageMB: Math.round(totalMemoryUsage / (1024 * 1024)),
      averageMemoryPerSessionMB: Math.round(averageMemoryPerSession / (1024 * 1024)),
      memoryEfficiency: registeredSessionCount > 0 ? (activeSessionCount / registeredSessionCount) * 100 : 0
    };
  }

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard)
  @Query(() => WhatsAppSessions)
  async getWhatsAppSessions(): Promise<WhatsAppSessions> {
    const sessionMetrics = await this.eventsGateway.getSessionMetrics();
    
    return {
      sessions: sessionMetrics.map(metric => ({
        recruiterId: metric.recruiterId,
        lastActivity: new Date(metric.lastActivity).toISOString(),
        connectionCount: metric.connectionCount,
        isActive: metric.isActive,
        uptime: Date.now() - metric.lastActivity,
        memoryUsageMB: Math.round(metric.memoryUsage / (1024 * 1024)),
        isRegistered: metric.isRegistered,
        hasAuthFiles: metric.hasAuthFiles,
        hasWebSocketConnection: metric.hasWebSocketConnection,
        whatsappConnectionStatus: metric.whatsappConnectionStatus
      }))
    };
  }
}
