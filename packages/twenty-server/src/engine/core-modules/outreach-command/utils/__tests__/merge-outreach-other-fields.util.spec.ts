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

  describe('resultSetIds', () => {
    it('should list every search that wrote the row and keep the first one', () => {
      expect(
        mergeOutreachOtherFields(
          { resultSetIds: ['search-1'], firstResultSetId: 'search-1' },
          { resultSetIds: ['search-2'], firstResultSetId: 'search-2' },
        ),
      ).toEqual({
        resultSetIds: ['search-1', 'search-2'],
        firstResultSetId: 'search-1',
      });
    });

    it('should not credit a search with a row that was already on the tab', () => {
      const merged = mergeOutreachOtherFields(
        { connections: 100 },
        { resultSetIds: ['search-2'], firstResultSetId: 'search-2' },
      );

      expect(merged?.resultSetIds).toEqual(['search-2']);
      expect(merged?.firstResultSetId).toBeUndefined();
    });

    it('should take the search as first for a new row', () => {
      expect(
        mergeOutreachOtherFields(undefined, {
          resultSetIds: ['search-3'],
          firstResultSetId: 'search-3',
        }),
      ).toEqual({ resultSetIds: ['search-3'], firstResultSetId: 'search-3' });
    });
  });
});
