export const AGENT_CONFIG = {
  MAX_STEPS: 300,
  REASONING_BUDGET_TOKENS: 12000,
  // The workflow queue runs one job at a time, so a provider call that never
  // answers freezes every other run behind it. Fail fast instead.
  LLM_STEP_TIMEOUT_MS: 120_000,
  LLM_TOOL_LOOP_TIMEOUT_MS: 600_000,
  LLM_STRUCTURED_OUTPUT_TIMEOUT_MS: 120_000,
};
