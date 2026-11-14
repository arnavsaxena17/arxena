import { Injectable, Logger } from '@nestjs/common';

interface RequestCount {
  count: number;
  lastReset: string; // ISO date string
}

@Injectable()
export class LinkedInSessionTrackerService {
  private readonly logger = new Logger(LinkedInSessionTrackerService.name);
  private readonly DAILY_LIMIT_WARNING = 10;
  private readonly DAILY_LIMIT_MAX = 20;
  
  // In-memory storage for request counts per workspace
  private requestCounts = new Map<string, RequestCount>();

  constructor() {}

  async trackRequest(workspaceId: string, searchType: string): Promise<{
    allowed: boolean;
    count: number;
    warning?: string;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const requestKey = `${workspaceId}_${today}`;
      
      const currentCount = this.getRequestCount(requestKey);
      const newCount = currentCount + 1;
      
      if (newCount > this.DAILY_LIMIT_MAX) {
        this.logger.warn(`LinkedIn request limit exceeded for workspace ${workspaceId}: ${newCount}/${this.DAILY_LIMIT_MAX}`);
        return {
          allowed: false,
          count: newCount,
          warning: `Daily LinkedIn search limit exceeded (${this.DAILY_LIMIT_MAX} requests). Please try again tomorrow.`,
        };
      }
      
      this.incrementRequestCount(requestKey);
      
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

  private getRequestCount(key: string): number {
    const today = new Date().toISOString().split('T')[0];
    const requestData = this.requestCounts.get(key);
    
    // If no data exists or it's a new day, return 0
    if (!requestData || requestData.lastReset !== today) {
      return 0;
    }
    
    return requestData.count;
  }

  private incrementRequestCount(key: string): void {
    const today = new Date().toISOString().split('T')[0];
    const currentData = this.requestCounts.get(key);
    
    if (!currentData || currentData.lastReset !== today) {
      // New day or first request
      this.requestCounts.set(key, {
        count: 1,
        lastReset: today,
      });
    } else {
      // Increment existing count
      this.requestCounts.set(key, {
        count: currentData.count + 1,
        lastReset: today,
      });
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
      const requestKey = `${workspaceId}_${today}`;
      const count = this.getRequestCount(requestKey);
      
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
      const requestKey = `${workspaceId}_${today}`;
      this.requestCounts.delete(requestKey);
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

  // Method to clean up old data (can be called periodically)
  cleanupOldData(): void {
    const today = new Date().toISOString().split('T')[0];
    const keysToDelete: string[] = [];
    
    for (const [key, data] of this.requestCounts.entries()) {
      if (data.lastReset !== today) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.requestCounts.delete(key));
    
    if (keysToDelete.length > 0) {
      this.logger.log(`Cleaned up ${keysToDelete.length} old LinkedIn request count entries`);
    }
  }

  // Method to get all current request counts (for debugging/monitoring)
  getAllRequestCounts(): Map<string, RequestCount> {
    return new Map(this.requestCounts);
  }
}
