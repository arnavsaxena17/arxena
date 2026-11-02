import {
  buildEnrollmentIndex,
  buildEnrollmentProfileRows,
  isPersonKnownDoNotContact,
  matchCandidateByPersonIdentity,
  partitionSelectedPersonIds,
} from 'src/engine/core-modules/outreach-command/utils/outreach-selection-enrollment.util';

describe('partitionSelectedPersonIds', () => {
  it('should split UUIDs from People-tab hash ids', () => {
    expect(
      partitionSelectedPersonIds([
        '118485df-6f00-42ac-991f-a1ff0f2f1924',
        '009c5a74f99fd6941b04f57143749769866b8711',
        '37ae299c-cd4f-437c-bb7a-247668d10a95',
      ]),
    ).toEqual({
      uuidPersonIds: [
        '118485df-6f00-42ac-991f-a1ff0f2f1924',
        '37ae299c-cd4f-437c-bb7a-247668d10a95',
      ],
      hashPersonIds: ['009c5a74f99fd6941b04f57143749769866b8711'],
    });
  });

  it('should keep an empty selection empty', () => {
    expect(partitionSelectedPersonIds([])).toEqual({
      uuidPersonIds: [],
      hashPersonIds: [],
    });
  });
});

describe('buildEnrollmentProfileRows', () => {
  it('should map People-tab rows to the upload-profiles payload', () => {
    expect(
      buildEnrollmentProfileRows([
        {
          id: '009c5a74f99fd6941b04f57143749769866b8711',
          name: 'Sushant Dash',
          title: 'Founder',
          companyName: 'Acme',
          linkedinUrl: 'https://in.linkedin.com/in/sushant-dash-502a4015',
          email: 'sushant@acme.test',
        },
      ]),
    ).toEqual([
      {
        name: 'Sushant Dash',
        title: 'Founder',
        company: 'Acme',
        companyName: 'Acme',
        linkedinUrl: 'https://in.linkedin.com/in/sushant-dash-502a4015',
        profileUrl: 'https://in.linkedin.com/in/sushant-dash-502a4015',
        email: 'sushant@acme.test',
      },
    ]);
  });

  it('should fall back to empty strings when optional fields are missing', () => {
    const [profile] = buildEnrollmentProfileRows([
      {
        id: 'hash',
        name: 'Roban Thakur',
        companyName: '',
        linkedinUrl: 'https://linkedin.com/in/roban-thakur',
      },
    ]);

    expect(profile.title).toBe('');
    expect(profile.email).toBe('');
  });
});

describe('buildEnrollmentIndex', () => {
  it('should index every identity key and remember do-not-contact people', () => {
    const index = buildEnrollmentIndex([
      {
        candidateId: '37ae299c-cd4f-437c-bb7a-247668d10a95',
        name: 'Sushant Dash',
        companyName: 'Acme',
        email: 'sushant@acme.test',
        linkedinUrl: 'https://in.linkedin.com/in/sushant-dash-502a4015',
        doNotContact: true,
      },
    ]);

    expect(index.candidateIdByKey.size).toBeGreaterThan(0);
    expect(index.doNotContactKeys.size).toBeGreaterThan(0);
  });
});

describe('matchCandidateByPersonIdentity', () => {
  const index = buildEnrollmentIndex([
    {
      candidateId: 'candidate-1',
      name: 'Sushant Dash',
      companyName: 'Acme',
      email: 'sushant@acme.test',
      linkedinUrl: 'https://www.linkedin.com/in/sushant-dash-502a4015/',
      doNotContact: false,
    },
  ]);

  it('should match across LinkedIn host and slug variants', () => {
    expect(
      matchCandidateByPersonIdentity(
        {
          name: 'Someone Else',
          companyName: 'Other',
          linkedinUrl: 'https://id.linkedin.com/in/Sushant-Dash-502a4015',
        },
        index,
      ),
    ).toBe('candidate-1');
  });

  it('should match on email when there is no LinkedIn URL', () => {
    expect(
      matchCandidateByPersonIdentity(
        { name: 'Someone Else', companyName: 'Other', email: 'SUSHANT@acme.test' },
        index,
      ),
    ).toBe('candidate-1');
  });

  it('should return undefined when nothing matches', () => {
    expect(
      matchCandidateByPersonIdentity(
        {
          name: 'Nobody',
          companyName: 'Nowhere',
          linkedinUrl: 'https://linkedin.com/in/nobody',
        },
        index,
      ),
    ).toBeUndefined();
  });
});

describe('isPersonKnownDoNotContact', () => {
  const index = buildEnrollmentIndex([
    {
      candidateId: 'candidate-1',
      name: 'Marc Gibson',
      companyName: 'MyGL',
      email: '',
      linkedinUrl: 'https://linkedin.com/in/marc-gibson-mygltd-immig',
      doNotContact: true,
    },
  ]);

  it('should recognise a blocked person by LinkedIn slug', () => {
    expect(
      isPersonKnownDoNotContact(
        {
          name: 'Marc Gibson',
          companyName: 'MyGL',
          linkedinUrl: 'https://www.linkedin.com/in/marc-gibson-mygltd-immig',
        },
        index,
      ),
    ).toBe(true);
  });

  it('should not treat an unknown person as blocked', () => {
    expect(
      isPersonKnownDoNotContact(
        {
          name: 'Sukhpreet Singh',
          companyName: 'Acme',
          linkedinUrl: 'https://linkedin.com/in/sukhpreet-singh-19755596',
        },
        index,
      ),
    ).toBe(false);
  });
});
