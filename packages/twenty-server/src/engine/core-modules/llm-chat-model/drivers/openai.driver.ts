import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';

import { LLMChatModelDriver } from 'src/engine/core-modules/llm-chat-model/drivers/interfaces/llm-prompt-template-driver.interface';

export class OpenAIDriver implements LLMChatModelDriver {
  private chatModel: BaseChatModel;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY;

    if (!apiKey) {
      throw new Error(
        'OpenAI API key is not configured. Set OPENAI_API_KEY or OPENAI_KEY.',
      );
    }

    this.chatModel = new ChatOpenAI({
      model: 'gpt-5.1-chat-latest',
      apiKey,
    }).bind({
      response_format: {
        type: 'json_object',
      },
    }) as unknown as BaseChatModel;
  }

  getJSONChatModel() {
    return this.chatModel;
  }
}
