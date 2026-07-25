import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DataSourceService } from './data-source.service';
import { DataSourceEntity } from './data-source.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DataSourceEntity])],
  providers: [DataSourceService],
  exports: [DataSourceService],
})
export class DataSourceModule {}
