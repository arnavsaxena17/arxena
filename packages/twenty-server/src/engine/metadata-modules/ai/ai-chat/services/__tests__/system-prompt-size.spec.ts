import { COMMON_PRELOAD_TOOLS } from 'src/engine/core-modules/tool-provider/constants/common-preload-tools.const';
import { SystemPromptBuilderService } from 'src/engine/metadata-modules/ai/ai-chat/services/system-prompt-builder.service';
import { type FlatSkill } from 'src/engine/metadata-modules/flat-skill/types/flat-skill.type';
import { selectSkillSections } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/select-skill-sections.util';
import {
  getSkillContent,
  getSkillFrontMatter,
  listSkillNames,
  resolveSkillSections,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/skill-library';

// Characters per token, same rule as skill-content-integrity.spec.ts
const CHARACTERS_PER_TOKEN = 4;

// Rebuilt and re-sent on every turn and step. Measured 4_745 with every standard
// skill listed and no tool categories; raise it only by cutting elsewhere.
const SYSTEM_PROMPT_TOKEN_BUDGET = 5_000;

// What load_skills returns when the model names a skill and no sections. Only
// skills with parts differ from their whole content, which
// skill-content-integrity.spec.ts already budgets. Measured 10_085 and 2_251.
const DEFAULT_LOAD_TOKEN_BUDGETS: Record<string, number> = {
  sourcing: 10_500,
  'ai-filter-enrich': 2_400,
};

const tokensOf = (text: string): number =>
  Math.ceil(text.length / CHARACTERS_PER_TOKEN);

const defaultLoadOf = (skillName: string): string =>
  selectSkillSections(
    getSkillContent(skillName),
    resolveSkillSections(skillName),
  ).content;

describe('prompt size', () => {
  it('should keep the Ask AI system prompt within its budget', () => {
    const service = new SystemPromptBuilderService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const skillCatalog = listSkillNames().map((skillName) => ({
      name: skillName,
      label: skillName,
      description: getSkillFrontMatter(skillName)?.description ?? skillName,
    })) as FlatSkill[];

    const prompt = service.buildFullPrompt(
      [],
      skillCatalog,
      COMMON_PRELOAD_TOOLS,
    );

    expect(tokensOf(prompt)).toBeLessThanOrEqual(SYSTEM_PROMPT_TOKEN_BUDGET);
  });

  it('should budget the default load of every skill that has parts', () => {
    const skillsWithParts = listSkillNames().filter(
      (skillName) => defaultLoadOf(skillName) !== getSkillContent(skillName),
    );

    expect(skillsWithParts.sort()).toEqual(
      Object.keys(DEFAULT_LOAD_TOKEN_BUDGETS).sort(),
    );
  });

  it.each(Object.entries(DEFAULT_LOAD_TOKEN_BUDGETS))(
    'should keep the default load of %s under %i tokens',
    (skillName, budget) => {
      expect(tokensOf(defaultLoadOf(skillName))).toBeLessThanOrEqual(budget);
    },
  );
});
