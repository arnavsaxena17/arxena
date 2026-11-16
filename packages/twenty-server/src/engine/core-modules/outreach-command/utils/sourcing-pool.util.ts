// The People tab is the candidate pool (no second store). A row carries where
// it is in the run, why it left, and where each field came from, under
// otherFields so every existing reader and the S3 backup keep working. The
// top-level `stage` is the outreach pipeline stage and is not this.

export const SOURCING_STAGE_KEY = 'sourcingStage';
export const SOURCING_REJECTED_BY_KEY = 'sourcingRejectedBy';
export const SOURCING_PROVENANCE_KEY = 'sourcingProvenance';

// discovered: a search row. triaged: passed the deterministic triage.
// full: the full profile is on the row. enriched: web or column data added.
// verified: the judge settled every flag. rejected: left the run, kept with
// its reason and hidden by default.
export const SOURCING_STAGES = [
  'discovered',
  'triaged',
  'full',
  'enriched',
  'verified',
  'rejected',
] as const;

export type SourcingStage = (typeof SOURCING_STAGES)[number];

export type SourcingRejection = {
  by: 'judge' | 'triage' | 'exclusion' | 'user';
  // The flags or constraints that rejected the row
  flags: string[];
  evidence?: string;
  at: string;
};

export type SourcingFieldProvenance = {
  source: string;
  fetchedAt: string;
  level: 'snapshot' | 'full';
};

export type SourcingProvenance = Record<string, SourcingFieldProvenance>;

const STAGE_RANK: Record<Exclude<SourcingStage, 'rejected'>, number> = {
  discovered: 0,
  triaged: 1,
  full: 2,
  enriched: 3,
  verified: 4,
};

export const isSourcingStage = (value: unknown): value is SourcingStage =>
  (SOURCING_STAGES as readonly unknown[]).includes(value);

export const readSourcingStage = (
  otherFields: Record<string, unknown> | undefined,
): SourcingStage | undefined => {
  const value = otherFields?.[SOURCING_STAGE_KEY];

  return isSourcingStage(value) ? value : undefined;
};

export const isRejectedRow = (row: {
  otherFields?: Record<string, unknown>;
}): boolean => readSourcingStage(row.otherFields) === 'rejected';

// A stage only moves forward, so a later search that finds the same person as
// a snapshot does not undo a full profile. Rejected is final for the run; a
// person puts it back by editing the row, which writes a stage explicitly
// through replace, not merge.
export const mergeSourcingStage = (
  previous: unknown,
  incoming: unknown,
): SourcingStage | undefined => {
  const before = isSourcingStage(previous) ? previous : undefined;
  const after = isSourcingStage(incoming) ? incoming : undefined;

  if (before === 'rejected' || after === 'rejected') {
    return 'rejected';
  }

  if (before === undefined || after === undefined) {
    return after ?? before;
  }

  return STAGE_RANK[after] >= STAGE_RANK[before] ? after : before;
};

const asProvenance = (value: unknown): SourcingProvenance =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as SourcingProvenance)
    : {};

// Per field: the newer write wins for that field, other fields keep theirs
export const mergeSourcingProvenance = (
  previous: unknown,
  incoming: unknown,
): SourcingProvenance | undefined => {
  const merged = { ...asProvenance(previous), ...asProvenance(incoming) };

  return Object.keys(merged).length > 0 ? merged : undefined;
};

// Applied by mergeOutreachOtherFields to the pool keys only
export const mergeSourcingPoolFields = (
  previous: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> => {
  const fields: Record<string, unknown> = {};
  const stage = mergeSourcingStage(
    previous[SOURCING_STAGE_KEY],
    incoming[SOURCING_STAGE_KEY],
  );
  const provenance = mergeSourcingProvenance(
    previous[SOURCING_PROVENANCE_KEY],
    incoming[SOURCING_PROVENANCE_KEY],
  );

  if (stage !== undefined) {
    fields[SOURCING_STAGE_KEY] = stage;
  }

  if (provenance !== undefined) {
    fields[SOURCING_PROVENANCE_KEY] = provenance;
  }

  // The first rejection explains the row; a later one would hide the cause
  const rejection =
    previous[SOURCING_REJECTED_BY_KEY] ?? incoming[SOURCING_REJECTED_BY_KEY];

  if (rejection !== undefined && stage === 'rejected') {
    fields[SOURCING_REJECTED_BY_KEY] = rejection;
  }

  return fields;
};

export const buildSourcingProvenance = (
  fieldNames: string[],
  provenance: SourcingFieldProvenance,
): SourcingProvenance =>
  Object.fromEntries(fieldNames.map((fieldName) => [fieldName, provenance]));

export type SourcingStageCounts = Record<SourcingStage, number> & {
  unstaged: number;
};

export const countSourcingStages = (
  rows: Array<{ otherFields?: Record<string, unknown> }>,
): SourcingStageCounts => {
  const counts = {
    ...(Object.fromEntries(
      SOURCING_STAGES.map((stage) => [stage, 0]),
    ) as Record<SourcingStage, number>),
    unstaged: 0,
  };

  for (const row of rows) {
    const stage = readSourcingStage(row.otherFields);

    counts[stage ?? 'unstaged'] += 1;
  }

  return counts;
};
