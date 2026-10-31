import { pickHarvestGeoMatch } from '../harvest-geo-match.util';

const mumbai = [
  { geoId: '106164952', title: 'Mumbai, Maharashtra, India' },
  { geoId: '90009639', title: 'Mumbai Metropolitan Region' },
  { geoId: '102956297', title: 'Navi Mumbai, Maharashtra, India' },
];

describe('pickHarvestGeoMatch', () => {
  it('prefers the wider metro node for a bare city name', () => {
    const match = pickHarvestGeoMatch(mumbai, 'Mumbai');

    expect(match.matchedVia).toBe('metro');
    expect(match.geoIds).toEqual(['90009639']);
    expect(match.titles).toEqual(['Mumbai Metropolitan Region']);
  });

  it('keeps the exact node when the caller qualified the city', () => {
    const match = pickHarvestGeoMatch(mumbai, 'Mumbai, Maharashtra, India');

    expect(match.matchedVia).toBe('exact');
    expect(match.geoIds).toEqual(['106164952']);
  });

  it('takes the first metro node when several share the city token', () => {
    const match = pickHarvestGeoMatch(
      [
        { geoId: '90009496', title: 'London Area, United Kingdom' },
        { geoId: '90009538', title: 'London, Canada Metropolitan Area' },
        {
          geoId: '102257491',
          title: 'Greater London, England, United Kingdom',
        },
      ],
      'London',
    );

    expect(match.geoIds).toEqual(['90009496']);
  });

  it('falls back to a title that contains every input token', () => {
    const match = pickHarvestGeoMatch(
      [
        {
          geoId: '102257491',
          title: 'Greater London, England, United Kingdom',
        },
      ],
      'London, England, United Kingdom',
    );

    expect(match.geoIds).toEqual(['102257491']);
  });

  it('uses a plain containing title when no metro node exists', () => {
    const match = pickHarvestGeoMatch(
      [{ geoId: '106288977', title: 'Paris, Texas, United States' }],
      'Paris',
    );

    expect(match.matchedVia).toBe('superset');
    expect(match.geoIds).toEqual(['106288977']);
  });

  it('returns nothing rather than guessing when no title fits', () => {
    expect(pickHarvestGeoMatch(mumbai, 'Reykjavik').matchedVia).toBe('none');
    expect(pickHarvestGeoMatch(mumbai, 'Reykjavik').geoIds).toEqual([]);
    expect(pickHarvestGeoMatch(undefined, 'Mumbai').geoIds).toEqual([]);
    expect(pickHarvestGeoMatch(mumbai, '   ').geoIds).toEqual([]);
  });

  it('ignores malformed elements', () => {
    const match = pickHarvestGeoMatch(
      [{ title: 'Mumbai Metropolitan Region' }, { geoId: '1' }, null, 'x'],
      'Mumbai',
    );

    expect(match.geoIds).toEqual([]);
  });
});
