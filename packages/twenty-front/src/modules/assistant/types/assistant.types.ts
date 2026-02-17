import type { AssistantTableData } from '@/assistant/components/AssistantDetailsTable';

export type AssistantChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
  tableDataList?: AssistantTableData[];
};

export type AssistantThread = {
  id: string;
  name: string;
  messages: AssistantChatMessage[];
  lastTableData: AssistantTableData | null;
};
