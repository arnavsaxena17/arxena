import { FieldMetadataType } from 'twenty-shared';

import { FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { shouldGenerateFieldFakeValue } from 'src/modules/workflow/workflow-builder/utils/should-generate-field-fake-value';

const createField = (
  overrides: Partial<FieldMetadataEntity>,
): FieldMetadataEntity =>
  ({
    isActive: true,
    isSystem: false,
    type: FieldMetadataType.TEXT,
    name: 'name',
    ...overrides,
  }) as FieldMetadataEntity;

describe('shouldGenerateFieldFakeValue', () => {
  it('should return true for active non-system fields', () => {
    expect(
      shouldGenerateFieldFakeValue(
        createField({
          name: 'name',
          type: FieldMetadataType.TEXT,
        }),
      ),
    ).toBe(true);
  });

  it('should return true for system id field', () => {
    expect(
      shouldGenerateFieldFakeValue(
        createField({
          name: 'id',
          type: FieldMetadataType.UUID,
          isSystem: true,
        }),
      ),
    ).toBe(true);
  });

  it('should return true for system relation join-column UUID fields', () => {
    expect(
      shouldGenerateFieldFakeValue(
        createField({
          name: 'pointOfContactId',
          type: FieldMetadataType.UUID,
          isSystem: true,
          label: 'Point of Contact id (foreign key)',
        }),
      ),
    ).toBe(true);
  });

  it('should return false for inactive fields', () => {
    expect(
      shouldGenerateFieldFakeValue(
        createField({
          isActive: false,
        }),
      ),
    ).toBe(false);
  });

  it('should return false for relation object fields', () => {
    expect(
      shouldGenerateFieldFakeValue(
        createField({
          name: 'pointOfContact',
          type: FieldMetadataType.RELATION,
        }),
      ),
    ).toBe(false);
  });

  it('should return false for excluded system fields', () => {
    expect(
      shouldGenerateFieldFakeValue(
        createField({
          name: 'searchVector',
          type: FieldMetadataType.TS_VECTOR,
          isSystem: true,
        }),
      ),
    ).toBe(false);

    expect(
      shouldGenerateFieldFakeValue(
        createField({
          name: 'position',
          type: FieldMetadataType.POSITION,
          isSystem: true,
        }),
      ),
    ).toBe(false);
  });
});
