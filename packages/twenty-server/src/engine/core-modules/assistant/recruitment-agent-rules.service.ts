import { Injectable } from '@nestjs/common';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { graphqlQueryToFetchPrompts } from 'twenty-shared';
import {
  AUTONOMOUS_RECRUITER_RULES_PROMPT_NAME,
  getDefaultRecruitmentAgentSystemPrompt,
} from './prompts/recruitment-agent-rules';

/**
 * Resolves the system prompt for the autonomous recruiter (and optional chat):
 * if a Prompt with name AUTONOMOUS_RECRUITER_RULES exists in the workspace, use its prompt text;
 * otherwise use the default from recruitment-agent-rules.ts.
 */
@Injectable()
export class RecruitmentAgentRulesService {
  constructor(private readonly staticGraphQLService: StaticGraphQLService) {}

  async getSystemPrompt(apiToken: string): Promise<string> {
    try {
      const result = await this.staticGraphQLService.executeGraphQL(
        graphqlQueryToFetchPrompts,
        {
          filter: { name: { eq: AUTONOMOUS_RECRUITER_RULES_PROMPT_NAME } },
          limit: 1,
        },
        apiToken,
      );
      const edges = result?.prompts?.edges ?? [];
      const promptText =
        edges.length > 0 && typeof edges[0].node?.prompt === 'string'
          ? (edges[0].node.prompt as string).trim()
          : '';
      if (promptText) {
        return promptText;
      }
    } catch {
      // Fall through to default
    }
    return getDefaultRecruitmentAgentSystemPrompt();
  }
}
