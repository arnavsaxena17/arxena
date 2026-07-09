import { FieldMetadataType } from 'twenty-shared';

import { FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { ObjectMetadataEntity } from 'src/engine/metadata-modules/object-metadata/object-metadata.entity';
import { generateFakeObjectRecord } from 'src/modules/workflow/workflow-builder/utils/generate-fake-object-record';

const createObjectMetadata = (
  fields: Partial<FieldMetadataEntity>[],
): ObjectMetadataEntity =>
  ({
    id: 'opportunity-id',
    nameSingular: 'opportunity',
    labelSingular: 'Opportunity',
    description: 'An opportunity',
    icon: 'IconTargetArrow',
    fields: fields.map(
      (field) =>
        ({
          isActive: true,
          isSystem: false,
          type: FieldMetadataType.TEXT,
          name: 'name',
          label: 'Name',
          icon: 'IconAbc',
          ...field,
        }) as FieldMetadataEntity,
    ),
  }) as ObjectMetadataEntity;

describe('generateFakeObjectRecord', () => {
  it('should include relation join-column UUID fields in the output schema', () => {
    const result = generateFakeObjectRecord(
      createObjectMetadata([
        {
          name: 'name',
          label: 'Name',
          type: FieldMetadataType.TEXT,
        },
        {
          name: 'pointOfContact',
          label: 'Point of Contact',
          type: FieldMetadataType.RELATION,
          isSystem: false,
        },
        {
          name: 'pointOfContactId',
          label: 'Point of Contact id (foreign key)',
          type: FieldMetadataType.UUID,
          isSystem: true,
          icon: 'IconUser',
        },
        {
          name: 'id',
          label: 'Id',
          type: FieldMetadataType.UUID,
          isSystem: true,
        },
      ]),
    );

    expect(result._outputSchemaType).toBe('RECORD');
    expect(result.fields).toHaveProperty('name');
    expect(result.fields).toHaveProperty('id');
    expect(result.fields).toHaveProperty('pointOfContactId');
    expect(result.fields).not.toHaveProperty('pointOfContact');
    expect(result.fields.pointOfContactId).toMatchObject({
      isLeaf: true,
      type: FieldMetadataType.UUID,
      label: 'Point of Contact id (foreign key)',
      icon: 'IconUser',
    });
  });
});
