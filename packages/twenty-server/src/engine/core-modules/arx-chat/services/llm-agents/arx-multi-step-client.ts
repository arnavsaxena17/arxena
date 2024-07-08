import OpenAI from "openai";
import * as allDataObjects from "../data-model-objects";

const modelName = "gpt-4o";

import { ToolsForAgents } from "../../services/llm-agents/prompting-tool-calling";
import { ChatCompletion, ChatCompletionMessage } from "openai/resources";
import CandidateEngagementArx from "../../services/candidate-engagement/check-candidate-engagement";
import { WhatsappAPISelector } from "../../services/whatsapp-api/whatsapp-controls";
import Anthropic from "@anthropic-ai/sdk";

export class OpenAIArxMultiStepClient {
  personNode: allDataObjects.PersonNode;
  openAIclient: OpenAI;
  anthropic: Anthropic;
  constructor(personNode: allDataObjects.PersonNode) {
    this.openAIclient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.personNode = personNode;
    this.anthropic = new Anthropic({
      apiKey: process.env["ANTHROPIC_API_KEY"], // This is the default and can be omitted
    });
  }
  // THis is the entry point
  async createCompletion(
    mostRecentMessageArr: allDataObjects.ChatHistoryItem[],
    personNode: allDataObjects.PersonNode,
    isChatEnabled: boolean = true
  ) {
    console.log("Going top create completion in multi step client");
    const stage = await this.getStageOfTheConversation(mostRecentMessageArr);
    console.log(
      "This is the stage that is arrived at CURRENT STAGE::::::::",
      stage
    );
    mostRecentMessageArr =
      await this.runCandidateFacingAgentsAlongWithToolCalls(
        mostRecentMessageArr,
        personNode,
        stage,
        isChatEnabled
      );
    await this.runSystemFacingAgentsAlongWithToolCalls(
      mostRecentMessageArr,
      personNode,
      stage
    );
    await this.timeManagementPrompt(mostRecentMessageArr, personNode, stage);
    return mostRecentMessageArr;
  }

  async getStageOfTheConversation(
    mostRecentMessageArr: allDataObjects.ChatHistoryItem[]
  ) {
    console.log("got here to get the stage of the conversation");
    let stage: string | null = "1";
    const stagePrompt = await new ToolsForAgents().getStagePrompt();
    console.log("got here to with the stage prompt", stagePrompt);
    const updatedMostRecentMessagesBasedOnNewSystemPrompt =
      await this.updateMostRecentMessagesBasedOnNewSystemPrompt(
        mostRecentMessageArr,
        stagePrompt
      );
    console.log(
      "Got the updated recement messages:",
      updatedMostRecentMessagesBasedOnNewSystemPrompt
    );
    // @ts-ignore
    const response = await this.openAIclient.chat.completions.create({
      model: modelName,
      // @ts-ignore
      messages: updatedMostRecentMessagesBasedOnNewSystemPrompt,
    });
    console.log(
      "This the stage that is determined by the model:",
      response.choices[0].message.content
    );
    stage = response.choices[0].message.content ?? "1";
    return stage;
  }
  async updateMostRecentMessagesBasedOnNewSystemPrompt(
    mostRecentMessageArr: allDataObjects.ChatHistoryItem[],
    newSystemPrompt: string
  ) {
    mostRecentMessageArr[0] = { role: "system", content: newSystemPrompt };
    return mostRecentMessageArr;
  }

  async runCandidateFacingAgentsAlongWithToolCalls(
    mostRecentMessageArr: allDataObjects.ChatHistoryItem[],
    personNode: allDataObjects.PersonNode,
    stage: string,
    isChatEnabled: boolean = true
  ) {
    const newSystemPrompt =
      await new ToolsForAgents().getCandidateFacingSystemPromptBasedOnStage(
        this.personNode,
        stage
      );
    const updatedMostRecentMessagesBasedOnNewSystemPrompt =
      this.updateMostRecentMessagesBasedOnNewSystemPrompt(
        mostRecentMessageArr,
        newSystemPrompt
      );
    const tools = await new ToolsForAgents().getCandidateFacingToolsByStage(
      stage
    );
    // @ts-ignore
    const response = await this.openAIclient.chat.completions.create({
      model: modelName,
      messages: mostRecentMessageArr,
      tools: tools,
      tool_choice: "auto",
    });
    const responseMessage: ChatCompletionMessage = response.choices[0].message;
    console.log("BOT_MESSAGE:", responseMessage.content);
    mostRecentMessageArr.push(responseMessage); // extend conversation with assistant's reply
    if (responseMessage.tool_calls && isChatEnabled) {
      mostRecentMessageArr = await this.addResponseAndToolCallsToMessageHistory(
        responseMessage,
        mostRecentMessageArr
        // isChatEnabled
      );
    }
    await this.sendWhatsappMessageToCandidate(
      response?.choices[0]?.message?.content || "",
      mostRecentMessageArr,
      isChatEnabled
    );
    return mostRecentMessageArr;
  }

  async runSystemFacingAgentsAlongWithToolCalls(
    mostRecentMessageArr: allDataObjects.ChatHistoryItem[],
    personNode: allDataObjects.PersonNode,
    stage: string
  ) {
    const newSystemPrompt =
      await new ToolsForAgents().getSystemFacingSystemPromptBasedOnStage(
        this.personNode,
        stage
      );
    const updatedMostRecentMessagesBasedOnNewSystemPrompt =
      this.updateMostRecentMessagesBasedOnNewSystemPrompt(
        mostRecentMessageArr,
        newSystemPrompt
      );
    const tools = await new ToolsForAgents().getSystemFacingToolsByStage(stage);
    // @ts-ignore
    const response = await this.openAIclient.chat.completions.create({
      model: modelName,
      messages: mostRecentMessageArr,
      tools: tools,
      tool_choice: "auto",
    });
    const responseMessage: ChatCompletionMessage = response.choices[0].message;
    console.log("BOT_MESSAGE:", responseMessage.content);
    mostRecentMessageArr.push(responseMessage); // extend conversation with assistant's reply
    if (responseMessage.tool_calls) {
      mostRecentMessageArr = await this.addResponseAndToolCallsToMessageHistory(
        responseMessage,
        mostRecentMessageArr
      );
    }
  }

  async addResponseAndToolCallsToMessageHistory(
    responseMessage: ChatCompletionMessage,
    messages: allDataObjects.ChatHistoryItem[]
  ) {
    const toolCalls = responseMessage.tool_calls;
    // @ts-ignore
    if (toolCalls) {
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const availableFunctions = new ToolsForAgents().getAvailableFunctions();
        // @ts-ignore
        const functionToCall = availableFunctions[functionName];
        const functionArgs = JSON.parse(toolCall.function.arguments);
        // if (isChatEnabled) {
        const responseFromFunction = await functionToCall(
          functionArgs,
          this.personNode
        );
        // }
        // @ts-ignore
        messages.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: functionName,
          content: responseFromFunction,
        });
      }
      const tools = await new ToolsForAgents().getTools();
      // @ts-ignore
      const response = await this.openAIclient.chat.completions.create({
        model: modelName,
        messages: messages,
        tools: tools,
        tool_choice: "auto",
      });
      console.log("BOT_MESSAGE:", response.choices[0].message.content);
      messages.push(response.choices[0].message);
      if (response.choices[0].message.tool_calls) {
        messages = await this.addResponseAndToolCallsToMessageHistory(
          response.choices[0].message,
          messages
        );
      }
      const mostRecentMessageArr = messages;
      await this.sendWhatsappMessageToCandidate(
        response?.choices[0]?.message?.content || "",
        mostRecentMessageArr
      );
    }
    return messages;
  }

  async sendWhatsappMessageToCandidate(
    messageText: string,
    mostRecentMessageArr: allDataObjects.ChatHistoryItem[],
    isChatEnabled?: boolean
  ) {
    console.log(
      "Called sendWhatsappMessageToCandidate to send message via any whatsapp api"
    );
    if (messageText === "#DONTRESPOND#") {
      console.log("Found a #DONTRESPOND# message, so not sending any message");
      return;
    }
    if (messageText) {
      const whatappUpdateMessageObj =
        await new CandidateEngagementArx().updateChatHistoryObjCreateWhatsappMessageObj(
          "sendWhatsappMessageToCandidateMulti",
          this.personNode,
          mostRecentMessageArr
        );
      if (
        process.env.WHATSAPP_ENABLED === "true" &&
        (isChatEnabled === undefined || isChatEnabled)
      ) {
        await new WhatsappAPISelector().sendWhatsappMessage(
          whatappUpdateMessageObj,
          this.personNode,
          mostRecentMessageArr
        );
      } else {
        console.log(
          "Whatsapp is not enabled, so not sending message:",
          whatappUpdateMessageObj.messages[0].content
        );
      }
    }
  }
  async timeManagementPrompt(
    mostRecentMessageArr: allDataObjects.ChatHistoryItem[],
    personNode: allDataObjects.PersonNode,
    stage: string
  ) {
    debugger;
    const timeManagementPrompt = new ToolsForAgents().getTimeManagementPrompt(
      personNode,
      stage
    );
    let updatedMostRecentMessagesBasedOnNewSystemPrompt =
      await this.updateMostRecentMessagesBasedOnNewSystemPrompt(
        mostRecentMessageArr,
        timeManagementPrompt
      );
    const timeManagementTool = new ToolsForAgents().getTimeManagementTools();
    // @ts-ignore
    const response = await this.openAIclient.chat.completions.create({
      model: modelName,
      messages: updatedMostRecentMessagesBasedOnNewSystemPrompt,
      tools: timeManagementTool,
      tool_choice: "auto",
    });
    const responseMessage: ChatCompletionMessage = response.choices[0].message;
    console.log("BOT_MESSAGE:", responseMessage.content);
    updatedMostRecentMessagesBasedOnNewSystemPrompt.push(responseMessage); // extend conversation with assistant's reply
    if (responseMessage.tool_calls) {
      updatedMostRecentMessagesBasedOnNewSystemPrompt =
        await this.addResponseAndToolCallsToMessageHistory(
          responseMessage,
          updatedMostRecentMessagesBasedOnNewSystemPrompt
        );
    }
  }
}
