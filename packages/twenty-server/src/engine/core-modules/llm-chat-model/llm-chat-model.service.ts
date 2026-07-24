import { Inject, Injectable } from '@nestjs/common';

import { LLMChatModelDriver } from 'src/engine/core-modules/llm-chat-model/drivers/interfaces/llm-prompt-template-driver.interface';

import { LLM_CHAT_MODEL_DRIVER } from 'src/engine/core-modules/llm-chat-model/llm-chat-model.constants';

@Injectable()
export class LLMChatModelService {
  constructor(
    @Inject(LLM_CHAT_MODEL_DRIVER) private driver: LLMChatModelDriver,
  ) {}

  getJSONChatModel() {
    if (!this.driver) {
      throw new Error(
        'LLM chat model driver is not configured. Set LLM_CHAT_MODEL_DRIVER=openai and OPENAI_API_KEY.',
      );
    }

    return this.driver.getJSONChatModel();
  }
}
