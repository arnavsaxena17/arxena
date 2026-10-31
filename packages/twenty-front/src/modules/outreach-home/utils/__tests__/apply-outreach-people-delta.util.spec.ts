import { type OutreachPersonRow } from '@/outreach-home/types/outreach-home.types';
import { applyOutreachPeopleDelta } from '@/outreach-home/utils/apply-outreach-people-delta.util';

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

describe('applyOutreachPeopleDelta', () => {
  it('should add the rows a write named, in arrival order', () => {
    const previous = [person({ id: 'a', name: 'Anita Rao' })];

    const next = applyOutreachPeopleDelta(previous, [
      person({ id: 'b', name: 'Bilal Khan' }),
      person({ id: 'c', name: 'Chen Wei' }),
    ]);

    expect(next.map((row) => row.id)).toEqual(['a', 'b', 'c']);
  });

  it('should update a row in place instead of moving it down the table', () => {
    const previous = [
      person({ id: 'a', name: 'Anita Rao' }),
      person({ id: 'b', name: 'Bilal Khan', title: '' }),
      person({ id: 'c', name: 'Chen Wei' }),
    ];

    const next = applyOutreachPeopleDelta(previous, [
      person({ id: 'b', name: 'Bilal Khan', title: 'Head of Growth' }),
    ]);

    expect(next.map((row) => row.id)).toEqual(['a', 'b', 'c']);
    expect(next[1]?.title).toBe('Head of Growth');
  });

  it('should drop the row it held when the written row carries the id the merge kept', () => {
    // The server folded a second profile URL of the same person into one row
    const previous = [
      person({
        id: 'provisional',
        name: 'Gautam Jatia',
        linkedinUrl: 'https://www.linkedin.com/in/gautam-jatia-966344aa/',
      }),
    ];

    const next = applyOutreachPeopleDelta(previous, [
      person({
        id: 'canonical',
        name: 'Gautam Jatia',
        linkedinUrl: 'https://in.linkedin.com/in/gautam-jatia-966344aa',
        title: 'Managing Director',
      }),
    ]);

    expect(next).toHaveLength(1);
    expect(next[0]?.id).toBe('canonical');
  });

  it('should drop a second row for the same name at the same company', () => {
    // One of the two rows has no profile URL to tell them apart by, which is
    // the case the server merges on a one-letter spelling slip
    const previous = [
      person({ id: 'a', name: 'Gautam Jatia', companyName: 'Jatia Group' }),
    ];

    const next = applyOutreachPeopleDelta(previous, [
      person({ id: 'b', name: 'Gautam  Jatia', companyName: 'jatia group ' }),
    ]);

    expect(next).toHaveLength(1);
    expect(next[0]?.id).toBe('b');
  });

  it('should keep two people who share a name at different companies', () => {
    const previous = [
      person({ id: 'a', name: 'Anita Rao', companyName: 'Acme' }),
    ];

    const next = applyOutreachPeopleDelta(previous, [
      person({ id: 'b', name: 'Anita Rao', companyName: 'Globex' }),
    ]);

    expect(next.map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('should collapse two rows that ended up under the same id', () => {
    const previous = [
      person({ id: 'a', name: 'Anita Rao' }),
      person({
        id: 'a',
        name: 'Anita Rao',
        linkedinUrl: 'https://www.linkedin.com/in/anita-rao',
      }),
    ];

    const next = applyOutreachPeopleDelta(previous, [
      person({ id: 'b', name: 'Bilal Khan' }),
    ]);

    expect(next.map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('should keep the same list when a write named no rows', () => {
    const previous = [person({ id: 'a', name: 'Anita Rao' })];

    expect(applyOutreachPeopleDelta(previous, [])).toBe(previous);
  });

  it('should put a new row above the demoted block, not under it', () => {
    const previous = [
      person({ id: 'a', name: 'Anita Rao' }),
      person({
        id: 'z',
        name: 'Zara Ali',
        otherFields: { deprioritised: true },
      }),
    ];

    const next = applyOutreachPeopleDelta(previous, [
      person({ id: 'm', name: 'Mohan Das' }),
    ]);

    expect(next.map((row) => row.id)).toEqual(['a', 'm', 'z']);
  });

  it('should move a row that becomes demoted below the rest', () => {
    const previous = [
      person({ id: 'a', name: 'Anita Rao' }),
      person({ id: 'b', name: 'Bilal Khan' }),
    ];

    const next = applyOutreachPeopleDelta(previous, [
      person({
        id: 'a',
        name: 'Anita Rao',
        otherFields: { deprioritised: true },
      }),
    ]);

    expect(next.map((row) => row.id)).toEqual(['b', 'a']);
  });

  it('should put a new demoted row at the bottom', () => {
    const previous = [person({ id: 'a', name: 'Anita Rao' })];

    const next = applyOutreachPeopleDelta(previous, [
      person({
        id: 'z',
        name: 'Zara Ali',
        otherFields: { deprioritised: true },
      }),
    ]);

    expect(next.map((row) => row.id)).toEqual(['a', 'z']);
  });
});
