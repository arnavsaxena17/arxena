import { McpModelProvider } from '../assistant.types';

export const getMcpModelProviderFromEnv = (): McpModelProvider => {
  const raw = (process.env.MCP_MODEL_PROVIDER ?? 'anthropic').toLowerCase();
  return raw === 'openai' ? 'openai' : 'anthropic';
};
