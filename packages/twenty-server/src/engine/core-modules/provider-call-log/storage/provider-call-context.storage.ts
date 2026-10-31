import { AsyncLocalStorage } from 'async_hooks';

export type ProviderCallContext = {
  workspaceId?: string;
  threadId?: string;
  turnId?: string;
  toolCallId?: string;
  toolName?: string;
  projectId?: string;
  runId?: string;
  subject?: string;
  stage?: string;
};

const providerCallContextStorage = new AsyncLocalStorage<ProviderCallContext>();

export const getProviderCallContext = (): ProviderCallContext =>
  providerCallContextStorage.getStore() ?? {};

// Layers on top of the caller's context: a tool sets the chat ids, the
// finder adds the company and stage, and an unset field keeps the outer value
export const withProviderCallContext = <TResult>(
  patch: ProviderCallContext,
  fn: () => TResult,
): TResult => {
  const merged: ProviderCallContext = { ...getProviderCallContext() };

  for (const [key, value] of Object.entries(patch) as Array<
    [keyof ProviderCallContext, string | undefined]
  >) {
    if (value !== undefined && value !== '') {
      merged[key] = value;
    }
  }

  return providerCallContextStorage.run(merged, fn);
};
