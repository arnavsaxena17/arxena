import { type RowProfile } from 'src/engine/core-modules/candidate-sourcing/services/profile-fetch/profile-row-fields.util';
import { type PersonJudgement } from 'src/engine/core-modules/bright-data/services/bright-data-person-fit-filter.service';
import { type FindPeopleByCompanyInput } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-by-company-tool.schema';
import { type DeprioritisationReason } from 'src/engine/core-modules/outreach-command/utils/outreach-people-deprioritisation.util';
import {
  type FindPeopleNoneFoundReason,
  type FindPeopleRung,
  type FindPeopleTerminalState,
} from 'src/engine/core-modules/outreach-command/utils/outreach-people-found.util';
import {
  type SourcingConfidence,
  type SourcingCoverage,
} from 'src/engine/core-modules/outreach-command/utils/sourcing-ledger.util';
import { type PersonFreshness } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-confidence.util';

// The input is capped at 25 companies, so the default runs them all at once
export type FindPeopleByCompanyTarget = NonNullable<
  FindPeopleByCompanyInput['companies']
>[number] & {
  // Set from the Companies tab when the import could not identify the row
  unresolvable?: boolean;
};
// The input once the companies are known, whether given or read from the project
export type ResolvedInput = Omit<FindPeopleByCompanyInput, 'companies'> & {
  companies: FindPeopleByCompanyTarget[];
  // The run's plan, from the latest brief, with input overrides applied
  plan: FindPeoplePlan;
};

export type FindPeoplePlan = {
  maxRung: FindPeopleRung;
  minConfidence: SourcingConfidence;
  freshnessDays: number;
  // Spend cap for one company x role pair, across every source
  perPairUsd: number;
  // Total cap for the run; an exhaustive run cannot start without one
  runCapUsd?: number;
  coverage: SourcingCoverage;
  // Set by the ledger when the run cap was written; scopes the spend counter
  budgetRunId?: string;
  confidential: boolean;
  // Person criteria the user stated, judged from the profile or the evidence
  criteria: string[];
};

// One piece of evidence behind a person, so any row can be audited
export type FindPeopleEvidence = {
  source: string;
  query: string;
  retrievedAt: string;
  snippet: string;
  url?: string;
};

// web = a person named in a page Google returned, then looked up on LinkedIn
export type Source = 'bright_data' | 'google' | 'web' | 'harvest';

// A role the person matches, with the rung score that made the match. One
// person can hold more than one requested role ("MD" and "CEO"), so this is a
// list, not a single value.
export type RoleMatch = { role: string; score: 1 | 2 };

export type Candidate = {
  id: string;
  name: string;
  title: string;
  companyName: string;
  linkedinUrl: string;
  // Free text the company can be checked against when there is no company field
  evidenceText: string;
  source: Source;
  // The site behind a SERP-side source when it was not Google itself (TheOrg,
  // The Official Board), so the row's evidence can name where it was listed
  provider?: 'theorg' | 'officialboard';
  // True when the URL was recovered from a post by this person
  linkedinUrlDerivedFromPost?: boolean;
  location?: string;
  // The query that returned this person, so a per-role fan-out keeps its
  // evidence attributable to the role it was run for
  query?: string;
  // The role whose query returned this person
  queriedRole?: string;
  // The full provider record, so the fake-profile screen can read education
  // and experience
  rawProfile?: Record<string, unknown>;
};

export type VerifiedCandidate = Candidate & {
  sources: Source[];
  roleScore: 1 | 2;
  roleMatches?: RoleMatch[];
  verdict?: PersonJudgement;
};

export type RejectedCandidate = {
  name: string;
  title: string;
  companyOnProfile: string;
  reason: 'company_mismatch' | 'role_mismatch' | 'criteria_mismatch';
  // The judge's reason, when it ruled
  note?: string;
};

// One company x role pair. A company with four roles has four of these, so a
// CEO found is not reported as coverage for the head of manufacturing.
export type FindPeopleRoleState = {
  role: string;
  terminalState: FindPeopleTerminalState;
  reason?: FindPeopleNoneFoundReason | string;
  rungUsed?: FindPeopleRung;
  personKeys: string[];
  sourcesUsed: Array<Source | 'cache'>;
  peopleCount: number;
};

export type CompanyOutcome = {
  company: string;
  // Companies-tab row id the lookup was asked for, when the caller gave one
  companyRowId?: string;
  status: 'matched' | 'related_role_only' | 'no_match' | 'source_error';
  people: Array<{
    name: string;
    title: string;
    companyOnProfile: string;
    linkedinUrl: string;
    sources: Source[];
    roleMatch: 'exact' | 'related';
    // Every requested role this person satisfies
    roleMatches?: RoleMatch[];
    // related = works at a parent, operator or brand linked to the company asked about
    companyRelation?: 'related';
    note?: string;
    linkedinUrlDerivedFromPost?: boolean;
    deprioritisedReasons: DeprioritisationReason[];
    // The full profile, when the source returned one: stored on the row so the
    // profile fetch skips this person
    profile?: RowProfile;
    // Raw Bright Data person document — same fields written as fetch_profiles
    rawProfile?: Record<string, unknown>;
    rungUsed: FindPeopleRung;
    confidence: SourcingConfidence;
    freshness: PersonFreshness;
    // A stated criterion the profile did not settle (kept, not rejected)
    criteriaUnknown?: boolean;
    criteria?: Array<{
      criterion: string;
      verdict: 'match' | 'unknown' | 'mismatch';
    }>;
    evidence: FindPeopleEvidence[];
  }>;
  rejected: RejectedCandidate[];
  sourceErrors: string[];
  spentUsd: number;
  // The pair's final state, from the people kept against the plan
  terminalState: FindPeopleTerminalState;
  reason?: FindPeopleNoneFoundReason | string;
  rungUsed?: FindPeopleRung;
  // Sources that put a kept person on the row; cache when the answer was
  // reused. Empty when the pair found nobody.
  sourcesUsed: Array<Source | 'cache'>;
  // Sources whose step ran, in cascade order, whether or not it returned
  // anyone: what the pair cost, not what it got
  sourcesAttempted: Array<Source | 'cache'>;
  titlesTried: string[];
  // One state per requested role, in the order the user gave them
  roleStates?: FindPeopleRoleState[];
};
