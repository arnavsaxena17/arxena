import { FieldMetadataType } from '@/types';
import { getKnownRawJsonPathKeysForField } from '@/utils/fieldMetadata/getKnownRawJsonPathKeysForField';
import { getKnownRawJsonPathLeafType } from '@/utils/fieldMetadata/getKnownRawJsonPathLeafType';

describe('getKnownRawJsonPathKeysForField / getKnownRawJsonPathLeafType', () => {
  it('exposes candidateFlags startOutreach and stopOutreach as BOOLEAN leaves', () => {
    expect(getKnownRawJsonPathKeysForField('candidateFlags')).toEqual(
      expect.arrayContaining(['startOutreach', 'stopOutreach', 'startChat']),
    );

    expect(
      getKnownRawJsonPathLeafType({
        fieldName: 'candidateFlags',
        pathKey: 'startOutreach',
      }),
    ).toBe(FieldMetadataType.BOOLEAN);

    expect(
      getKnownRawJsonPathLeafType({
        fieldName: 'candidateFlags',
        pathKey: 'lastEngagementChatControl',
      }),
    ).toBe(FieldMetadataType.TEXT);
  });

  it('returns undefined for unknown fields or paths', () => {
    expect(getKnownRawJsonPathKeysForField('customPayload')).toBeUndefined();
    expect(
      getKnownRawJsonPathLeafType({
        fieldName: 'candidateFlags',
        pathKey: 'notARealFlag',
      }),
    ).toBeUndefined();
  });
});
