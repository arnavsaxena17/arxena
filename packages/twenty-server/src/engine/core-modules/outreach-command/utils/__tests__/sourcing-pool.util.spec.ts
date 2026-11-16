import { mergeOutreachOtherFields } from 'src/engine/core-modules/outreach-command/utils/merge-outreach-other-fields.util';
import {
  countSourcingStages,
  isRejectedRow,
  mergeSourcingStage,
  SOURCING_PROVENANCE_KEY,
  SOURCING_REJECTED_BY_KEY,
  SOURCING_STAGE_KEY,
} from 'src/engine/core-modules/outreach-command/utils/sourcing-pool.util';

const snapshot = {
  source: 'bright-data',
  fetchedAt: '2026-11-16T00:00:00.000Z',
  level: 'snapshot' as const,
};
const full = { ...snapshot, source: 'harvest', level: 'full' as const };

describe('sourcing pool fields', () => {
  it('should only move a stage forward, and keep rejected', () => {
    expect(mergeSourcingStage('full', 'discovered')).toBe('full');
    expect(mergeSourcingStage('discovered', 'verified')).toBe('verified');
    expect(mergeSourcingStage('rejected', 'verified')).toBe('rejected');
    expect(mergeSourcingStage(undefined, 'triaged')).toBe('triaged');
    expect(mergeSourcingStage('nonsense', undefined)).toBeUndefined();
  });

  it('should not let a later snapshot undo a full profile on merge', () => {
    const merged = mergeOutreachOtherFields(
      {
        [SOURCING_STAGE_KEY]: 'full',
        [SOURCING_PROVENANCE_KEY]: { title: full, location: full },
      },
      {
        [SOURCING_STAGE_KEY]: 'discovered',
        [SOURCING_PROVENANCE_KEY]: { title: snapshot },
        headline: 'CFO',
      },
    );

    expect(merged).toEqual({
      [SOURCING_STAGE_KEY]: 'full',
      [SOURCING_PROVENANCE_KEY]: { title: snapshot, location: full },
      headline: 'CFO',
    });
  });

  it('should keep the first rejection reason', () => {
    const first = { by: 'judge', flags: ['red_1_company'], at: 'a' };
    const merged = mergeOutreachOtherFields(
      { [SOURCING_STAGE_KEY]: 'rejected', [SOURCING_REJECTED_BY_KEY]: first },
      {
        [SOURCING_STAGE_KEY]: 'rejected',
        [SOURCING_REJECTED_BY_KEY]: { by: 'triage', flags: [], at: 'b' },
      },
    );

    expect(merged?.[SOURCING_REJECTED_BY_KEY]).toEqual(first);
  });

  it('should leave rows without pool fields as they were', () => {
    expect(mergeOutreachOtherFields({ a: 1 }, { b: 2 })).toEqual({
      a: 1,
      b: 2,
    });
  });

  it('should count stages and spot rejected rows', () => {
    const rows = [
      { otherFields: { [SOURCING_STAGE_KEY]: 'rejected' } },
      { otherFields: { [SOURCING_STAGE_KEY]: 'verified' } },
      { otherFields: {} },
    ];

    expect(isRejectedRow(rows[0])).toBe(true);
    expect(countSourcingStages(rows)).toEqual(
      expect.objectContaining({ rejected: 1, verified: 1, unstaged: 1 }),
    );
  });
});
