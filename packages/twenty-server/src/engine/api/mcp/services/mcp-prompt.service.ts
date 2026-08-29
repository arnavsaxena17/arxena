import { Injectable } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import { type FlatSkill } from 'src/engine/metadata-modules/flat-skill/types/flat-skill.type';
import { SkillService } from 'src/engine/metadata-modules/skill/skill.service';

export const MCP_SKILL_PROMPT_TASK_ARGUMENT = {
  name: 'task',
  description:
    'Optional user request to carry out with this skill. When set, skip load_skills for this skill on the current turn.',
  required: false,
} as const;

export type McpPromptListItem = {
  name: string;
  title: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
};

export type McpPromptGetResult = {
  description: string;
  messages: Array<{
    role: 'user';
    content: {
      type: 'text';
      text: string;
    };
  }>;
};

@Injectable()
export class McpPromptService {
  constructor(private readonly skillService: SkillService) {}

  async listPrompts(workspaceId: string): Promise<McpPromptListItem[]> {
    const skills = await this.skillService.findAllFlatSkills(workspaceId);

    return skills.map((skill) => this.toPromptListItem(skill));
  }

  async getPrompt({
    workspaceId,
    name,
    task,
  }: {
    workspaceId: string;
    name: string;
    task?: string;
  }): Promise<McpPromptGetResult | null> {
    const [skill] = await this.skillService.findFlatSkillsByNames(
      [name],
      workspaceId,
    );

    if (!isDefined(skill)) {
      return null;
    }

    const taskSuffix =
      isDefined(task) && task.trim().length > 0
        ? `\n\nUser request:\n${task.trim()}`
        : '';

    return {
      description: skill.description ?? skill.label,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `${skill.content}${taskSuffix}`,
          },
        },
      ],
    };
  }

  private toPromptListItem(skill: FlatSkill): McpPromptListItem {
    return {
      name: skill.name,
      title: skill.label,
      description: skill.description ?? skill.label,
      arguments: [MCP_SKILL_PROMPT_TASK_ARGUMENT],
    };
  }
}
