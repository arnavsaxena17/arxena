import { Injectable } from '@nestjs/common';

/**
 * In-memory registry of orgchart search request IDs and their terminal states.
 * Used so long-running orgchart searches can be stopped when the user clicks Stop
 * and so repeated polling requests do not silently restart a finished job.
 */
@Injectable()
export class OrgchartCancelRegistryService {
  private readonly states = new Map<
    string,
    {
      status: 'active' | 'cancelled' | 'completed' | 'failed';
      message?: string;
    }
  >();

  register(requestId: string): void {
    const existing = this.states.get(requestId);

    if (
      existing?.status === 'cancelled' ||
      existing?.status === 'completed' ||
      existing?.status === 'failed'
    ) {
      return;
    }

    this.states.set(requestId, { status: 'active' });
  }

  setCancelled(requestId: string): void {
    this.states.set(requestId, { status: 'cancelled' });
  }

  setCompleted(requestId: string): void {
    this.states.set(requestId, { status: 'completed' });
  }

  setFailed(requestId: string, message?: string): void {
    this.states.set(requestId, { status: 'failed', message });
  }

  isCancelled(requestId: string | undefined): boolean {
    return requestId
      ? this.states.get(requestId)?.status === 'cancelled'
      : false;
  }

  getState(requestId: string | undefined):
    | {
        status: 'active' | 'cancelled' | 'completed' | 'failed';
        message?: string;
      }
    | undefined {
    return requestId ? this.states.get(requestId) : undefined;
  }

  isTerminal(requestId: string | undefined): boolean {
    const state = this.getState(requestId);

    return (
      state?.status === 'cancelled' ||
      state?.status === 'completed' ||
      state?.status === 'failed'
    );
  }

  clear(requestId: string): void {
    this.states.delete(requestId);
  }
}
