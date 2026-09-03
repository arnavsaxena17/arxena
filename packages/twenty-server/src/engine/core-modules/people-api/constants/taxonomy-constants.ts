import { FUNCTION_ROOT_VALUES } from 'src/engine/core-modules/candidate-search/schemas/org-chart.schema';

export const PEOPLE_TAXONOMY_GRADE_VALUES = [
  'entry',
  'mid',
  'leadership',
] as const;

export type PeopleTaxonomyGrade =
  (typeof PEOPLE_TAXONOMY_GRADE_VALUES)[number];

export const PEOPLE_TAXONOMY_FUNCTION_ROOT_VALUES = FUNCTION_ROOT_VALUES;

export type PeopleTaxonomyFunctionRoot =
  (typeof PEOPLE_TAXONOMY_FUNCTION_ROOT_VALUES)[number];

export type TaxonomyConstantItem = {
  id: string;
  label: string;
  description: string;
};

const toTitleCaseLabel = (value: string): string =>
  value
    .split(' ')
    .map((part) =>
      part.length === 0
        ? part
        : `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
    )
    .join(' ');

export const toTaxonomyConstantLabel = toTitleCaseLabel;

// Apollo-style public nouns only — flat lists, one-line definitions, no trees.
export const TAXONOMY_GRADE_LEVEL_CONSTANTS: TaxonomyConstantItem[] = [
  {
    id: 'leadership',
    label: 'Leadership',
    description: 'Senior leaders and heads of function.',
  },
  {
    id: 'mid',
    label: 'Mid',
    description: 'Managers and experienced individual contributors.',
  },
  {
    id: 'entry',
    label: 'Entry',
    description: 'Early-career and coordinator-level roles.',
  },
];

export const TAXONOMY_GRADE_CATEGORY_CONSTANTS: TaxonomyConstantItem[] = [
  {
    id: 'ceo',
    label: 'CEO',
    description: 'Top corporate leadership band on org charts.',
  },
  {
    id: 'senior',
    label: 'Senior',
    description: 'Senior / leadership band within a function root.',
  },
  {
    id: 'mid',
    label: 'Mid',
    description: 'Mid band within a function root.',
  },
  {
    id: 'entry',
    label: 'Entry',
    description: 'Entry band within a function root.',
  },
];

export const TAXONOMY_FUNCTION_ROOT_CONSTANTS: TaxonomyConstantItem[] =
  FUNCTION_ROOT_VALUES.map((id) => ({
    id,
    label: toTitleCaseLabel(id),
    description: `Department family: ${id}.`,
  }));

export type TaxonomyConstantsResponse = {
  status: 'ok';
  gradeLevels: TaxonomyConstantItem[];
  gradeCategories: TaxonomyConstantItem[];
  functionRoots: TaxonomyConstantItem[];
};
