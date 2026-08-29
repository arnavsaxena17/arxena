import { createAtomFamilyState } from '@/ui/utilities/state/jotai/utils/createAtomFamilyState';
import { DEFAULT_AI_AGENT_TEST_OUTPUT_VALUE } from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/constants/AiAgentTest';
import { type AiAgentTestData } from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/types/AiAgentTestData';

export const aiAgentTestDataFamilyState = createAtomFamilyState<
  AiAgentTestData,
  string
>({
  key: 'aiAgentTestDataFamilyState',
  defaultValue: {
    language: 'plaintext',
    variableValues: {},
    output: DEFAULT_AI_AGENT_TEST_OUTPUT_VALUE,
  },
});
