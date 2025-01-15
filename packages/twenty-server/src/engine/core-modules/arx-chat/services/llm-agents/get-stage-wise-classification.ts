import * as allDataObjects from '../data-model-objects';
import { ToolsForAgents } from '../../services/llm-agents/prompting-tool-calling';

import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';


const modelName = 'gpt-4o';

export class StageWiseClassification{
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService
  ) {}

  async updateMostRecentMessagesBasedOnNewSystemPrompt(mostRecentMessageArr: allDataObjects.ChatHistoryItem[], newSystemPrompt: string) {
    mostRecentMessageArr[0] = { role: 'system', content: newSystemPrompt };
    return mostRecentMessageArr;
  }
  async getStageOfTheConversation(personNode:allDataObjects.PersonNode, mostRecentMessageArr: allDataObjects.ChatHistoryItem[]) {
      let stage: string | null;
      console.log('got here to get the stage of the conversation');
        const stagePrompt = await new ToolsForAgents(this.workspaceQueryService).getStagePrompt();
        // console.log('got here to with the stage prompt', stagePrompt);
        const updatedMostRecentMessagesBasedOnNewSystemPrompt = await this.updateMostRecentMessagesBasedOnNewSystemPrompt(mostRecentMessageArr, stagePrompt);
        console.log('Got the updated recement messages for stage prompt:', updatedMostRecentMessagesBasedOnNewSystemPrompt);
        // @ts-ignore
        const response = await new this.workspaceQueryService.llmProviders.openAIclient.chat.completions.create({ model: modelName, messages: updatedMostRecentMessagesBasedOnNewSystemPrompt });
        console.log("This is the stage that is arrived at:::", response.choices[0].message.content)
        stage = response.choices[0].message.content ?? '1';
        console.log('This the stage that is determined by the model:', response.choices[0].message.content);
      // }
      console.log('This is the stage that is arrived at:', stage);
      return stage;
    }
}

