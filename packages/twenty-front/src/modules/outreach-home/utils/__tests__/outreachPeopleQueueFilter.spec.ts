import {
  matchesOutreachPeopleQueueFilter,
  resolveOutreachPeopleQueueRows,
} from '@/outreach-home/utils/outreachPeopleQueueFilter';
import { type OutreachPersonRow } from '@/outreach-home/types/outreach-home.types';

const person = (
  partial: Partial<OutreachPersonRow> & Pick<OutreachPersonRow, 'id' | 'name'>,
): OutreachPersonRow => ({
  title: '',
  companyId: '',
  companyName: '',
  linkedinUrl: '',
  warmPath: '—',
  stage: 'QUEUED',
  email: '',
  ...partial,
});

describe('matchesOutreachPeopleQueueFilter', () => {
  it('should treat All as enrolled Candidate rows only', () => {
    expect(
      matchesOutreachPeopleQueueFilter(
        person({
          id: '1',
          name: 'A',
          candidateId: 'c1',
          stage: 'EMAIL_ENRICHING',
        }),
        'all',
      ),
    ).toBe(true);
    expect(
      matchesOutreachPeopleQueueFilter(
        person({ id: '2', name: 'B', stage: 'QUEUED' }),
        'all',
      ),
    ).toBe(false);
  });

  it('should match not_enrolled Redis discovery rows', () => {
    expect(
      matchesOutreachPeopleQueueFilter(
        person({ id: '2', name: 'B', stage: 'QUEUED' }),
        'not_enrolled',
      ),
    ).toBe(true);
  });
});

describe('resolveOutreachPeopleQueueRows', () => {
  it('should fall back to discovery when nothing is enrolled yet', () => {
    const discovery = [person({ id: '1', name: 'A', stage: 'QUEUED' })];

    expect(resolveOutreachPeopleQueueRows(discovery, 'all')).toEqual(discovery);
  });

  it('should return enrolled rows for All when Candidates exist', () => {
    const rows = [
      person({ id: '1', name: 'A', stage: 'QUEUED' }),
      person({
        id: '2',
        name: 'B',
        candidateId: 'c1',
        stage: 'EMAIL_ENRICHING',
      }),
    ];

    expect(resolveOutreachPeopleQueueRows(rows, 'all')).toEqual([rows[1]]);
  });
});
