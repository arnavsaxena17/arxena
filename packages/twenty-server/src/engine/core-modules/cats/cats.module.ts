


import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ApiRestController } from 'src/engine/api/rest/api-rest.controller';
import { ApiRestService } from 'src/engine/api/rest/api-rest.service';
import { ApiRestQueryBuilderModule } from 'src/engine/api/rest/api-rest-query-builder/api-rest-query-builder.module';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { ApiRestMetadataController } from 'src/engine/api/rest/metadata-rest.controller';
import { ApiRestMetadataService } from 'src/engine/api/rest/metadata-rest.service';
import { CatsController, DogsController } from 'src/engine/core-modules/cats/cats.controller';

@Module({
  imports: [ApiRestQueryBuilderModule, AuthModule, HttpModule],
  controllers: [ ApiRestMetadataController, ApiRestController, CatsController, DogsController],
  providers: [ApiRestMetadataService, ApiRestService],
  exports: [],
})
export class CatsModule {}
