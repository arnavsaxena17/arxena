// Company-level dedupe for the QUEUED branch of the Candidate Sequencer.
//
// Replaces the FIND/IF/UPDATE chain that used to sit in the graph: "has anyone
// at this company already been worked, or is there an earlier QUEUED sibling?".
// Kept as a pure function so the decision is unit-testable without a database,
// and so the inline-JS prototype in tmp/agent-runs/company-dedupe can be diffed
// against the same fixtures.
//
// Semantics deliberately mirror the old graph, with one fix: the old FIND
// filtered `candidate` by the person's jobCompanyName field metadata id, which
// the candidate object does not have, so the company clause never applied and
// the check degraded to "anyone in this project". Matching is now an explicit
// normalized company key.
import { isNonEmptyString } from '@sniptt/guards';

// Stages that mean this sibling candidate has actually been worked. Everything
// that is still waiting, parked or dead is excluded: QUEUED is handled by the
// earlier-sibling rule, and DEFERRED/STOPPED were never a real approach.
export const OUTREACH_CONTACTED_COMPANY_STAGES = [
  'CONNECTION_SENT',
  'CONNECTION_ACCEPTED',
  'CONNECTION_IGNORED',
  'PROFILE_CHECKED',
  'WARM_PATH',
  'COMMENTED',
  'EMAIL_ENRICHING',
  'EMAIL_SENT',
  'INMAIL_SENT',
  'WHATSAPP_SENT',
  'REPLIED',
  'WAITING_REPLY',
  'NEGOTIATING',
  'MEETING_BOOKED',
  'FAILED_ENRICH',
  'FAILED_NO_REPLY',
] as const;

const CONTACTED_STAGE_SET: ReadonlySet<string> = new Set(
  OUTREACH_CONTACTED_COMPANY_STAGES,
);

export type CompanyDedupeReason =
  | 'no-company'
  | 'company-contacted'
  | 'earlier-queued-sibling'
  | 'clear';

export type CompanyDedupeSibling = {
  candidateId: string;
  companyName: string | null;
  stage: string | null;
  createdAt: string | null;
};

export type CompanyDedupeDecision = {
  deferred: boolean;
  reason: CompanyDedupeReason;
  matchedCandidateId: string;
  companyKey: string;
  consideredSiblings: number;
};

// Legal-form and filler tokens that differ between two spellings of the same
// employer. Only trailing tokens are dropped, so "Corporate Broking" survives.
const LEGAL_SUFFIXES: ReadonlySet<string> = new Set([
  'ab',
  'ag',
  'as',
  'bv',
  'co',
  'company',
  'corp',
  'corporation',
  'gmbh',
  'inc',
  'incorporated',
  'kk',
  'kft',
  'lda',
  'limited',
  'llc',
  'llp',
  'ltd',
  'nv',
  'oy',
  'plc',
  'pte',
  'pvt',
  'private',
  'sa',
  'sas',
  'spa',
  'srl',
]);

const COMPANY_KEY_TOKEN_PATTERN = /[^a-z0-9]+/;

export const normalizeCompanyKey = (value?: string | null): string => {
  if (!isNonEmptyString(value)) {
    return '';
  }

  const tokens = value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .split(COMPANY_KEY_TOKEN_PATTERN)
    .filter(isNonEmptyString);

  while (tokens.length > 0 && LEGAL_SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  return tokens.join(' ');
};

const isContactedStage = (stage?: string | null): boolean =>
  isNonEmptyString(stage) && CONTACTED_STAGE_SET.has(stage);

const isEarlierThan = ({
  value,
  reference,
}: {
  value: string | null;
  reference: string | null;
}): boolean => {
  if (!isNonEmptyString(value) || !isNonEmptyString(reference)) {
    return false;
  }

  const valueTime = Date.parse(value);
  const referenceTime = Date.parse(reference);

  if (Number.isNaN(valueTime) || Number.isNaN(referenceTime)) {
    return false;
  }

  return valueTime < referenceTime;
};

export const decideCompanyDedupe = ({
  selfCandidateId,
  companyName,
  selfCreatedAt,
  siblings,
}: {
  selfCandidateId: string;
  companyName: string | null;
  selfCreatedAt: string | null;
  siblings: CompanyDedupeSibling[];
}): CompanyDedupeDecision => {
  const companyKey = normalizeCompanyKey(companyName);

  const base = {
    companyKey,
    matchedCandidateId: '',
    consideredSiblings: siblings.length,
  };

  // A prospect with no employer cannot be deduped per company; the old graph
  // had a whole parallel thread to bypass the check in this case.
  if (!isNonEmptyString(companyKey)) {
    return { ...base, deferred: false, reason: 'no-company' };
  }

  const others = siblings.filter(
    (sibling) =>
      sibling.candidateId !== selfCandidateId &&
      normalizeCompanyKey(sibling.companyName) === companyKey,
  );

  const contactedSibling = others.find((sibling) =>
    isContactedStage(sibling.stage),
  );

  if (isNonEmptyString(contactedSibling?.candidateId)) {
    return {
      ...base,
      deferred: true,
      reason: 'company-contacted',
      matchedCandidateId: contactedSibling.candidateId,
    };
  }

  const earlierQueuedSibling = others.find(
    (sibling) =>
      sibling.stage === 'QUEUED' &&
      isEarlierThan({ value: sibling.createdAt, reference: selfCreatedAt }),
  );

  if (isNonEmptyString(earlierQueuedSibling?.candidateId)) {
    return {
      ...base,
      deferred: true,
      reason: 'earlier-queued-sibling',
      matchedCandidateId: earlierQueuedSibling.candidateId,
    };
  }

  return { ...base, deferred: false, reason: 'clear' };
};
