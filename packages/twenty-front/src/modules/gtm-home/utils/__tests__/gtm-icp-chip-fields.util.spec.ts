import {
  parseIcpSpecObject,
  readIcpChipValues,
  readIcpStringField,
  toStringList,
  writeIcpChipValues,
  writeIcpStringField,
} from '@/gtm-home/utils/gtm-icp-chip-fields.util';

describe('gtm-icp-chip-fields.util', () => {
  it('normalizes string lists and ignores junk', () => {
    expect(toStringList([' Head ', '', 3, 'Director'])).toEqual([
      'Head',
      'Director',
    ]);
  });

  it('reads and writes chip fields without dropping unknown keys', () => {
    const spec = JSON.stringify({
      name: 'Buyers',
      painSignals: ['hiring'],
      extra: true,
    });

    expect(readIcpChipValues(spec, 'painSignals')).toEqual(['hiring']);
    expect(readIcpChipValues(spec, 'stdGrades')).toEqual([]);

    const next = writeIcpChipValues(spec, 'stdGrades', ['VP', 'Director']);
    const parsed = parseIcpSpecObject(next);

    expect(parsed?.name).toBe('Buyers');
    expect(parsed?.extra).toBe(true);
    expect(parsed?.stdGrades).toEqual(['VP', 'Director']);
  });

  it('reads and writes scalar fields', () => {
    const spec = writeIcpStringField('{}', 'employeeRange', '51-200');

    expect(readIcpStringField(spec, 'employeeRange')).toBe('51-200');
    expect(readIcpStringField('not-json', 'name')).toBe('');
    expect(parseIcpSpecObject('[]')).toBeNull();
  });
});
