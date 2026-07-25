import { Controller, Get, Query } from '@nestjs/common';
import { PerformanceMonitorService } from '../services/performance-monitor.service';

@Controller('performance')
export class PerformanceMonitorController {
  constructor(
    private readonly performanceMonitorService: PerformanceMonitorService,
  ) {}

  @Get('metrics')
  getAverageMetrics() {
    return this.performanceMonitorService.getAverageMetrics();
  }

  @Get('slow-queries')
  getSlowQueries(@Query('threshold') threshold?: string) {
    const thresholdMs = threshold ? parseInt(threshold, 10) : 1000;
    return this.performanceMonitorService.getSlowQueries(thresholdMs);
  }

  @Get('health')
  getHealth() {
    const metrics = this.performanceMonitorService.getAverageMetrics();
    const isHealthy = metrics.totalTime && metrics.totalTime < 2000; // 2 seconds threshold
    
    return {
      status: isHealthy ? 'healthy' : 'degraded',
      averageResponseTime: metrics.totalTime || 0,
      timestamp: new Date().toISOString(),
    };
  }
} 