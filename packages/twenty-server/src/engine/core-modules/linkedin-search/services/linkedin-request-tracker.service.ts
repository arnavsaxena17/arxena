import { Injectable, Logger } from '@nestjs/common';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';

@Injectable()
export class LinkedInRequestTrackerService {
  private readonly logger = new Logger(LinkedInRequestTrackerService.name);
  private readonly DAILY_LIMIT_WARNING = 10;
  private readonly DAILY_LIMIT_MAX = 20;

  constructor(
    private workspaceQueryService: WorkspaceQueryService,
  ) {}

  async trackRequest(workspaceId: string, searchType: string): Promise<{
    allowed: boolean;
    count: number;
    warning?: string;
  }> {
    try {
      // Get today's request count from workspace metadata
      const today = new Date().toISOString().split('T')[0];
      const requestKey = `linkedin_requests_${today}`;
      
      const currentCount = await this.getRequestCount(workspaceId, requestKey);
      const newCount = currentCount + 1;
      
      if (newCount > this.DAILY_LIMIT_MAX) {
        this.logger.warn(`LinkedIn request limit exceeded for workspace ${workspaceId}: ${newCount}/${this.DAILY_LIMIT_MAX}`);
        return {
          allowed: false,
          count: newCount,
          warning: `Daily LinkedIn search limit exceeded (${this.DAILY_LIMIT_MAX} requests). Please try again tomorrow.`,
        };
      }
      
      await this.incrementRequestCount(workspaceId, requestKey);
      
      if (newCount >= this.DAILY_LIMIT_WARNING) {
        this.logger.warn(`LinkedIn request warning for workspace ${workspaceId}: ${newCount}/${this.DAILY_LIMIT_MAX}`);
        return {
          allowed: true,
          count: newCount,
          warning: `Warning: You've made ${newCount} LinkedIn searches today. Limit is ${this.DAILY_LIMIT_MAX} per day.`,
        };
      }
      
      this.logger.log(`LinkedIn request tracked for workspace ${workspaceId}: ${newCount}/${this.DAILY_LIMIT_MAX}`);
      return {
        allowed: true,
        count: newCount,
      };
    } catch (error) {
      this.logger.error('Failed to track LinkedIn request:', error);
      // Allow request to proceed if tracking fails
      return {
        allowed: true,
        count: 0,
        warning: 'Request tracking failed, but request is allowed to proceed.',
      };
    }
  }

  private async getRequestCount(workspaceId: string, key: string): Promise<number> {
    try {
      const count = await this.workspaceQueryService.getWorkspaceApiKey(workspaceId, key);
      return count ? parseInt(count) : 0;
    } catch (error) {
      this.logger.warn(`Failed to get request count for ${key}:`, error);
      return 0;
    }
  }

  private async incrementRequestCount(workspaceId: string, key: string): Promise<void> {
    try {
      const currentCount = await this.getRequestCount(workspaceId, key);
      await this.workspaceQueryService.updateWorkspaceKeys(workspaceId, { [key]: (currentCount + 1).toString() });
    } catch (error) {
      this.logger.error(`Failed to increment request count for ${key}:`, error);
      throw error;
    }
  }

  async getRequestStatus(workspaceId: string): Promise<{
    count: number;
    limit: number;
    remaining: number;
    warningThreshold: number;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const requestKey = `linkedin_requests_${today}`;
      const count = await this.getRequestCount(workspaceId, requestKey);
      
      return {
        count,
        limit: this.DAILY_LIMIT_MAX,
        remaining: this.DAILY_LIMIT_MAX - count,
        warningThreshold: this.DAILY_LIMIT_WARNING,
      };
    } catch (error) {
      this.logger.error('Failed to get request status:', error);
      return {
        count: 0,
        limit: this.DAILY_LIMIT_MAX,
        remaining: this.DAILY_LIMIT_MAX,
        warningThreshold: this.DAILY_LIMIT_WARNING,
      };
    }
  }

  async resetDailyCount(workspaceId: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const requestKey = `linkedin_requests_${today}`;
      await this.workspaceQueryService.updateWorkspaceKeys(workspaceId, { [requestKey]: '0' });
      this.logger.log(`Reset LinkedIn request count for workspace ${workspaceId}`);
    } catch (error) {
      this.logger.error('Failed to reset daily count:', error);
    }
  }

  // Method to check if a request should be allowed without incrementing
  async canMakeRequest(workspaceId: string): Promise<{
    allowed: boolean;
    count: number;
    remaining: number;
    warning?: string;
  }> {
    try {
      const status = await this.getRequestStatus(workspaceId);
      
      if (status.count >= status.limit) {
        return {
          allowed: false,
          count: status.count,
          remaining: status.remaining,
          warning: `Daily LinkedIn search limit exceeded (${status.limit} requests). Please try again tomorrow.`,
        };
      }
      
      if (status.count >= status.warningThreshold) {
        return {
          allowed: true,
          count: status.count,
          remaining: status.remaining,
          warning: `Warning: You've made ${status.count} LinkedIn searches today. Limit is ${status.limit} per day.`,
        };
      }
      
      return {
        allowed: true,
        count: status.count,
        remaining: status.remaining,
      };
    } catch (error) {
      this.logger.error('Failed to check request allowance:', error);
      return {
        allowed: true,
        count: 0,
        remaining: this.DAILY_LIMIT_MAX,
        warning: 'Request tracking failed, but request is allowed to proceed.',
      };
    }
  }
}
