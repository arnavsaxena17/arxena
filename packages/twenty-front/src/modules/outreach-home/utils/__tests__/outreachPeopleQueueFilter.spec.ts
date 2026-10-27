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
  it('should keep All as the full tab', () => {
    expect(
      matchesOutreachPeopleQueueFilter(
        person({ id: '2', name: 'B', stage: 'QUEUED' }),
        'all',
      ),
    ).toBe(true);
  });

  it('should match enrolled Candidate rows only', () => {
    expect(
      matchesOutreachPeopleQueueFilter(
        person({
          id: '1',
          name: 'A',
          candidateId: 'c1',
          stage: 'EMAIL_ENRICHING',
        }),
        'enrolled',
      ),
    ).toBe(true);
    expect(
      matchesOutreachPeopleQueueFilter(
        person({ id: '2', name: 'B', stage: 'QUEUED' }),
        'enrolled',
      ),
    ).toBe(false);
  });
});

describe('resolveOutreachPeopleQueueRows', () => {
  it('should sort enrolled CRM rows above Redis discovery on All', () => {
    const rows = [
      person({ id: '1', name: 'Discovery', stage: 'QUEUED' }),
      person({
        id: '2',
        name: 'Enrolled',
        candidateId: 'c1',
        stage: 'EMAIL_ENRICHING',
      }),
    ];

    expect(resolveOutreachPeopleQueueRows(rows, 'all').map((row) => row.name)).toEqual([
      'Enrolled',
      'Discovery',
    ]);
  });

  it('should return only enrolled rows for Enrolled filter', () => {
    const rows = [
      person({ id: '1', name: 'Discovery', stage: 'QUEUED' }),
      person({
        id: '2',
        name: 'Enrolled',
        candidateId: 'c1',
        stage: 'EMAIL_ENRICHING',
      }),
    ];

    expect(resolveOutreachPeopleQueueRows(rows, 'enrolled')).toEqual([rows[1]]);
  });
});
