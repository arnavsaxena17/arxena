import {
  parseIcpSpecObject,
  readIcpChipValues,
  toStringList,
  writeIcpChipValues,
} from '@/outreach-home/utils/outreach-icp-chip-fields.util';

describe('outreach-icp-chip-fields.util', () => {
  it('normalizes string lists and ignores junk', () => {
    expect(toStringList([' Head ', '', 3, 'Director'])).toEqual([
      'Head',
      'Director',
    ]);
  });

  it('reads buyer titles and migrates geos into locations', () => {
    const spec = JSON.stringify({
      buyerTitles: ['VP People'],
      geos: ['US'],
      name: 'ignored',
    });

    expect(readIcpChipValues(spec, 'buyerTitles')).toEqual(['VP People']);
    expect(readIcpChipValues(spec, 'locations')).toEqual(['US']);
    expect(parseIcpSpecObject('[]')).toBeNull();
  });

  it('writes only buyerTitles and locations', () => {
    const next = writeIcpChipValues(
      JSON.stringify({ name: 'Buyers', geos: ['UK'] }),
      'buyerTitles',
      ['Head of Talent'],
    );

    expect(parseIcpSpecObject(next)).toEqual({
      buyerTitles: ['Head of Talent'],
      locations: ['UK'],
    });
  });
});
