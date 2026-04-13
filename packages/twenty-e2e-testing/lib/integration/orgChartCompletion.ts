/**
 * Wait for org-chart worker terminal progress on Redis (same channel as HTTP bridge → Socket.IO).
 * Channel: orgchart_progress:{workspaceMemberId} (see twenty-server OrgChartProgressRedisService).
 *
 * Use createOrgChartTerminalWaiter: await ready, then POST /org-chart/search, then await result
 * so subscription is active before the worker can publish.
 */
import Redis from 'ioredis';

const CHANNEL_PREFIX = 'orgchart_progress:';

export type OrgChartProgressMessage = {
  event: string;
  requestId?: string;
  mode?: string;
  searchType?: string;
  companyName?: string;
  data: Record<string, unknown>;
};

export type OrgChartTerminalResult =
  | { kind: 'complete'; message: OrgChartProgressMessage }
  | { kind: 'error'; message: OrgChartProgressMessage };

export type OrgChartTerminalWaiter = {
  /** Resolves when Redis SUBSCRIBE is active — call POST after this. */
  ready: Promise<void>;
  /** Resolves on first complete|error for requestId (or timeout). */
  result: Promise<OrgChartTerminalResult>;
  cancel: () => void;
};

/**
 * Subscribe first; then POST with the same requestId so progress is not missed.
 */
export function createOrgChartTerminalWaiter(options: {
  redisUrl: string;
  workspaceMemberId: string;
  requestId: string;
  timeoutMs: number;
}): OrgChartTerminalWaiter {
  const { redisUrl, workspaceMemberId, requestId, timeoutMs } = options;
  const channel = `${CHANNEL_PREFIX}${workspaceMemberId}`;
  const sub = new Redis(redisUrl, { maxRetriesPerRequest: 1 });

  let timer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;

  const cleanup = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    void sub.unsubscribe(channel).catch(() => undefined);
    void sub.quit().catch(() => undefined);
  };

  const result = new Promise<OrgChartTerminalResult>((resolve, reject) => {
    timer = setTimeout(() => {
      if (finished) {
        return;
      }
      finished = true;
      cleanup();
      reject(
        new Error(
          `Org-chart progress timeout after ${timeoutMs}ms for requestId=${requestId} on ${channel}. ` +
            `If the job was queued (Apify/x-ray/Unipile), confirm BullMQ workers for orgchart-apify-queue are running on the same Redis.`,
        ),
      );
    }, timeoutMs);

    sub.on('message', (_ch: string, message: string) => {
      if (finished) {
        return;
      }
      let parsed: OrgChartProgressMessage;
      try {
        parsed = JSON.parse(message) as OrgChartProgressMessage;
      } catch {
        return;
      }
      if (parsed.requestId !== requestId) {
        return;
      }
      if (parsed.event === 'complete') {
        finished = true;
        cleanup();
        resolve({ kind: 'complete', message: parsed });
        return;
      }
      if (parsed.event === 'error') {
        finished = true;
        cleanup();
        resolve({ kind: 'error', message: parsed });
      }
    });

    sub.on('error', (err: Error) => {
      if (finished) {
        return;
      }
      finished = true;
      cleanup();
      reject(err);
    });
  });

  const ready = sub.subscribe(channel).then(() => undefined);

  const cancel = () => {
    if (finished) {
      return;
    }
    finished = true;
    cleanup();
  };

  return { ready, result, cancel };
}

export function assertOrgChartCompletePayload(args: {
  terminal: OrgChartTerminalResult;
  minItemCount: number;
  label: string;
}): void {
  const { terminal, minItemCount, label } = args;
  if (terminal.kind === 'error') {
    const msg = terminal.message.data?.message;
    throw new Error(
      `[${label}] org-chart terminal error: ${typeof msg === 'string' ? msg : JSON.stringify(terminal.message.data)}`,
    );
  }
  const data = terminal.message.data;
  const itemCount =
    typeof data.itemCount === 'number' ? data.itemCount : minItemCount > 0 ? Number.NaN : 0;
  if (Number.isNaN(itemCount) || itemCount < minItemCount) {
    throw new Error(
      `[${label}] expected itemCount >= ${minItemCount}, got ${String(data.itemCount)}`,
    );
  }
  const items = data.items;
  if (!Array.isArray(items)) {
    throw new Error(`[${label}] complete event missing data.items array`);
  }
  if (items.length < minItemCount) {
    console.log(
      `[${label}] warning: items.length (${items.length}) < minItemCount (${minItemCount}); itemCount field was ${itemCount}`,
    );
  }
  if (data.orgChart === undefined && minItemCount > 0) {
    console.log(
      `[${label}] note: complete event has no orgChart in data (optional for some sources)`,
    );
  }
}
