import * as allDataObjects from '../data-model-objects';
const modelName = 'gpt-4o';
import { ToolsForAgents } from '../../services/llm-agents/prompting-tool-calling';

import { LLMProviders } from './llm-agents';


async function updateMostRecentMessagesBasedOnNewSystemPrompt(mostRecentMessageArr: allDataObjects.ChatHistoryItem[], newSystemPrompt: string) {
  mostRecentMessageArr[0] = { role: 'system', content: newSystemPrompt };
  return mostRecentMessageArr;
}
export async function getStageOfTheConversation(personNode:allDataObjects.PersonNode, mostRecentMessageArr: allDataObjects.ChatHistoryItem[]) {
    let stage: string | null;
    console.log('got here to get the stage of the conversation');
      const stagePrompt = await new ToolsForAgents().getStagePrompt();
      // console.log('got here to with the stage prompt', stagePrompt);
      const updatedMostRecentMessagesBasedOnNewSystemPrompt = await updateMostRecentMessagesBasedOnNewSystemPrompt(mostRecentMessageArr, stagePrompt);
      console.log('Got the updated recement messages for stage prompt:', updatedMostRecentMessagesBasedOnNewSystemPrompt);
      // @ts-ignore
      const response = await new LLMProviders().openAIclient.chat.completions.create({ model: modelName, messages: updatedMostRecentMessagesBasedOnNewSystemPrompt });
      console.log("This is the stage that is arrived at:::", response.choices[0].message.content)
      stage = response.choices[0].message.content ?? '1';
      console.log('This the stage that is determined by the model:', response.choices[0].message.content);
    // }
    console.log('This is the stage that is arrived at:', stage);
    return stage;
  }