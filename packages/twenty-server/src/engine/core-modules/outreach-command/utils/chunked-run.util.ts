// A run split into queue jobs, one chunk each: its state lives in the cache,
// so any worker can pick up the next chunk and the caller can poll it

export type ChunkedRunStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export const CHUNKED_RUN_TERMINAL_STATUSES: ChunkedRunStatus[] = [
  'completed',
  'failed',
  'cancelled',
];

// A chunk takes seconds to a few minutes. No progress for longer means the job
// was lost (for example the worker restarted), so the run must not block the
// project.
export const CHUNKED_RUN_STALL_AFTER_MS = 2 * 60 * 1000;

const WAIT_POLL_MS = 1000;

export const isChunkedRunTerminal = (state: {
  status: ChunkedRunStatus;
}): boolean => CHUNKED_RUN_TERMINAL_STATUSES.includes(state.status);

export const isChunkedRunStalled = (
  state: { status: ChunkedRunStatus; startedAt: string; updatedAt?: string },
  stallAfterMs: number = CHUNKED_RUN_STALL_AFTER_MS,
): boolean =>
  !isChunkedRunTerminal(state) &&
  Date.now() - Date.parse(state.updatedAt ?? state.startedAt) > stallAfterMs;

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

// Polls until the run ends or the wait is over; undefined when it expired
export const waitForChunkedRun = async <
  TState extends { status: ChunkedRunStatus },
>(
  read: () => Promise<TState | undefined>,
  maxWaitMs: number,
): Promise<TState | undefined> => {
  const deadline = Date.now() + maxWaitMs;
  let state = await read();

  while (
    state !== undefined &&
    state !== null &&
    !isChunkedRunTerminal(state) &&
    Date.now() < deadline
  ) {
    await sleep(WAIT_POLL_MS);
    state = await read();
  }

  return state ?? undefined;
};
