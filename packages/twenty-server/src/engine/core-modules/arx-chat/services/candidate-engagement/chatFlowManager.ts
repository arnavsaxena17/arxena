// import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
// import * as allDataObjects from '../../services/data-model-objects';
// import { ChatControls } from './chat-controls';


// class ChatFlowManager {
//     constructor(
//       private readonly flowConfig: allDataObjects.ChatFlowConfig,
//       private readonly workspaceQueryService: WorkspaceQueryService
//     ) {}
  
//     async determineNextChatControl(candidate: allDataObjects.CandidateNode, currentControl: string): Promise<string | null> {
//       const node = this.flowConfig[currentControl];
//       if (!node) return null;
  
//       // Check conditions in order
//       if (node.conditions) {
//         for (const condition of node.conditions) {
//           if (condition.evaluator(candidate)) {
//             return condition.nextNode;
//           }
//         }
//       }
  
//       // If no conditions match but there's a default next node
//       return node.nextNodes[0] || null;
//     }
  
//     async updateChatControl(candidateId: string, newControl: string, apiToken: string) {
//       const chatControl: allDataObjects.chatControls = {
//         chatControlType: newControl
//       };
      
//       await new ChatControls(this.workspaceQueryService)
//         .createChatControl(candidateId, chatControl, apiToken);
//     }
//   }