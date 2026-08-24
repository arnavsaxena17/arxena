import {
  buildFakeProfileInvestigationBrief,
  extractProfilesFromPayload,
  parseProfileDate,
} from 'src/engine/core-modules/gtm-command/utils/gtm-fake-profile-investigation.util';

describe('gtm-fake-profile-investigation.util', () => {
  it('parses US and structured dates', () => {
    expect(parseProfileDate('6/1/2013')).toBe('2013-06');
    expect(parseProfileDate('12/1/2023')).toBe('2023-12');
    expect(parseProfileDate({ year: 2019, month: 7 })).toBe('2019-07');
  });

  it('flags education vs elite self-employed tenure on the example fake profile', () => {
    const brief = buildFakeProfileInvestigationBrief({
      firstName: 'TS',
      lastName: 'Dadapeer',
      headline: 'Change',
      location: 'India',
      summary:
        'Egon Zehnder is a leading global high-end headhunting and leadership consulting firm founded in 1964.',
      education: [
        {
          degreeName: 'BBA',
          schoolName: 'Osmania University, Hyderabad',
          start: '7/1/2019',
          end: '12/1/2023',
        },
      ],
      experience: [
        {
          company: 'Egon Zehnder',
          title: 'Senior Consultant',
          employmentType: 'Self-employed',
          location: 'London',
          start: '6/1/2013',
        },
      ],
    });

    expect(brief).toContain('Chronology clash');
    expect(brief).toContain('Egon Zehnder');
    expect(brief).toContain('Self-employed');
    expect(brief).toContain('company brochure');
  });

  it('unwraps a LinkedIn search payload', () => {
    const profiles = extractProfilesFromPayload({
      snapshot: {
        object: 'LinkedinSearch',
        items: [{ name: 'A' }, { name: 'B' }],
      },
    });

    expect(profiles).toHaveLength(2);
  });
});
