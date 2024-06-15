import OpenAI from "openai";
import * as allDataObjects from "../data-model-objects";

const modelName = "gpt-4o"

import {ToolsForAgents} from 'src/engine/core-modules/arx-chat/services/llm-agents/prompting-tool-calling';
import { ChatCompletion, ChatCompletionMessage } from "openai/resources";
import CandidateEngagementArx from "src/engine/core-modules/arx-chat/services/candidate-engagement/check-candidate-engagement";
import { WhatsappAPISelector } from "../../services/whatsapp-api/whatsapp-controls";
import Anthropic from '@anthropic-ai/sdk';
import { ConsoleLogger } from "@nestjs/common";

export class OpenAIArxMultiStepClient{
    personNode: allDataObjects.PersonNode;
    openAIclient: OpenAI;
    anthropic:Anthropic;
    constructor(personNode:allDataObjects.PersonNode) {
        this.openAIclient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.personNode = personNode;
        this.anthropic = new Anthropic({
            apiKey: process.env['ANTHROPIC_API_KEY'], // This is the default and can be omitted
    });
  
    }
    async getStageOfTheConversation(mostRecentMessageArr:allDataObjects.ChatHistoryItem[]){
        console.log("got here to get the stage of the conversation")
        let stage:string | null = '1';

        const stagePrompt = new ToolsForAgents().getStagePrompt(this.personNode);
        console.log("got here to with the stage prompt", stagePrompt)
        const updatedMostRecentMessagesBasedOnNewSystemPrompt = await this.updateMostRecentMessagesBasedOnNewSystemPrompt(mostRecentMessageArr, stagePrompt)
        console.log("Got the updated recement messages:",updatedMostRecentMessagesBasedOnNewSystemPrompt)
        // @ts-ignore
        const response = await this.openAIclient.chat.completions.create({ model: modelName, messages: updatedMostRecentMessagesBasedOnNewSystemPrompt });

        console.log("This the stage that is determined by the model:", response.choices[0].message.content)
        stage = response.choices[0].message.content?? "1";
        return stage;
    }
    async updateMostRecentMessagesBasedOnNewSystemPrompt(mostRecentMessageArr: allDataObjects.ChatHistoryItem[], newSystemPrompt: string) {
        mostRecentMessageArr[0] = { role: "system", content: newSystemPrompt };
        return mostRecentMessageArr;
    }

    // THis is the entry point
    async createCompletion(mostRecentMessageArr:allDataObjects.ChatHistoryItem[]) {
        console.log("Going top create completion in multi step client")
        const stage = await this.getStageOfTheConversation(mostRecentMessageArr)
        const newSystemPrompt = await new ToolsForAgents().getSystemPromptBasedOnStage(this.personNode, stage);
        const updatedMostRecentMessagesBasedOnNewSystemPrompt = this.updateMostRecentMessagesBasedOnNewSystemPrompt(mostRecentMessageArr, newSystemPrompt)
        const tools = await new ToolsForAgents().getToolsByStage(stage);
        // @ts-ignore
        const response = await this.openAIclient.chat.completions.create({ model: modelName, messages: mostRecentMessageArr, tools: tools, tool_choice: "auto" });
        const responseMessage:ChatCompletionMessage =  response.choices[0].message;
        console.log("BOT_MESSAGE:", responseMessage.content);
        mostRecentMessageArr.push(responseMessage); // extend conversation with assistant's reply
        if (responseMessage.tool_calls) {
            mostRecentMessageArr = await this.addResponseAndToolCallsToMessageHistory(responseMessage, mostRecentMessageArr)
        }
        await this.sendWhatsappMessageToCandidate(response, mostRecentMessageArr)
        // This is the ex point
        return mostRecentMessageArr
    }

    async addResponseAndToolCallsToMessageHistory(responseMessage:ChatCompletionMessage, messages:allDataObjects.ChatHistoryItem[]){
        const toolCalls = responseMessage.tool_calls;
        // @ts-ignore
        if (toolCalls) {
            for (const toolCall of toolCalls) {
                const functionName = toolCall.function.name;
                const availableFunctions = new ToolsForAgents().getAvailableFunctions();
                // @ts-ignore
                const functionToCall = availableFunctions[functionName];
                const functionArgs = JSON.parse(toolCall.function.arguments);
                const responseFromFunction = await functionToCall( functionArgs, this.personNode); 
                // @ts-ignore
                messages.push({ tool_call_id: toolCall.id, role: "tool", name: functionName, content: responseFromFunction});
            }
            const tools = await new ToolsForAgents().getTools();
            // @ts-ignore
            const response = await this.openAIclient.chat.completions.create({ model: modelName, messages: messages, tools: tools, tool_choice: "auto" });
            console.log("BOT_MESSAGE:", response.choices[0].message.content);
            messages.push(response.choices[0].message);
            if(response.choices[0].message.tool_calls){
                messages = await this.addResponseAndToolCallsToMessageHistory(response.choices[0].message, messages)
            }
            const mostRecentMessageArr = messages
            await this.sendWhatsappMessageToCandidate(response, mostRecentMessageArr)
        }
        return messages
        }

        async sendWhatsappMessageToCandidate(response:ChatCompletion, mostRecentMessageArr:allDataObjects.ChatHistoryItem[]){
            if (response.choices[0].message.content){ 
                const whatappUpdateMessageObj = await new CandidateEngagementArx().updateChatHistoryObjCreateWhatsappMessageObj(response, this.personNode, mostRecentMessageArr)
                if (process.env.WHATSAPP_ENABLED === "true"){
                    await new WhatsappAPISelector().sendWhatsappMessage(whatappUpdateMessageObj);

                }
                else{
                    console.log("Whatsapp is not enabled, so not sending message:", whatappUpdateMessageObj.messages[0].content)
                  }
                
            }
        }
    }