import { readFileSync } from 'fs';

import { type ProviderCallRecording } from 'src/engine/core-modules/provider-call-log/types/provider-call-recording.type';
import { providerCallSignatureOf } from 'src/engine/core-modules/provider-call-log/utils/provider-call-signature.util';

export const PROVIDER_CALL_REPLAY_FILE_ENV = 'PROVIDER_CALL_REPLAY_FILE';

// A replayed run must never reach a provider: a request the recording does not
// hold fails instead of being sent
export class ProviderCallReplayMissError extends Error {
  constructor(readonly signature: string) {
    super(
      `Provider call not in the replay recording (re-record the scenario): ${signature.slice(0, 300)}`,
    );
    this.name = 'ProviderCallReplayMissError';
  }
}

export type ProviderCallReplayStore = {
  scenarioId: string;
  // Throws ProviderCallReplayMissError, or the recorded error for a call that
  // failed when it was recorded
  replay: (call: {
    provider: string;
    operation: string;
    cacheKey?: string | null;
    request?: unknown;
  }) => unknown;
};

export const createProviderCallReplayStore = (
  recording: ProviderCallRecording,
): ProviderCallReplayStore => {
  // The same request may be recorded more than once (a retry, a cache hit
  // after the fetch); replay serves them in order and then repeats the last
  const queues = new Map<string, ProviderCallRecording['calls']>();

  for (const call of recording.calls) {
    const keys = [
      providerCallSignatureOf(call),
      providerCallSignatureOf({ ...call, cacheKey: null }),
    ];

    for (const key of new Set(keys)) {
      queues.set(key, [...(queues.get(key) ?? []), call]);
    }
  }

  const served = new Map<string, number>();

  return {
    scenarioId: recording.scenarioId,
    replay: (call) => {
      const signatures = [
        providerCallSignatureOf(call),
        providerCallSignatureOf({ ...call, cacheKey: null }),
      ];
      const signature = signatures.find((key) => queues.has(key));

      if (signature === undefined) {
        throw new ProviderCallReplayMissError(signatures[0]);
      }

      const queue = queues.get(signature) ?? [];
      const index = Math.min(served.get(signature) ?? 0, queue.length - 1);
      const entry = queue[index];

      served.set(signature, index + 1);

      if (entry.response === undefined) {
        throw new Error(entry.errorMessage ?? 'Recorded provider call failed');
      }

      return entry.response;
    },
  };
};

export const parseProviderCallRecording = (
  content: string,
): ProviderCallRecording => {
  const recording = JSON.parse(content) as Partial<ProviderCallRecording>;

  if (
    recording.version !== 1 ||
    typeof recording.scenarioId !== 'string' ||
    !Array.isArray(recording.calls)
  ) {
    throw new Error(
      'Not a provider call recording (want version 1, scenarioId, calls[])',
    );
  }

  return recording as ProviderCallRecording;
};

let cachedStore: { file: string; store: ProviderCallReplayStore } | undefined;

// Undefined unless PROVIDER_CALL_REPLAY_FILE is set. Refused in production: a
// server serving recorded data to real users would be silently wrong.
export const getActiveProviderCallReplayStore = ():
  | ProviderCallReplayStore
  | undefined => {
  const file = process.env[PROVIDER_CALL_REPLAY_FILE_ENV]?.trim();

  if (file === undefined || file.length === 0) {
    return undefined;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `${PROVIDER_CALL_REPLAY_FILE_ENV} is set in production; unset it`,
    );
  }

  if (cachedStore?.file !== file) {
    cachedStore = {
      file,
      store: createProviderCallReplayStore(
        parseProviderCallRecording(readFileSync(file, 'utf-8')),
      ),
    };
  }

  return cachedStore.store;
};
