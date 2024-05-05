import { FieldMetadataType } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { BASE_OBJECT_STANDARD_FIELD_IDS } from 'src/engine/workspace-manager/workspace-sync-metadata/constants/standard-field-ids';
import { FieldMetadata } from 'src/engine/workspace-manager/workspace-sync-metadata/decorators/field-metadata.decorator';
import { IsSystem } from 'src/engine/workspace-manager/workspace-sync-metadata/decorators/is-system.decorator';

export abstract class BaseObjectMetadata {
  @FieldMetadata({
    standardId: BASE_OBJECT_STANDARD_FIELD_IDS.id,
    type: FieldMetadataType.UUID,
    label: 'Id',
    description: 'Id',
    defaultValue: 'uuid',
    icon: 'Icon123',
  })
  @IsSystem()
  id: string;

  @FieldMetadata({
    standardId: BASE_OBJECT_STANDARD_FIELD_IDS.createdAt,
    type: FieldMetadataType.DATE_TIME,
    label: 'Creation date',
    description: 'Creation date',
    icon: 'IconCalendar',
    defaultValue: 'now',
  })
  createdAt: Date;

  @FieldMetadata({
    standardId: BASE_OBJECT_STANDARD_FIELD_IDS.updatedAt,
    type: FieldMetadataType.DATE_TIME,
    label: 'Update date',
    description: 'Update date',
    icon: 'IconCalendar',
    defaultValue: 'now',
  })
  @IsSystem()
  updatedAt: Date;
}
