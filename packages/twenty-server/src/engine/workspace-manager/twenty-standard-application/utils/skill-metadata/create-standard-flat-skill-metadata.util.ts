import {
  getSkillDescription,
  getSkillIcon,
  getSkillLabel,
  listPlaybookNames,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/skill-library';

import { type FlatSkill } from 'src/engine/metadata-modules/flat-skill/types/flat-skill.type';
import { type AllStandardSkillName } from 'src/engine/workspace-manager/twenty-standard-application/types/all-standard-skill-name.type';
import {
  type CreateStandardSkillArgs,
  createStandardSkillFlatMetadata,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/create-standard-skill-flat-metadata.util';
import { loadStandardSkillContent } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/load-standard-skill-content.util';

type StandardSkillDefinition = {
  skillName: string;
  name: string;
  label: string;
  description: string;
  icon: string;
  isActive?: boolean;
};

const createStandardSkillBuilder =
  (definition: StandardSkillDefinition) =>
  (args: Omit<CreateStandardSkillArgs, 'context'>): FlatSkill =>
    createStandardSkillFlatMetadata({
      ...args,
      context: {
        ...definition,
        content: loadStandardSkillContent(definition.skillName),
        isCustom: false,
        isActive: definition.isActive ?? true,
      },
    });

export const STANDARD_FLAT_SKILL_METADATA_BUILDERS_BY_SKILL_NAME = {
  'workflow-building': createStandardSkillBuilder({
    skillName: 'workflow-building',
    name: 'workflow-building',
    label: 'Workflow Building',
    description: getSkillDescription('workflow-building'),
    icon: 'IconSettingsAutomation',
  }),
  'data-manipulation': createStandardSkillBuilder({
    skillName: 'data-manipulation',
    name: 'data-manipulation',
    label: 'Data Manipulation',
    description: getSkillDescription('data-manipulation'),
    icon: 'IconDatabase',
  }),
  'workspace-demo-seeding': createStandardSkillBuilder({
    skillName: 'workspace-demo-seeding',
    name: 'workspace-demo-seeding',
    label: 'Workspace Demo Seeding',
    description:
      'Seeding demo metadata and data for workspace setup and testing purposes',
    icon: 'IconDatabase',
  }),
  'dashboard-building': createStandardSkillBuilder({
    skillName: 'dashboard-building',
    name: 'dashboard-building',
    label: 'Dashboard Building',
    description: getSkillDescription('dashboard-building'),
    icon: 'IconLayoutDashboard',
  }),
  'metadata-building': createStandardSkillBuilder({
    skillName: 'metadata-building',
    name: 'metadata-building',
    label: 'Metadata Building',
    description: getSkillDescription('metadata-building'),
    icon: 'IconBuildingSkyscraper',
  }),
  research: createStandardSkillBuilder({
    skillName: 'research',
    name: 'research',
    label: 'Research',
    description:
      'Finding general facts from the web — prefer `search` when sourcing target companies or people',
    icon: 'IconSearch',
  }),
  'code-interpreter': createStandardSkillBuilder({
    skillName: 'code-interpreter',
    name: 'code-interpreter',
    label: 'Code Interpreter',
    description:
      'Python code execution for data analysis, complex multi-step operations, and efficient bulk processing via MCP bridge',
    icon: 'IconCode',
  }),
  xlsx: createStandardSkillBuilder({
    skillName: 'xlsx',
    name: 'xlsx',
    label: 'Excel & Spreadsheets',
    description:
      'Excel/spreadsheet creation, editing, and analysis with formulas, formatting, and visualization',
    icon: 'IconFileSpreadsheet',
  }),
  pdf: createStandardSkillBuilder({
    skillName: 'pdf',
    name: 'pdf',
    label: 'PDF Processing',
    description:
      'PDF form filling, field extraction, table parsing, and validation',
    icon: 'IconFileTypePdf',
  }),
  docx: createStandardSkillBuilder({
    skillName: 'docx',
    name: 'docx',
    label: 'Word Documents',
    description:
      'Word document creation, editing, template processing, and OOXML manipulation',
    icon: 'IconFileTypeDocx',
  }),
  'view-building': createStandardSkillBuilder({
    skillName: 'view-building',
    name: 'view-building',
    label: 'View Building',
    description: getSkillDescription('view-building'),
    icon: 'IconLayoutBoard',
  }),
  'view-filters-and-sorts': createStandardSkillBuilder({
    skillName: 'view-filters-and-sorts',
    name: 'view-filters-and-sorts',
    label: 'View Filters & Sorts',
    description: getSkillDescription('view-filters-and-sorts'),
    icon: 'IconFilter',
  }),
  'custom-objects-cleanup': createStandardSkillBuilder({
    skillName: 'custom-objects-cleanup',
    name: 'custom-objects-cleanup',
    label: 'Custom Objects Cleanup',
    description:
      'Archiving custom objects from a workspace (e.g. dev seed objects like pets, rockets)',
    icon: 'IconArchive',
  }),
  setup: createStandardSkillBuilder({
    skillName: 'setup',
    name: 'setup',
    label: 'Setup',
    description: getSkillDescription('setup'),
    icon: 'IconTargetArrow',
  }),
  outreach: createStandardSkillBuilder({
    skillName: 'outreach',
    name: 'outreach',
    label: 'Outreach',
    description: getSkillDescription('outreach'),
    icon: 'IconSend',
  }),
  search: createStandardSkillBuilder({
    skillName: 'search',
    name: 'search',
    label: 'Search',
    description: getSkillDescription('search'),
    icon: 'IconBuildingSkyscraper',
  }),
  'org-structure-insights': createStandardSkillBuilder({
    skillName: 'org-structure-insights',
    name: 'org-structure-insights',
    label: 'Org Structure Insights',
    description: getSkillDescription('org-structure-insights'),
    icon: 'IconSitemap',
  }),
  'ai-filter-enrich': createStandardSkillBuilder({
    skillName: 'ai-filter-enrich',
    name: 'ai-filter-enrich',
    label: 'AI Filter & Enrich',
    description: getSkillDescription('ai-filter-enrich'),
    icon: 'IconSparkles',
  }),
  'spreadsheet-import': createStandardSkillBuilder({
    skillName: 'spreadsheet-import',
    name: 'spreadsheet-import',
    label: 'Spreadsheet Import',
    description: getSkillDescription('spreadsheet-import'),
    icon: 'IconTableImport',
  }),
  pptx: createStandardSkillBuilder({
    skillName: 'pptx',
    name: 'pptx',
    label: 'PowerPoint',
    description:
      'PowerPoint creation, editing, templates, thumbnails, and slide manipulation',
    icon: 'IconPresentation',
  }),
} satisfies {
  [P in AllStandardSkillName]: (
    args: Omit<CreateStandardSkillArgs, 'context'>,
  ) => FlatSkill;
};

// Every playbook file becomes a standard skill with no per-skill code: its
// label, description and icon come from its front matter.
export const STANDARD_PLAYBOOK_FLAT_SKILL_METADATA_BUILDERS_BY_SKILL_NAME: Record<
  string,
  (args: Omit<CreateStandardSkillArgs, 'context'>) => FlatSkill
> = Object.fromEntries(
  listPlaybookNames().map((name) => [
    name,
    createStandardSkillBuilder({
      skillName: name,
      name,
      label: getSkillLabel(name),
      description: getSkillDescription(name),
      icon: getSkillIcon(name),
    }),
  ]),
);
