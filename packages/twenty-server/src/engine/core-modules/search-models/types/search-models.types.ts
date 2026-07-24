export type CandidateEducationDetail = {
  institute?: string;
  course?: string;
  specialization?: string;
  year?: number;
};

export type CandidateEmploymentRecord = {
  designation?: string;
  organization?: string;
  startDate?: string;
  endDate?: string;
};

export type CandidateCtcInfo = {
  lacs?: string;
  thousands?: string | null;
  currency?: string;
};

export type CandidateExperienceInfo = {
  years?: number;
  months?: number;
};

export type CandidateStructuredFields = {
  jsUserName?: string;
  jobTitle?: string;
  keySkills?: string;
  focusedSkills?: string;
  interestedSkills?: string;
  education?: {
    ug?: CandidateEducationDetail | null;
    pg?: CandidateEducationDetail | null;
    ppg?: CandidateEducationDetail | null;
  };
  employment?: {
    current?: CandidateEmploymentRecord | null;
    previous?: CandidateEmploymentRecord | null;
  };
  ctcInfo?: CandidateCtcInfo | null;
  experience?: CandidateExperienceInfo | null;
  currentLocation?: string;
  preferredLocations?: string;
  salaryDisclosed?: boolean;
  immediateAvailabilty?: boolean;
  avgResponseTime?: string | null;
  noticePeriod?: number | null;
  modifyDateLabel?: string;
  activeDateLabel?: string;
};

export type CandidateProfile = {
  candidateId?: string;
  name?: string;
  currentTitle?: string;
  currentCompany?: string;
  currentLocation?: string;
  preferredLocation?: string;
  totalExperienceYears?: number;
  currentCompensation?: string;
  expectedCompensation?: string;
  education?: string[];
  skills?: string[];
  certifications?: string[];
  languages?: string[];
  achievements?: string[];
  notes?: string;
  structuredFields?: CandidateStructuredFields;
};

export type SearchExpectation = {
  jobTitle?: string;
  company?: string;
  location?: string;
  salary?: string;
  experience?: string;
  education?: string;
  skills?: string;
  certifications?: string;
  languages?: string;
  shortlistingCriteria?: string;
};

export type InformationGapItem = {
  field: string;
  whyItMatters: string;
  recommendedSources: string[];
};

export type InformationCollectionPlan = {
  summary: string;
  missingInformation: InformationGapItem[];
};

export type SearchStrategy = {
  name: string;
  description: string;
  triggers: string[];
  riskLevel: 'low' | 'medium' | 'high';
  steps: string[];
  targetPoolSize: string;
};

export type SearchStrategyPlan = {
  strategies: SearchStrategy[];
  recommendedNextActions: string[];
};

export type StrategyRubricEntry = {
  field: string;
  value: string;
  guidance: string;
  status: 'aligned' | 'partial' | 'misaligned' | 'missing';
  rationale: string;
};

export type StrategyRubricEvaluation = {
  strategyName: string;
  fitSummary: string;
  rubric: StrategyRubricEntry[];
  recommendedAction: string;
  riskNotes: string;
};

export type QueryFilter = {
  field: string;
  include: string[];
  exclude?: string[];
  rationale: string;
};

export type QueryVariant = {
  label: string;
  query: string;
  rationale: string;
};

export type EnrichmentInstruction = {
  label: string;
  description: string;
};

export type SearchQueryPlan = {
  searchQueries: QueryVariant[];
  enrichments: EnrichmentInstruction[];
  filters: QueryFilter[];
};

export type CandidateShortlistDecision = {
  isShortlisted: boolean;
  score: number;
  summary: string;
  satisfiedCriteria: string[];
  unmetCriteria: {
    criterion: string;
    reason: string;
  }[];
  finalRecommendation: string;
};

export type CandidateShortlistWorkflowResult = {
  naturalLanguageQuery: string;
  candidate: CandidateProfile;
  expectations?: SearchExpectation;
  informationPlan: InformationCollectionPlan;
  searchStrategyPlan: SearchStrategyPlan;
  strategyRubricEvaluations: StrategyRubricEvaluation[];
  queryPlan: SearchQueryPlan;
  decision: CandidateShortlistDecision;
};

export type StrategyRubricWorkflowResult = {
  naturalLanguageQuery: string;
  candidate: CandidateProfile;
  informationPlan: InformationCollectionPlan;
  searchStrategyPlan: SearchStrategyPlan;
  strategyRubricEvaluations: StrategyRubricEvaluation[];
};


