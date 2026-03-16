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

export type RecruiterMessageMetadata = {
  jobContextSummary?: string;
};

export type RecruiterMessageOptions = {
  /**
   * Maximum number of prior messages from the assistant thread history
   * that the recruiter message generator should consider.
   */
  maxHistoryMessages?: number;
  /**
   * When true (default), the recruiter job / search context will be
   * fetched and embedded into the recruiter instruction prompt.
   */
  includeJobContext?: boolean;
  /**
   * Optional soft cap for response length when recruiter messages are
   * generated via an LLM. Not currently enforced by the autonomous
   * recruiter controller.
   */
  maxResponseCharacters?: number;
  /**
   * Controls whether the plain-text recruiter message should be appended
   * to the assistant thread as a `user` message.
   *
   * For genuine recruiter input (e.g. the initial requirement) this
   * should remain `true` so the conversation history stays readable.
   *
   * For internal controller-driven prompts (e.g. "continue the workflow")
   * this should be set to `false` so those control messages are not
   * persisted as if they came from the human recruiter.
   *
   * Defaults to `true` when omitted.
   */
  appendUserMessageToThread?: boolean;
};

export type RecruiterMessageResponse = {
  text: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
  metadata?: RecruiterMessageMetadata;
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

export type AssistantAgentEventRecord = {
  status: 'started' | 'completed' | 'error' | 'tool_call';
  threadId?: string;
  runId?: string;
  summary?: string;
  error?: string;
  toolName?: string;
  timestamp: number;
};

export type AgentNote = { summary: string; createdAt?: string; id?: string };

export type AssistantThreadRecord = {
  id: string;
  name: string;
  workspaceId: string;
  messages: AssistantThreadMessage[];
  lastTableData: AssistantThreadTableData | null;
  createdAt: Date;
  updatedAt: Date;
  jobId?: string;
  agentNotes?: AgentNote[];
  agentEvents?: AssistantAgentEventRecord[];
};
