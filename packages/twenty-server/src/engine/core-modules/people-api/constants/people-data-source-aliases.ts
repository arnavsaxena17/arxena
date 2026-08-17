export type PeopleDataSourceAlias =
  | 'auto'
  | 'index'
  | 'apollo'
  | 'pdl'
  | 'contactout'
  | 'harvest'
  | 'unipile'
  | 'pool';

export type PeopleResolvedDataSourceAlias = Exclude<
  PeopleDataSourceAlias,
  'auto'
>;

export const PEOPLE_LINKEDIN_DATA_SOURCES = [
  'harvest',
  'unipile',
  'pool',
] as const;

export type PeopleLinkedInDataSource =
  (typeof PEOPLE_LINKEDIN_DATA_SOURCES)[number];

export type PeopleDataSourceCategory = {
  alias: PeopleDataSourceAlias;
  label: string;
  description: string;
  supportsStdFunctionFilter: boolean;
  supportsStdGradeFilter: boolean;
};

export const PEOPLE_DATA_SOURCE_CATEGORIES: PeopleDataSourceCategory[] = [
  {
    alias: 'auto',
    label: 'Auto',
    description:
      'Resolve the caller workspace member LinkedIn Unipile account, or any workspace member with Sales Navigator when the token is an API key.',
    supportsStdFunctionFilter: true,
    supportsStdGradeFilter: true,
  },
  {
    alias: 'index',
    label: 'Index',
    description:
      'Search the standardized people index with std_function and std_grade filters.',
    supportsStdFunctionFilter: true,
    supportsStdGradeFilter: true,
  },
  {
    alias: 'apollo',
    label: 'Apollo',
    description:
      'Apollo people search via mapped person_department_or_subdepartments and person_seniorities.',
    supportsStdFunctionFilter: true,
    supportsStdGradeFilter: true,
  },
  {
    alias: 'pdl',
    label: 'PDL',
    description: 'Person search by company and title keywords.',
    supportsStdFunctionFilter: false,
    supportsStdGradeFilter: false,
  },
  {
    alias: 'contactout',
    label: 'ContactOut',
    description: 'Company-scoped people search.',
    supportsStdFunctionFilter: false,
    supportsStdGradeFilter: false,
  },
  {
    alias: 'harvest',
    label: 'Harvest',
    description:
      'LinkedIn Sales Navigator lead search via Harvest (functionIds mapped from std taxonomy).',
    supportsStdFunctionFilter: true,
    supportsStdGradeFilter: true,
  },
  {
    alias: 'unipile',
    label: 'Unipile',
    description:
      'LinkedIn Sales Navigator people search via an explicit Unipile account id.',
    supportsStdFunctionFilter: true,
    supportsStdGradeFilter: true,
  },
  {
    alias: 'pool',
    label: 'Sales Nav pool',
    description:
      'LinkedIn Sales Navigator people search via the shared Unipile Sales Navigator pool.',
    supportsStdFunctionFilter: true,
    supportsStdGradeFilter: true,
  },
];

export const isPeopleDataSourceAlias = (
  value: string,
): value is PeopleDataSourceAlias =>
  PEOPLE_DATA_SOURCE_CATEGORIES.some((category) => category.alias === value);
