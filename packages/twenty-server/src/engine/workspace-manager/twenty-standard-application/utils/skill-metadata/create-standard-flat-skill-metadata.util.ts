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
    description: 'Finding information and gathering facts from the web',
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
  'linkedin-search': createStandardSkillBuilder({
    skillName: 'linkedin-search',
    name: 'linkedin-search',
    label: 'LinkedIn Search',
    description:
      'Searching LinkedIn people, companies, jobs, and posts via Unipile (classic, Sales Navigator, Recruiter) and Harvest People API',
    icon: 'IconBrandLinkedin',
  }),
  'gtm-icp-onboarding': createStandardSkillBuilder({
    skillName: 'gtm-icp-onboarding',
    name: 'gtm-icp-onboarding',
    label: 'GTM ICP Onboarding',
    description:
      'Conversational GTM Command bootstrap: collect ICP and outreach preferences in Ask AI, persist on Project, hand off to company/people discovery',
    icon: 'IconTargetArrow',
  }),
  'search-companies': createStandardSkillBuilder({
    skillName: 'search-companies',
    name: 'search-companies',
    label: 'Search Companies',
    description:
      'Sourcing companies across Arxena data providers (Apollo, LinkedIn/Unipile, Harvest, Exa) and the internal index, then deduping and saving to the CRM',
    icon: 'IconBuildingSkyscraper',
  }),
  'search-people': createStandardSkillBuilder({
    skillName: 'search-people',
    name: 'search-people',
    label: 'Search People',
    description:
      'Sourcing people/candidates across Arxena data providers (Apollo, LinkedIn/Unipile, Harvest, Exa) and the internal index, then deduping and saving to the CRM',
    icon: 'IconUsers',
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
