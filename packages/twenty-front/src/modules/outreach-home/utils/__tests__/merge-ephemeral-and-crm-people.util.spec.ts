import {
  mergeEphemeralAndCrmPeople,
  normalizeOutreachPersonLinkedinKey,
} from '@/outreach-home/utils/merge-ephemeral-and-crm-people.util';
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

describe('normalizeOutreachPersonLinkedinKey', () => {
  it('should collapse country and www hosts to the same profile slug', () => {
    expect(
      normalizeOutreachPersonLinkedinKey(
        'https://in.linkedin.com/in/gautam-jatia-966344aa',
      ),
    ).toBe('in/gautam-jatia-966344aa');
    expect(
      normalizeOutreachPersonLinkedinKey(
        'https://www.linkedin.com/in/gautam-jatia-966344aa/',
      ),
    ).toBe('in/gautam-jatia-966344aa');
  });
});

describe('mergeEphemeralAndCrmPeople', () => {
  it('should prefer Candidate.outreachSequenceStage over Redis queued', () => {
    const ephemeral = person({
      id: 'redis-1',
      name: 'Gautam Jatia',
      linkedinUrl: 'https://www.linkedin.com/in/gautam-jatia-966344aa/',
      stage: 'QUEUED',
    });
    const crm = person({
      id: 'person-crm',
      candidateId: 'cand-1',
      name: 'Gautam Jatia',
      linkedinUrl: 'https://in.linkedin.com/in/gautam-jatia-966344aa',
      stage: 'CONNECTION_ACCEPTED',
    });

    const merged = mergeEphemeralAndCrmPeople([ephemeral], [crm]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.stage).toBe('CONNECTION_ACCEPTED');
    expect(merged[0]?.candidateId).toBe('cand-1');
  });
});
