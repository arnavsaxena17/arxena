import { Module } from '@nestjs/common';

import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { FieldMetadataModule } from 'src/engine/metadata-modules/field-metadata/field-metadata.module';
import { ObjectMetadataModule } from 'src/engine/metadata-modules/object-metadata/object-metadata.module';
import { RelationMetadataModule } from 'src/engine/metadata-modules/relation-metadata/relation-metadata.module';

import { MetadataStructureSeedService } from './metadata-structure-seed.service';

@Module({
  imports: [
    DataSourceModule,
    ObjectMetadataModule,
    FieldMetadataModule,
    RelationMetadataModule,
  ],
  providers: [MetadataStructureSeedService],
  exports: [MetadataStructureSeedService],
})
export class MetadataStructureSeedModule {}
