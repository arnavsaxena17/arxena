export type NaukriQueueState =
  | 'idle'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'completed'
  | 'failed';

export type NaukriQueueSnapshot = {
  queueId: string;
  currentTableId: string;
  state: NaukriQueueState;
  totalCount: number;
  completedCount: number;
  failedCount: number;
  remainingCount: number;
  currentUrl: string | null;
  currentBatch: number;
  batchSize: number;
  isCoolingDown: boolean;
  nextBatchAt: number | null;
  statusMessage: string;
  lastUpdatedAt: number;
  error?: string;
};

export type StartNaukriQueueInput = {
  urls: string[];
  currentTableId: string;
  batchSize?: number;
};

type QueueAction = 'start' | 'get' | 'stop';

const ARX_START_NAUKRI_QUEUE = 'ARX::START_NAUKRI_QUEUE' as const;
const ARX_GET_NAUKRI_QUEUE_STATUS = 'ARX::GET_NAUKRI_QUEUE_STATUS' as const;
const ARX_STOP_NAUKRI_QUEUE = 'ARX::STOP_NAUKRI_QUEUE' as const;
const ARX_NAUKRI_QUEUE_STATUS_RESULT =
  'ARX::NAUKRI_QUEUE_STATUS_RESULT' as const;
export const ARX_NAUKRI_QUEUE_UPDATE = 'ARX::NAUKRI_QUEUE_UPDATE' as const;

const REQUEST_TIMEOUT_MS = 15_000;

function createRequestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function postQueueRequest(
  message: Record<string, unknown>,
  requestId: string,
  action: QueueAction,
): Promise<NaukriQueueSnapshot | null> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('Timed out waiting for Chrome extension'));
    }, REQUEST_TIMEOUT_MS);

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) {
        return;
      }

      if (event.data?.type !== ARX_NAUKRI_QUEUE_STATUS_RESULT) {
        return;
      }

      if (event.data.requestId !== requestId) {
        return;
      }

      if (event.data.action !== action) {
        return;
      }

      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);

      if (!event.data.ok) {
        reject(
          new Error(
            typeof event.data.error === 'string'
              ? event.data.error
              : 'Extension request failed',
          ),
        );
        return;
      }

      resolve((event.data.snapshot as NaukriQueueSnapshot | null | undefined) ?? null);
    };

    window.addEventListener('message', onMessage);
    window.postMessage(
      {
        ...message,
        requestId,
      },
      window.location.origin,
    );
  });
}

export function startNaukriQueueFromPage(
  input: StartNaukriQueueInput,
): Promise<NaukriQueueSnapshot | null> {
  const requestId = createRequestId('arx-naukri-queue-start');

  return postQueueRequest(
    {
      type: ARX_START_NAUKRI_QUEUE,
      urls: input.urls,
      currentTableId: input.currentTableId,
      batchSize: input.batchSize,
    },
    requestId,
    'start',
  );
}

export function getNaukriQueueStatusFromPage(
  queueId?: string,
): Promise<NaukriQueueSnapshot | null> {
  const requestId = createRequestId('arx-naukri-queue-get');

  return postQueueRequest(
    {
      type: ARX_GET_NAUKRI_QUEUE_STATUS,
      queueId,
    },
    requestId,
    'get',
  );
}

export function stopNaukriQueueFromPage(
  queueId?: string,
): Promise<NaukriQueueSnapshot | null> {
  const requestId = createRequestId('arx-naukri-queue-stop');

  return postQueueRequest(
    {
      type: ARX_STOP_NAUKRI_QUEUE,
      queueId,
    },
    requestId,
    'stop',
  );
}

export function subscribeToNaukriQueueUpdates(
  callback: (snapshot: NaukriQueueSnapshot) => void,
): () => void {
  const onMessage = (event: MessageEvent) => {
    if (event.source !== window) {
      return;
    }

    if (event.data?.type !== ARX_NAUKRI_QUEUE_UPDATE) {
      return;
    }

    if (!event.data.snapshot) {
      return;
    }

    callback(event.data.snapshot as NaukriQueueSnapshot);
  };

  window.addEventListener('message', onMessage);

  return () => {
    window.removeEventListener('message', onMessage);
  };
}

export function isTerminalNaukriQueueState(state: NaukriQueueState): boolean {
  return state === 'stopped' || state === 'completed' || state === 'failed';
}
