import { FieldMetadataType } from 'twenty-shared';

import { FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';

const EXCLUDED_SYSTEM_FIELDS = ['searchVector', 'position'];

export const shouldGenerateFieldFakeValue = (field: FieldMetadataEntity) => {
  const isExcludedSystemField =
    field.isSystem && EXCLUDED_SYSTEM_FIELDS.includes(field.name);

  return (
    field.isActive &&
    !isExcludedSystemField &&
    field.type !== FieldMetadataType.RELATION
  );
};
