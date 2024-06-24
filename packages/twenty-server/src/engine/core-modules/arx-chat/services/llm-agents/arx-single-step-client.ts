import OpenAI from "openai";
import * as allDataObjects from "../data-model-objects";

const modelName = "gpt-4o"

import {ToolsForAgents} from '../../services/llm-agents/prompting-tool-calling';
import { ChatCompletion, ChatCompletionMessage } from "openai/resources";
import CandidateEngagementArx from "src/engine/core-modules/arx-chat/services/candidate-engagement/check-candidate-engagement";
import { WhatsappAPISelector } from "src/engine/core-modules/arx-chat/services/whatsapp-api/whatsapp-controls";
import Anthropic from '@anthropic-ai/sdk';

export class OpenAIArxSingleStepClient{
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

    async createCompletion(mostRecentMessageArr:allDataObjects.ChatHistoryItem[], personNode:allDataObjects.PersonNode) {
        const tools = await new ToolsForAgents().getTools();
        // @ts-ignore
        const response = await this.openAIclient.chat.completions.create({ model: modelName, messages: mostRecentMessageArr, tools: tools, tool_choice: "auto" });
        const responseMessage:ChatCompletionMessage =  response.choices[0].message;
        console.log("BOT_MESSAGE:", responseMessage.content);
        
        mostRecentMessageArr.push(responseMessage); // extend conversation with assistant's reply
        if (responseMessage.tool_calls) {
            mostRecentMessageArr = await this.addResponseAndToolCallsToMessageHistory(responseMessage, mostRecentMessageArr, personNode)
        }
        await this.sendWhatsappMessageToCandidate(response, mostRecentMessageArr, personNode)
        // const whatappUpdateMessageObj = await new CandidateEngagementArx().updateChatHistoryObjCreateWhatsappMessageObj(response,personNode,mostRecentMessageArr);
        // await new CandidateEngagementArx().updateCandidateEngagementDataInTable(whatappUpdateMessageObj);

        return mostRecentMessageArr
    }

    async addResponseAndToolCallsToMessageHistory(responseMessage:ChatCompletionMessage, messages:allDataObjects.ChatHistoryItem[], personNode:allDataObjects.PersonNode){
        const toolCalls = responseMessage.tool_calls;
        // @ts-ignore
        if (toolCalls) {
            for (const toolCall of toolCalls) {
                const functionName = toolCall.function.name;
                console.log("This is the person:", this.personNode)
                // console.log("functionName called:",functionName);
                const availableFunctions = new ToolsForAgents().getAvailableFunctions();
                // @ts-ignore
                const functionToCall = availableFunctions[functionName];
                console.log("functionToCall::", functionToCall);
                const functionArgs = JSON.parse(toolCall.function.arguments);
                // console.log("functionArgs::", functionArgs);
                const responseFromFunction = await functionToCall( functionArgs, this.personNode); 
                // @ts-ignore
                messages.push({ tool_call_id: toolCall.id, role: "tool", name: functionName, content: responseFromFunction});
            }
            // console.log("Message history in :2=====", messages.slice(1).map((message:any) => message.content).join("\n"),"=====")
            const tools = await new ToolsForAgents().getTools();
            // @ts-ignore
            const response = await this.openAIclient.chat.completions.create({ model: modelName, messages: messages, tools: tools, tool_choice: "auto" });
            console.log("BOT_MESSAGE:", response.choices[0].message.content);
            messages.push(response.choices[0].message);
            // send messages here where you get some response choices messages
            if(response.choices[0].message.tool_calls){
                messages = await this.addResponseAndToolCallsToMessageHistory(response.choices[0].message, messages, personNode)
            }
            const mostRecentMessageArr = messages
            await this.sendWhatsappMessageToCandidate(response, mostRecentMessageArr, personNode)
        }
        return messages
        }

        async sendWhatsappMessageToCandidate(response:ChatCompletion, mostRecentMessageArr:allDataObjects.ChatHistoryItem[], personNode:allDataObjects.PersonNode){
            if (response.choices[0].message.content && response.choices[0].message.content !== "#DONTRESPOND#"){
                // send message to candidates
                const whatappUpdateMessageObj = await new CandidateEngagementArx().updateChatHistoryObjCreateWhatsappMessageObj("sendWhatsappMessageToCandidate", response, this.personNode, mostRecentMessageArr)
                if (process.env.WHATSAPP_ENABLED === "true") {
                    await new WhatsappAPISelector().sendWhatsappMessage(whatappUpdateMessageObj, personNode, mostRecentMessageArr);
                }
                else {
                    console.log("Whatsapp is not enabled, so not sending message:", whatappUpdateMessageObj.messages[0].content)
                }
            }
    
        }
    }