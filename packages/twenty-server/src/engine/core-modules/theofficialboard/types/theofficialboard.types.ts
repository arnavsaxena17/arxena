export type TheOfficialBoardStorageLocation = {
  folderPath: string;
  filename: string;
  path: string;
};

export type TheOfficialBoardStorageTarget = {
  folderSegments?: string[];
  filename?: string;
};

export type TheOfficialBoardSlugResolution = {
  inputSlug: string;
  attemptedSlugs: string[];
  successfulCandidate: string;
  discoveredViaBrightDataSerp?: boolean;
};

export type TheOfficialBoardFetchCompanyOptions = {
  persist?: boolean;
  storageTarget?: TheOfficialBoardStorageTarget;
};

export type TheOfficialBoardResponseSection =
  | 'all'
  | 'company'
  | 'divisions'
  | 'subsidiaries'
  | 'candidates';

export type TheOfficialBoardSubsidiary = {
  name: string;
  slug: string | null;
  level: number;
  parentSlug: string | null;
  children: TheOfficialBoardSubsidiary[];
};

export type TheOfficialBoardCandidate = {
  id: string;
  name: string | null;
  isMasked: boolean;
  title: string | null;
  displayTitle: string | null;
  companyContextName: string | null;
  companyContextSlug: string | null;
  parentCandidateId: string | null;
  topLevel: boolean;
  divisionKey: string | null;
  divisionName: string | null;
  sourceSlug: string;
};

export type TheOfficialBoardDivision = {
  key: string;
  name: string;
  headCandidateId: string | null;
  headCandidateName: string | null;
  childDepartmentNames: string[];
  childCandidateIds: string[];
};

export type TheOfficialBoardCompanyResponse = {
  inputSlug: string;
  slug: string;
  companyName: string;
  url: string;
  websiteUrl: string | null;
  executivesCount: number | null;
  subsidiariesCount: number | null;
  updatedLabel: string | null;
  parentCompanyName: string | null;
  parentCompanySlug: string | null;
  divisions: TheOfficialBoardDivision[];
  candidates: TheOfficialBoardCandidate[];
  subsidiaries: TheOfficialBoardSubsidiary[];
  storage?: TheOfficialBoardStorageLocation;
  slugResolution?: TheOfficialBoardSlugResolution;
};

export type TheOfficialBoardCompanyProjection = {
  slug: string;
  companyName: string;
  sections: TheOfficialBoardResponseSection[];
  company?: {
    inputSlug: string;
    slug: string;
    companyName: string;
    url: string;
    websiteUrl: string | null;
    executivesCount: number | null;
    subsidiariesCount: number | null;
    updatedLabel: string | null;
    parentCompanyName: string | null;
    parentCompanySlug: string | null;
    storage?: TheOfficialBoardStorageLocation;
    slugResolution?: TheOfficialBoardSlugResolution;
  };
  divisions?: TheOfficialBoardDivision[];
  subsidiaries?: TheOfficialBoardSubsidiary[];
  candidates?: TheOfficialBoardCandidate[];
};
