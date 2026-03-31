import {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionToolMessageParam,
  ChatCompletionUserMessageParam,
} from 'openai/resources';
import {
  CandidateNode,
  ChatControlsObjType,
  ChatHistoryItem,
  Job
} from 'twenty-shared';

import { CandidateEngagementArx } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/candidate-engagement';
import { ChatControls } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/chat-controls';
import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { HumanLikeLLM } from 'src/engine/core-modules/arx-chat/services/llm-agents/human-or-bot-classification';
import { ToolCallingAgents } from 'src/engine/core-modules/arx-chat/services/llm-agents/tool-calling-agents';
import { MessagingControls } from 'src/engine/core-modules/arx-chat/services/messaging-controls';
import { WorkspaceMemberProfileUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-profile-unipile.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

const modelName = 'gpt-5-mini';
// import { Transformations } from '../candidate-engagement/transformations';

export class OpenAIArxMultiStepClient {
  constructor(
    private readonly candidate: CandidateNode,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly workspaceMemberProfileUnipileService?: WorkspaceMemberProfileUnipileService,
    // private readonly googleContactsQueue: Queue,
  ) {}

  async createCompletion(
    mostRecentMessageArr: ChatHistoryItem[],
    candidateJob: Job,
    chatControl: ChatControlsObjType,
    apiToken: string,
    isChatEnabled = true,
  ) {
    try {
      const newSystemPrompt = await new CandidateEngagementArx(
        this.workspaceQueryService,
        this.staticGraphQLService,
        undefined,
        this.workspaceMemberProfileUnipileService,
      ).getSystemPrompt(this.candidate, candidateJob, chatControl, apiToken);

      if (!newSystemPrompt) {
        console.log(
          'New System Prompt is null, so returning as it is.FUCK FUCK',
        );

        return;
      }
      const updatedMostRecentMessagesBasedOnNewSystemPrompt: ChatHistoryItem[] =
        await new FilterCandidates(
          this.workspaceQueryService,
          this.staticGraphQLService,
        ).updateMostRecentMessagesBasedOnNewSystemPrompt(
          mostRecentMessageArr,
          newSystemPrompt,
        );
      const tools = await new ChatControls(
        this.workspaceQueryService,
        this.staticGraphQLService,
        this.workspaceMemberProfileUnipileService,
      ).getTools(candidateJob, chatControl);
      const responseMessage = await this.getHumanLikeResponseMessageFromLLM(
        updatedMostRecentMessagesBasedOnNewSystemPrompt,
        tools,
        apiToken,
      );

      console.log(
        'BOT_MESSAGE in at::',
        new Date().toString(),
        ' ::: ',
        JSON.stringify(responseMessage),
      );
      if (responseMessage) {
        mostRecentMessageArr.push(responseMessage);
      } else {
        console.log(
          'Response message from get Human LikeResponse Message From LLM is null, so returning as it is',
        );

        return mostRecentMessageArr;
      }
      if (responseMessage?.tool_calls && isChatEnabled) {
        mostRecentMessageArr =
          await this.addResponseAndToolCallsToMessageHistory(
            responseMessage,
            candidateJob,
            mostRecentMessageArr,
            chatControl,
            apiToken,
            isChatEnabled,
          );
      }
      console.log(
        'Sending message to candidate from addResponseAndToolCallsToMessageHistory_stage1',
        mostRecentMessageArr.slice(-1)[0].content,
      );
      console.log(
        'Message text in stage 1 received based on which we will decide whether to send message or not::',
        mostRecentMessageArr.slice(-1)[0].content,
      );
      await new MessagingControls(
        this.workspaceQueryService,
        this.staticGraphQLService,
        this.workspaceMemberProfileUnipileService,
      ).sendWhatsappMessageToCandidate(
        mostRecentMessageArr.slice(-1)[0].content || '',
        this.candidate,
        candidateJob,
        mostRecentMessageArr,
        'runCandidateFacingAgentsAlongWithToolCalls_stage1',
        chatControl,
        apiToken,
        isChatEnabled,
      );

      return mostRecentMessageArr;
    } catch (error) {
      console.log( 'There has been an error in runCandidateFacingAgentsAlongWithToolCalls::', error );
      return mostRecentMessageArr;
    }
  }

  async getHumanLikeResponseMessageFromLLM(
    mostRecentMessageArr: ChatHistoryItem[],
    tools: any,
    apiToken: string,
  ): Promise<ChatCompletionMessage | null> {
    try {
      console.log('Going to get human like response from llm');
      const MAX_ATTEMPTS = 3;
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient } =
        await this.workspaceQueryService.initializeLLMClients(workspaceId);

      console.log('mostRecentMessageArr:::', mostRecentMessageArr);
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        // @ts-ignore
        const response = await openAIclient.chat.completions.create({
          model: modelName,
          messages: this.buildChatCompletionMessages(mostRecentMessageArr),
          tools: tools,
          tool_choice: 'auto',
        });
        const responseMessage = response.choices[0].message;

        console.log(`Response from attempt ${attempt}:`, response.choices[0]);
        if (!responseMessage.content) {
          console.log('Response Message is mostly null');

          return responseMessage;
        }
        const responseMessageType = await new HumanLikeLLM(
          this.workspaceQueryService,
        ).checkIfResponseMessageSoundsHumanLike(responseMessage, apiToken);

        console.log(
          `Check if this sounds like a human message ${attempt} time:`,
          responseMessageType,
        );
        if (responseMessageType === 'seemsHumanMessage') {
          return responseMessage;
        }
        if (attempt === MAX_ATTEMPTS) {
          console.log(
            'Maximum attempts reached. Returning last response regardless of human-likeness',
          );

          return responseMessage;
        }
        console.log(
          `Attempt ${attempt} produced bot-like response, trying again...`,
        );
      }

      return null; // This line should never be reached due to the for loop structure
    } catch (error) {
      console.log('Error in getHumanLikeResponse:', error);

      return null;
    }
  }

  async addResponseAndToolCallsToMessageHistory(
    responseMessage: ChatCompletionMessage,
    candidateJob: Job,
    mostRecentMessageArr: ChatHistoryItem[],
    chatControl: ChatControlsObjType,
    apiToken: string,
    isChatEnabled = true,
  ): Promise<ChatHistoryItem[]> {
    try {
      const toolCalls = responseMessage?.tool_calls;

      console.log(
        'We have made a total of ',
        toolCalls?.length,
        ' tool calls in current chatResponseMessage',
      );
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient } =
        await this.workspaceQueryService.initializeLLMClients(workspaceId);

      if (toolCalls) {
        for (const toolCall of toolCalls) {
          // @ts-ignore
          const functionName = toolCall.function.name;

          console.log('Function name is:', functionName);
          const availableFunctions = new ToolCallingAgents(
            this.workspaceQueryService,
            this.staticGraphQLService,
            this.workspaceMemberProfileUnipileService,
          ).getAvailableFunctions(candidateJob, apiToken);
          const functionToCall = availableFunctions[functionName];
          // @ts-ignore
          const functionArgs = JSON.parse(toolCall.function.arguments);
          const responseFromFunction = await functionToCall(
            functionArgs,
            this.candidate,
            candidateJob,
            chatControl,
            apiToken,
          );

          mostRecentMessageArr.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: functionName,
            content: responseFromFunction,
          });
        }
        const tools = await new ChatControls(
          this.workspaceQueryService,
          this.staticGraphQLService,
          this.workspaceMemberProfileUnipileService,
          ).getTools(candidateJob, chatControl);
        const response = await openAIclient.chat.completions.create({
          model: modelName,
          messages: this.buildChatCompletionMessages(mostRecentMessageArr),
          tools: tools,
          tool_choice: 'auto',
        });

        console.log(
          'BOT_MESSAGE in runCandidateFacingAgentsAlongWithToolCalls_stage2 :',
          'at::',
          new Date().toString(),
          ' ::: ',
          JSON.stringify(responseMessage),
        );
        mostRecentMessageArr.push(response.choices[0].message);
        const firstStageMessageArr = mostRecentMessageArr.slice(-1);

        if (response?.choices[0]?.message?.tool_calls) {
          console.log(
            'More Tool Calls inside of the addResponseAndToolCallsToMessageHistory. RECURSION Initiated:::: processorType::',
          );
          mostRecentMessageArr =
            await this.addResponseAndToolCallsToMessageHistory(
              response.choices[0].message,
              candidateJob,
              mostRecentMessageArr,
              chatControl,
              apiToken,
              isChatEnabled,
            );
        } else {
          console.log(
            'No Tool Calls received this in sub-response of the big response::',
          );
        }
        const messageArr_stage2 = mostRecentMessageArr.slice(-1);

        if (messageArr_stage2[0].content != firstStageMessageArr[0].content) {
          console.log(
            'Sending message to candidate from addResponseAndToolCallsToMessageHistory_stage2',
            messageArr_stage2,
          );
          await new MessagingControls(
            this.workspaceQueryService,
            this.staticGraphQLService,
            this.workspaceMemberProfileUnipileService,
          ).sendWhatsappMessageToCandidate(
            response?.choices[0]?.message?.content || '',
            this.candidate,
            candidateJob,
            messageArr_stage2,
            'addResponseAndToolCallsToMessageHistory_stage2',
            chatControl,
            apiToken,
            isChatEnabled,
          );
        } else {
          console.log(
            'The message we tried to send but sending is is ::',
            messageArr_stage2[0].content,
            'processorType',
          );
        }
      } else {
        console.log('No tool calls in response message');
      }

      return mostRecentMessageArr;
    } catch (error) {
      console.log('Error in addResponseAndToolCallsToMessageHistory:', error);

      return mostRecentMessageArr;
    }
  }

  private buildChatCompletionMessages(
    messages: ChatHistoryItem[],
  ): ChatCompletionMessageParam[] {
    return messages.reduce<ChatCompletionMessageParam[]>(
      (accumulator, item) => {
        const role =
          (item?.role?.toLowerCase() as
            | 'system'
            | 'user'
            | 'assistant'
            | 'tool') || 'user';
        const content = this.normalizeMessageContent(item?.content);

        if (role === 'assistant') {
          const assistantMessage: ChatCompletionAssistantMessageParam = {
            role: 'assistant',
            content,
          };

          if (item.tool_calls && item.tool_calls.length > 0) {
            assistantMessage.tool_calls = item.tool_calls;
          }

          accumulator.push(assistantMessage);
          return accumulator;
        }

        if (role === 'system') {
          const systemMessage: ChatCompletionSystemMessageParam = {
            role: 'system',
            content,
          };

          accumulator.push(systemMessage);
          return accumulator;
        }

        if (role === 'tool') {
          if (!item.tool_call_id) {
            console.warn(
              'Skipping tool message without tool_call_id in buildChatCompletionMessages',
              item,
            );

            return accumulator;
          }

          const toolMessage: ChatCompletionToolMessageParam = {
            role: 'tool',
            content,
            tool_call_id: item.tool_call_id,
          };

          accumulator.push(toolMessage);
          return accumulator;
        }

        const userMessage: ChatCompletionUserMessageParam = {
          role: 'user',
          content,
        };

        accumulator.push(userMessage);
        return accumulator;
      },
      [],
    );
  }

  private normalizeMessageContent(content: ChatHistoryItem['content']): string {
    if (content === null || content === undefined) {
      return '[message unavailable]';
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === 'string') {
            return part;
          }

          if (part && typeof part === 'object') {
            try {
              return JSON.stringify(part);
            } catch (error) {
              return String(part);
            }
          }

          return String(part ?? '');
        })
        .join('\n');
    }

    if (typeof content === 'object') {
      try {
        return JSON.stringify(content);
      } catch (error) {
        return String(content);
      }
    }

    return String(content);
  }
}
