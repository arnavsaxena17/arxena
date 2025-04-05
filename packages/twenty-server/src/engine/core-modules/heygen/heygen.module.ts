import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HeygenController } from './heygen.controller';
import { HeygenService } from './heygen.service';

@Module({
  imports: [ConfigModule],
  providers: [HeygenService],
  controllers: [HeygenController],
  exports: [HeygenService],
})
export class HeygenModule {}
