// import OpenAI from 'openai';
// import Anthropic from '@anthropic-ai/sdk';
// import { Injectable } from '@nestjs/common';
// import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
// // import { WorkspaceQueryService } from '../workspace-query.service';

// @Injectable()
// export class LLMProviders {
//   constructor(
//     private readonly workspaceQueryService: WorkspaceQueryService
//   ) {}

//   async initializeLLMClients(workspaceId: string) {
//     console.log("Workspace API key:", await this.workspaceQueryService.getWorkspaceApiKey(workspaceId, 'openaikey'))
//     console.log("Workspace API key:", await this.workspaceQueryService.getWorkspaceApiKey(workspaceId, 'anthropicKey'))
//     const openAIKey = await this.workspaceQueryService.getWorkspaceApiKey(workspaceId, 'openaikey') || process.env.OPENAI_API_KEY;
//     const anthropicKey = await this.workspaceQueryService.getWorkspaceApiKey(workspaceId, 'anthropicKey') || process.env.ANTHROPIC_API_KEY;

//     return {
//       openAIclient: new OpenAI({ apiKey: openAIKey }),
//       anthropic: new Anthropic({ apiKey: anthropicKey })
//     };
//   }


// }