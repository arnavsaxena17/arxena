import { Injectable } from '@nestjs/common';

/**
 * In-memory registry of orgchart search request IDs that have been cancelled.
 * Used so long-running orgchart searches can be stopped when the user clicks Stop.
 */
@Injectable()
export class OrgchartCancelRegistryService {
  private readonly cancelled = new Set<string>();

  register(requestId: string): void {
    this.cancelled.delete(requestId);
  }

  setCancelled(requestId: string): void {
    this.cancelled.add(requestId);
  }

  isCancelled(requestId: string | undefined): boolean {
    return requestId ? this.cancelled.has(requestId) : false;
  }

  clear(requestId: string): void {
    this.cancelled.delete(requestId);
  }
}
