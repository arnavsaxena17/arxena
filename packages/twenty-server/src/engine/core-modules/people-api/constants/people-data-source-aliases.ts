export type PeopleDataSourceAlias =
  | 'index'
  | 'apollo'
  | 'pdl'
  | 'contactout'
  | 'harvest';

export type PeopleDataSourceCategory = {
  alias: PeopleDataSourceAlias;
  label: string;
  description: string;
  supportsStdFunctionFilter: boolean;
  supportsStdGradeFilter: boolean;
};

export const PEOPLE_DATA_SOURCE_CATEGORIES: PeopleDataSourceCategory[] = [
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
      'Directory-style people search. Map std_function to title keywords when possible.',
    supportsStdFunctionFilter: false,
    supportsStdGradeFilter: false,
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
    description: 'LinkedIn lead search via Sales Navigator parameters.',
    supportsStdFunctionFilter: false,
    supportsStdGradeFilter: false,
  },
];

export const isPeopleDataSourceAlias = (
  value: string,
): value is PeopleDataSourceAlias =>
  PEOPLE_DATA_SOURCE_CATEGORIES.some((category) => category.alias === value);
