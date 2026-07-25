import { Module } from '@nestjs/common';

import { FieldMetadataModule } from 'src/engine/metadata-modules/field-metadata/field-metadata.module';
import { RelationMetadataService } from 'src/engine/metadata-modules/relation-metadata/relation-metadata.service';

@Module({
  imports: [FieldMetadataModule],
  providers: [RelationMetadataService],
  exports: [RelationMetadataService],
})
export class RelationMetadataModule {}
