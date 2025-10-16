import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { EventsGateway } from './events-gateway-module/events-gateway';

@Controller('whatsapp-monitoring')
@UseGuards(JwtAuthGuard)
export class WhatsAppMonitoringController {
  constructor(private readonly eventsGateway: EventsGateway) {}

  @Get('health')
  async getHealthStatus() {
    const sessionCount = this.eventsGateway.getSessionCount();
    const activeSessionCount = this.eventsGateway.getActiveSessionCount();
    const sessionMetrics = await this.eventsGateway.getSessionMetrics();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      sessions: {
        total: sessionCount,
        active: activeSessionCount,
        inactive: sessionCount - activeSessionCount
      },
      metrics: sessionMetrics.map(metric => ({
        recruiterId: metric.recruiterId,
        recruiterName: metric.recruiterName || 'Unknown User',
        lastActivity: new Date(metric.lastActivity).toISOString(),
        connectionCount: metric.connectionCount,
        isActive: metric.isActive,
        memoryUsageMB: Math.round(metric.memoryUsage / (1024 * 1024))
      }))
    };
  }

  @Get('sessions')
  async getSessionInfo() {
    const sessionMetrics = await this.eventsGateway.getSessionMetrics();
    
    return {
      sessions: sessionMetrics.map(metric => ({
        recruiterId: metric.recruiterId,
        recruiterName: metric.recruiterName || 'Unknown User',
        lastActivity: new Date(metric.lastActivity).toISOString(),
        connectionCount: metric.connectionCount,
        isActive: metric.isActive,
        uptime: Date.now() - metric.lastActivity,
        memoryUsageMB: Math.round(metric.memoryUsage / (1024 * 1024))
      }))
    };
  }

  @Get('stats')
  async getStats() {
    const sessionCount = this.eventsGateway.getSessionCount();
    const activeSessionCount = this.eventsGateway.getActiveSessionCount();
    const sessionMetrics = await this.eventsGateway.getSessionMetrics();

    const totalMemoryUsage = sessionMetrics.reduce((sum, metric) => sum + metric.memoryUsage, 0);
    const averageMemoryPerSession = sessionCount > 0 ? totalMemoryUsage / sessionCount : 0;

    return {
      totalSessions: sessionCount,
      activeSessions: activeSessionCount,
      inactiveSessions: sessionCount - activeSessionCount,
      totalMemoryUsageMB: Math.round(totalMemoryUsage / (1024 * 1024)),
      averageMemoryPerSessionMB: Math.round(averageMemoryPerSession / (1024 * 1024)),
      memoryEfficiency: sessionCount > 0 ? (activeSessionCount / sessionCount) * 100 : 0
    };
  }
}
