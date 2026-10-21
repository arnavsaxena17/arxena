import { mergeOutreachOtherFields } from 'src/engine/core-modules/outreach-command/utils/merge-outreach-other-fields.util';

describe('mergeOutreachOtherFields', () => {
  it('adds and updates source keys without dropping existing ones', () => {
    expect(
      mergeOutreachOtherFields(
        {
          isProfileAuthentic: true,
          authenticityReason: 'Name matches',
          connections: 100,
        },
        {
          connections: 500,
          followers: 1264,
          educationSchools: 'IGNOU',
        },
      ),
    ).toEqual({
      isProfileAuthentic: true,
      authenticityReason: 'Name matches',
      connections: 500,
      followers: 1264,
      educationSchools: 'IGNOU',
    });
  });

  it('does not overwrite AI column answers already on the row', () => {
    expect(
      mergeOutreachOtherFields(
        {
          storeCount: 400,
          aiColumns: { storeCount: { status: 'ok' } },
        },
        {
          storeCount: 1,
          linkedinUrl: 'https://l.in/c/wow',
        },
      ),
    ).toEqual({
      storeCount: 400,
      linkedinUrl: 'https://l.in/c/wow',
      aiColumns: { storeCount: { status: 'ok' } },
    });
  });
});
