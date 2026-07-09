import { LLMChatModelDriver } from 'src/engine/core-modules/llm-chat-model/interfaces/llm-chat-model.interface';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

export const llmChatModelModuleFactory = (
  environmentService: EnvironmentService,
) => {
  const configuredDriver = environmentService.get('LLM_CHAT_MODEL_DRIVER');
  const openAiApiKey =
    environmentService.get('OPENAI_API_KEY') ?? process.env.OPENAI_KEY;

  const driver =
    configuredDriver ??
    (openAiApiKey ? LLMChatModelDriver.OpenAI : undefined);

  switch (driver) {
    case LLMChatModelDriver.OpenAI: {
      return { type: LLMChatModelDriver.OpenAI };
    }
    default:
      return undefined;
  }
};
