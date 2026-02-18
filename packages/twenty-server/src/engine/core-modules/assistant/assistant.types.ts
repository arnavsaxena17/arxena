export type McpModelProvider = 'anthropic' | 'openai';

export type MessageParam =
  | { role: 'user'; content: string }
  | {
      role: 'user';
      content: Array<{
        type: 'tool_result';
        tool_use_id: string;
        content: string;
      }>;
    }
  | {
      role: 'assistant';
      content: Array<
        | { type: 'text'; text: string }
        | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
      >;
    };

export type AssistantChatResponse = {
  text: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
};

export type StreamEventSender = (event: string, data: unknown) => boolean;

export type AssistantContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };

export type AssistantChatRequestBody = {
  message: string;
  threadId?: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string | Array<unknown>;
  }>;
};

export type AssistantThreadMessage = {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
};

export type AssistantThreadTableData = {
  columns: string[];
  rows: Record<string, unknown>[];
};

export type AssistantThreadRecord = {
  id: string;
  name: string;
  workspaceId: string;
  messages: AssistantThreadMessage[];
  lastTableData: AssistantThreadTableData | null;
  candidateIds: string[];
  createdAt: Date;
  updatedAt: Date;
};
