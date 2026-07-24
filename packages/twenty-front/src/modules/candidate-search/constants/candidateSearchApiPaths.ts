import { REACT_APP_SERVER_BASE_URL } from '~/config';

/** POST — matches `CandidateSearchController.searchFromFile`. */
export const CANDIDATE_SEARCH_FROM_FILE_PATH = '/candidate-search/search-from-file';

export const getCandidateSearchFromFileUrl = () =>
  `${REACT_APP_SERVER_BASE_URL.replace(/\/$/, '')}${CANDIDATE_SEARCH_FROM_FILE_PATH}`;

const base = () => REACT_APP_SERVER_BASE_URL.replace(/\/$/, '');

/** POST — `ApolloSearchController.searchPeople`. */
export const CANDIDATE_SEARCH_APOLLO_PEOPLE_PATH = '/candidate-search/apollo/people';

export const getCandidateSearchApolloPeopleUrl = () =>
  `${base()}${CANDIDATE_SEARCH_APOLLO_PEOPLE_PATH}`;

/** POST — `ApolloSearchController.searchCompanies`. */
export const CANDIDATE_SEARCH_APOLLO_COMPANIES_PATH =
  '/candidate-search/apollo/companies';

export const getCandidateSearchApolloCompaniesUrl = () =>
  `${base()}${CANDIDATE_SEARCH_APOLLO_COMPANIES_PATH}`;

/** GET — `ApolloSearchController.getJobPostings`. */
export const getCandidateSearchApolloJobPostingsUrl = (
  organizationId: string,
  page?: number,
  perPage?: number,
) => {
  const sp = new URLSearchParams();
  if (page !== undefined) sp.set('page', String(page));
  if (perPage !== undefined) sp.set('per_page', String(perPage));
  const q = sp.toString();
  return `${base()}/candidate-search/apollo/organizations/${encodeURIComponent(organizationId)}/job-postings${q ? `?${q}` : ''}`;
};
