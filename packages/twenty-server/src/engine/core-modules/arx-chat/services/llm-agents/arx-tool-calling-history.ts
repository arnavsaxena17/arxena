import OpenAI from "openai";
import * as allDataObjects from "../data-model-objects";

const modelName = "gpt-4o"

import {ToolsForAgents} from 'src/engine/core-modules/arx-chat/services/llm-agents/tool-calling';
export class openAIArxClient{
    personNode: allDataObjects.PersonNode;
    client: OpenAI;
    constructor(personNode:allDataObjects.PersonNode) {
        this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.personNode = personNode;
    }

    async createCompletion(mostRecentMessageArr) {
        const tools = await new ToolsForAgents().getTools();
        // @ts-ignore
        const response = await this.client.chat.completions.create({ model: modelName, messages: mostRecentMessageArr, tools: tools, tool_choice: "auto" });
        const responseMessage =  response.choices[0].message;
        console.log("BOT_MESSAGE:", responseMessage.content);
        if (response.choices[0].message.content == null){ 
            console.log("Response Choices::: 1")
        }
        mostRecentMessageArr.push(responseMessage); // extend conversation with assistant's reply
        if (responseMessage.tool_calls) {
            mostRecentMessageArr = await this.addResponseAndToolCallsToMessageHistory(responseMessage, mostRecentMessageArr)
        }
        return mostRecentMessageArr
    }

    async addResponseAndToolCallsToMessageHistory(responseMessage:any, messages:any){
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
                const responseFromFunction = functionToCall( functionArgs, this.personNode); 
                // @ts-ignore
                messages.push({ tool_call_id: toolCall.id, role: "tool", name: functionName, content: responseFromFunction});
            }
            // console.log("Message history in :2=====", messages.slice(1).map((message:any) => message.content).join("\n"),"=====")
            // @ts-ignore
            const response = await openai.chat.completions.create({ model: modelName, messages: messages, tools: new ToolsForAgents().tools, tool_choice: "auto" });
            console.log("BOT_MESSAGE:", response.choices[0].message.content);
            if (response.choices[0].message.content == null){ 
                console.log("Response Choices::: 2")
            }
            messages.push(response.choices[0].message);
            if(response.choices[0].message.tool_calls){
                await this.addResponseAndToolCallsToMessageHistory(response.choices[0].message, messages)
            }
        }
        return messages
        }
    }