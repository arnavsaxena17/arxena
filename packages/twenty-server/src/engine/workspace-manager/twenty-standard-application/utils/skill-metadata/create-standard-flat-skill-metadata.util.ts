import { type FlatSkill } from 'src/engine/metadata-modules/flat-skill/types/flat-skill.type';
import { type AllStandardSkillName } from 'src/engine/workspace-manager/twenty-standard-application/types/all-standard-skill-name.type';
import {
  type CreateStandardSkillArgs,
  createStandardSkillFlatMetadata,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/create-standard-skill-flat-metadata.util';
import { loadStandardSkillContent } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/load-standard-skill-content.util';

type StandardSkillDefinition = {
  skillName: AllStandardSkillName;
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
    description:
      'Creating and managing automation workflows with triggers, steps, and FORM human-in-the-loop approval via WhatsApp Official',
    icon: 'IconSettingsAutomation',
  }),
  'data-manipulation': createStandardSkillBuilder({
    skillName: 'data-manipulation',
    name: 'data-manipulation',
    label: 'Data Manipulation',
    description:
      'Searching, filtering, creating, and updating records across all objects',
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
    description: 'Creating and managing dashboards with widgets and layouts',
    icon: 'IconLayoutDashboard',
  }),
  'metadata-building': createStandardSkillBuilder({
    skillName: 'metadata-building',
    name: 'metadata-building',
    label: 'Metadata Building',
    description:
      'Managing the data model: creating objects, fields, and relations',
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
    description:
      'Creating and configuring views (table, board/kanban, calendar) for objects to organize and visualize records',
    icon: 'IconLayoutBoard',
  }),
  'view-filters-and-sorts': createStandardSkillBuilder({
    skillName: 'view-filters-and-sorts',
    name: 'view-filters-and-sorts',
    label: 'View Filters & Sorts',
    description:
      'Adding filters and sorts to views to focus on relevant records based on user needs',
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
    description:
      'Campaign setup: ICP and outreach preferences on workspaceProfile defaults; hand off to Find companies/people',
    icon: 'IconTargetArrow',
  }),
  outreach: createStandardSkillBuilder({
    skillName: 'outreach',
    name: 'outreach',
    label: 'Outreach',
    description:
      'Campaign automation: activate seeded harvest/enroll/sequencer graphs, enroll QUEUED candidates, HITL send',
    icon: 'IconSend',
  }),
  search: createStandardSkillBuilder({
    skillName: 'search',
    name: 'search',
    label: 'Search',
    description:
      'Source companies and people (Apollo/LinkedIn/Harvest/Exa); Find → ephemeral tabs, Save/Enroll/Harvest per destination verbs',
    icon: 'IconBuildingSkyscraper',
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
