import { collectPeopleNeedingEnrollment } from '@/outreach-home/utils/resolve-enrolled-candidate-ids.util';
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

describe('collectPeopleNeedingEnrollment', () => {
  it('keeps only rows without a candidateId', () => {
    const needing = collectPeopleNeedingEnrollment([
      person({ id: '1', name: 'A', candidateId: 'c1' }),
      person({ id: '2', name: 'B' }),
      person({ id: '3', name: 'C', candidateId: undefined }),
    ]);

    expect(needing.map((row) => row.id)).toEqual(['2', '3']);
  });
});
