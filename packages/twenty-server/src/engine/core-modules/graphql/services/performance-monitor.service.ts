import { Injectable } from '@nestjs/common';

export interface PerformanceMetrics {
  operationName: string;
  totalTime: number;
  featureFlagsTime: number;
  mainQueryTime: number;
  nestedRelationsTime: number;
  aggregateQueryTime: number;
  resultGettersTime: number;
  timestamp: Date;
}

@Injectable()
export class PerformanceMonitorService {
  private metrics: PerformanceMetrics[] = [];
  private readonly MAX_METRICS = 1000; // Keep last 1000 metrics

  recordMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);
    
    // Keep only the last MAX_METRICS entries
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }
  }

  getAverageMetrics(): Partial<PerformanceMetrics> {
    if (this.metrics.length === 0) {
      return {};
    }

    const totals = this.metrics.reduce(
      (acc, metric) => ({
        totalTime: acc.totalTime + metric.totalTime,
        featureFlagsTime: acc.featureFlagsTime + metric.featureFlagsTime,
        mainQueryTime: acc.mainQueryTime + metric.mainQueryTime,
        nestedRelationsTime: acc.nestedRelationsTime + metric.nestedRelationsTime,
        aggregateQueryTime: acc.aggregateQueryTime + metric.aggregateQueryTime,
        resultGettersTime: acc.resultGettersTime + metric.resultGettersTime,
      }),
      {
        totalTime: 0,
        featureFlagsTime: 0,
        mainQueryTime: 0,
        nestedRelationsTime: 0,
        aggregateQueryTime: 0,
        resultGettersTime: 0,
      }
    );

    const count = this.metrics.length;
    return {
      totalTime: totals.totalTime / count,
      featureFlagsTime: totals.featureFlagsTime / count,
      mainQueryTime: totals.mainQueryTime / count,
      nestedRelationsTime: totals.nestedRelationsTime / count,
      aggregateQueryTime: totals.aggregateQueryTime / count,
      resultGettersTime: totals.resultGettersTime / count,
    };
  }

  getSlowQueries(threshold: number = 1000): PerformanceMetrics[] {
    return this.metrics.filter(metric => metric.totalTime > threshold);
  }

  clearMetrics(): void {
    this.metrics = [];
  }
} 