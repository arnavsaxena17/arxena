import { DataProcessingUtils } from 'src/engine/core-modules/candidate-sourcing/utils/data-processing.utils';
import {
  collectLinkedinIdentityKeysFromProfile,
  collectLinkedinIdentityLookupKeys,
  CandidateUploadLookup,
  deduplicateProfilesForUpload,
  findExistingCandidateForUpload,
  findExistingPersonByLinkedinIdentity,
  getUploadProfileDedupMapKey,
  indexLinkedinIdentitiesIntoMap,
} from 'src/engine/core-modules/candidate-sourcing/utils/upload-profile-dedup.utils';

describe('upload-profile LinkedIn identity dedup', () => {
  const dataProcessingUtils = new DataProcessingUtils();

  const emptyLookup = (): CandidateUploadLookup => ({
    byUniqueStringKey: new Map(),
    byEmail: new Map(),
    byPhone: new Map(),
    byLinkedinUrl: new Map(),
    byHiringNaukriUrl: new Map(),
    byResdexNaukriUrl: new Map(),
  });

  it('extracts the same identity from url, slug, and profile id', () => {
    expect(
      collectLinkedinIdentityKeysFromProfile({
        linkedinUrl: 'https://www.linkedin.com/in/Jane-Doe/',
      }),
    ).toContain('jane-doe');
    expect(
      collectLinkedinIdentityKeysFromProfile({
        linkedinProfileId: 'Jane-Doe',
      }),
    ).toContain('jane-doe');
    expect(
      collectLinkedinIdentityKeysFromProfile({
        profileUrl: 'https://linkedin.com/in/jane-doe',
      }),
    ).toContain('jane-doe');
  });

  it('uses a LinkedIn identity key so url and slug collapse in-batch', () => {
    const byUrl = getUploadProfileDedupMapKey(
      { linkedinUrl: 'https://www.linkedin.com/in/jane-doe/' },
      dataProcessingUtils,
    );
    const bySlug = getUploadProfileDedupMapKey(
      { linkedinProfileId: 'jane-doe' },
      dataProcessingUtils,
    );

    expect(byUrl).toBe('url:linkedin:jane-doe');
    expect(bySlug).toBe('url:linkedin:jane-doe');
  });

  it('deduplicates mixed LinkedIn url and slug rows in one upload', () => {
    const deduped = deduplicateProfilesForUpload(
      [
        { uniqueStringKey: 'one', linkedinUrl: 'https://linkedin.com/in/jane-doe' },
        { uniqueStringKey: 'two', linkedinProfileId: 'jane-doe' },
      ],
      dataProcessingUtils,
    );

    expect(deduped).toHaveLength(1);
    expect(deduped[0].uniqueStringKey).toBe('two');
  });

  it('treats a matching LinkedIn slug as an existing candidate, not a new profile', () => {
    const existing = { id: 'cand-1', peopleId: 'person-1' };
    const lookup = emptyLookup();
    indexLinkedinIdentitiesIntoMap(lookup.byLinkedinUrl, existing, {
      linkedinLink: {
        primaryLinkUrl: 'https://www.linkedin.com/in/jane-doe/',
      },
    });

    const found = findExistingCandidateForUpload(
      lookup,
      { linkedinProfileId: 'jane-doe' },
      dataProcessingUtils,
    );

    expect(found).toEqual(existing);
  });

  it('matches people by LinkedIn lookup keys regardless of url vs slug', () => {
    const person = {
      id: 'person-1',
      linkedinLink: {
        primaryLinkUrl: 'https://www.linkedin.com/in/jane-doe/',
        primaryLinkLabel: 'jane-doe',
      },
    };
    const byLinkedin = new Map<string, typeof person>();
    for (const key of collectLinkedinIdentityLookupKeys(person)) {
      byLinkedin.set(key, person);
    }

    expect(
      findExistingPersonByLinkedinIdentity(
        { linkedinUrl: 'https://linkedin.com/in/jane-doe' },
        byLinkedin,
      )?.id,
    ).toBe('person-1');
    expect(
      findExistingPersonByLinkedinIdentity(
        { linkedinProfileId: 'jane-doe' },
        byLinkedin,
      )?.id,
    ).toBe('person-1');
  });
});
