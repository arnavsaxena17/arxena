import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import {
  ARXENA_INTERNAL_TOOL_NAMES,
  ARXENA_TOOL_CATALOG,
  getOutreachSkillContent,
  listOutreachSkillNames,
} from 'twenty-shared/outreach';

import { ACTION_TOOL_IDS } from 'src/engine/core-modules/tool-provider/constants/action-tool-label.constant';

const CONTENTS_DIRECTORY = join(__dirname, '..', 'contents');

// Characters per token, same rule as the system prompt preview
const CHARACTERS_PER_TOKEN = 4;

// A ratchet, not a target: a skill is re-sent on every model step after it is
// loaded, so growing past its budget needs a deliberate change here.
const SKILL_TOKEN_BUDGETS: Record<string, number> = {
  search: 16_000,
  outreach: 4_500,
  'workflow-building': 4_500,
  'ai-filter-enrich': 4_000,
  'dashboard-building': 3_000,
  'workspace-demo-seeding': 3_000,
  'data-manipulation': 3_000,
  'org-structure-insights': 2_500,
  'code-interpreter': 2_000,
  setup: 2_000,
  'view-building': 1_500,
  'view-filters-and-sorts': 1_500,
  'spreadsheet-import': 1_500,
  pptx: 1_500,
  docx: 1_500,
  pdf: 1_000,
  'metadata-building': 1_000,
  xlsx: 1_000,
  'local-business-search': 1_000,
  'custom-objects-cleanup': 1_000,
  'resolve-company-name': 1_000,
  research: 500,
};

const loadAllSkills = (): Record<string, string> => {
  const skills: Record<string, string> = {};

  for (const skillName of listOutreachSkillNames()) {
    skills[skillName] = getOutreachSkillContent(skillName);
  }

  for (const fileName of readdirSync(CONTENTS_DIRECTORY)) {
    if (fileName.endsWith('.md')) {
      skills[fileName.replace(/\.md$/, '')] = readFileSync(
        join(CONTENTS_DIRECTORY, fileName),
        'utf-8',
      );
    }
  }

  return skills;
};

// Registered in ActionToolProvider's map or created by the core tool set
const OTHER_KNOWN_TOOLS = [
  'extract_json_paths',
  'search_output',
  'learn_tools',
  'execute_tool',
  'load_skills',
  'ask_questions',
  'get_tool_catalog',
];

// Tools built per workspace by the CRUD, workflow, dashboard, view and metadata
// providers, so they are not in any static list
const GENERATED_TOOL_PATTERN =
  /^(find_many|find_one|create_one|create_many|update_one|update_many|delete_one|delete_many|destroy_one|restore_one|group_by)_|workflow|dashboard|logic_function|_view$|object_metadata/;

// Backticked names that look like tools but are not tool names
const NON_TOOL_NAMES: Record<string, string> = {
  save_to_crm: 'an action value of outreach_list, not a tool',
  exa_web_search: 'resolved to app_exa_web_search by the tool name resolver',
  linkedin_followers: 'a Bright Data field name',
};

const TOOL_LIKE_NAME = /`([a-z][a-z0-9]*(?:_[a-z0-9]+)+)`/g;

// Only names that read like a tool call are checked
const TOOL_CALL_PREFIX =
  /^(search|find|get|list|upsert|run|apply|generate|fetch|linkedin|outreach|start|preview|cancel|inspect|import|check|google|visit|send|draft|resolve|activate)_/;

describe('standard skill content', () => {
  const skills = loadAllSkills();

  describe('tool references', () => {
    const knownTools = new Set<string>([
      ...ARXENA_TOOL_CATALOG.map((entry) => entry.name),
      ...ACTION_TOOL_IDS,
      ...OTHER_KNOWN_TOOLS,
      // Hidden from the catalog; a skill may mention them to say not to call them
      ...ARXENA_INTERNAL_TOOL_NAMES,
    ]);

    it.each(Object.entries(skills))(
      'should only name tools that exist in %s',
      (_skillName, content) => {
        const unknownNames = [
          ...new Set(
            [...content.matchAll(TOOL_LIKE_NAME)].map((match) => match[1]),
          ),
        ].filter(
          (name) =>
            TOOL_CALL_PREFIX.test(name) &&
            !knownTools.has(name) &&
            !GENERATED_TOOL_PATTERN.test(name) &&
            !(name in NON_TOOL_NAMES),
        );

        expect(unknownNames).toEqual([]);
      },
    );
  });

  describe('token budgets', () => {
    it('should have a budget for every skill', () => {
      expect(Object.keys(skills).sort()).toEqual(
        Object.keys(SKILL_TOKEN_BUDGETS).sort(),
      );
    });

    it.each(Object.entries(skills))(
      'should keep %s within its token budget',
      (skillName, content) => {
        const tokens = Math.ceil(content.length / CHARACTERS_PER_TOKEN);

        expect(tokens).toBeLessThanOrEqual(SKILL_TOKEN_BUDGETS[skillName]);
      },
    );
  });
});
