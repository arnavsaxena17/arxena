import {
  normalizeSenderProfileDraft,
  parseSenderProfileDraft,
  stringifySenderProfileDraft,
  writeSenderDraftBrief,
  writeSenderDraftChipList,
} from '@/outreach-home/utils/outreach-sender-profile-draft.util';

describe('outreach-sender-profile-draft.util', () => {
  it('parses slim drafts', () => {
    const draft = stringifySenderProfileDraft({
      targetTitles: ['CFO'],
      locations: ['India'],
      brief: 'Hello',
    });

    expect(parseSenderProfileDraft(draft)).toEqual({
      targetTitles: ['CFO'],
      locations: ['India'],
      brief: 'Hello',
    });
    expect(parseSenderProfileDraft('[]')).toBeNull();
  });

  it('writes chips and brief', () => {
    const base = stringifySenderProfileDraft({
      targetTitles: [],
      locations: [],
      brief: '',
    });
    const next = writeSenderDraftBrief(
      writeSenderDraftChipList(base, 'targetTitles', ['VP Sales']),
      'Pitch text',
    );

    expect(normalizeSenderProfileDraft(JSON.parse(next))).toEqual({
      targetTitles: ['VP Sales'],
      locations: [],
      brief: 'Pitch text',
    });
  });
});
