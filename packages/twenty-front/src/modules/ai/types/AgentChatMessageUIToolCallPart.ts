import {
  type HighlightOrgChartToolOutput,
  type NavigateAppToolOutput,
} from 'twenty-shared/ai';

export type AgentChatMessageUIToolCallPart = {
  type: 'tool-execute_tool';
  toolCallId: string;
  state: string;
  input?: {
    toolName?: string;
  };
  output: {
    success: boolean;
    message: string;
    error?: string;
    result?: NavigateAppToolOutput | HighlightOrgChartToolOutput;
  };
};
