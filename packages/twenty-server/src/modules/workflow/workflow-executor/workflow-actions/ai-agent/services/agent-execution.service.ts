import { Injectable, Logger } from '@nestjs/common';

import { HumanMessage, SystemMessage } from '@langchain/core/messages';

import { LLMChatModelService } from 'src/engine/core-modules/llm-chat-model/llm-chat-model.service';

export type AgentExecutionResult = {
  message: string;
  raw?: unknown;
};

const DEFAULT_SYSTEM_PROMPT =
  'You are an AI agent embedded in a CRM automation workflow. ' +
  'Generate or enrich the requested content based on the user prompt and the ' +
  'provided context. Always respond with a JSON object of the shape ' +
  '{ "message": string } where "message" contains your final answer.';

@Injectable()
export class AgentExecutionService {
  private readonly logger = new Logger(AgentExecutionService.name);

  constructor(private readonly llmChatModelService: LLMChatModelService) {}

  async executeAgent({
    prompt,
    systemPrompt,
    agentId,
  }: {
    prompt: string;
    systemPrompt?: string;
    agentId?: string;
    workspaceId?: string;
  }): Promise<AgentExecutionResult> {
    if (!prompt || prompt.trim().length === 0) {
      throw new Error('AI agent prompt is required');
    }

    const chatModel = this.llmChatModelService.getJSONChatModel();

    const messages = [
      new SystemMessage(systemPrompt ?? DEFAULT_SYSTEM_PROMPT),
      new HumanMessage(prompt),
    ];

    this.logger.log(
      `Executing AI agent${agentId ? ` ${agentId}` : ''} with prompt of length ${prompt.length}`,
    );

    const response = await chatModel.invoke(messages);

    const content =
      typeof response?.content === 'string'
        ? response.content
        : JSON.stringify(response?.content ?? '');

    return this.parseModelContent(content);
  }

  private parseModelContent(content: string): AgentExecutionResult {
    try {
      const parsed = JSON.parse(content);

      if (parsed && typeof parsed === 'object' && 'message' in parsed) {
        return {
          message: String((parsed as { message: unknown }).message ?? ''),
          raw: parsed,
        };
      }

      return { message: content, raw: parsed };
    } catch {
      return { message: content };
    }
  }
}
