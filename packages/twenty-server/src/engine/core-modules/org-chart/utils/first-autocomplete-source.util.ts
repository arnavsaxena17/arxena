export type OrgChartFirstAutocompleteSource = 'apollo' | 'elasticsearch';

export const resolveFirstAutocompleteSource = (args: {
  authToken?: string;
}): OrgChartFirstAutocompleteSource => {
  if (args.authToken?.trim()) {
    return 'elasticsearch';
    // return 'apollo';
    // return 'apollo';
  }

  return 'elasticsearch';
};
