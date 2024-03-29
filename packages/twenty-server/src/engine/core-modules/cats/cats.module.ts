import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CatsController } from 'src/engine/core-modules/cats/cats.controller';

@Module({
  imports: [],
  controllers: [CatsController],
  providers: [],
  exports: [],
})
export class CatsModule {}
