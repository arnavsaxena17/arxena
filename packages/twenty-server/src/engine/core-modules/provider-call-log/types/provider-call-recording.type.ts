// The provider traffic of one recorded run, served back in place of the
// providers so a scenario replays on fixed data (docs: W8 measurement)
export type ProviderCallRecordingEntry = {
  provider: string;
  operation: string;
  // The provider query cache key, when the call went through that cache
  cacheKey: string | null;
  // The request as provider-call-log stores it (see normalizeProviderCallRequest)
  request: Record<string, unknown> | null;
  // Absent for a call that failed; replay then throws errorMessage
  response?: unknown;
  errorMessage?: string;
};

export type ProviderCallRecording = {
  version: 1;
  // The sourcing-eval scenario id this recording replays
  scenarioId: string;
  recordedAt: string;
  // Where it came from, so it can be re-recorded
  threadId?: string;
  calls: ProviderCallRecordingEntry[];
};
