import { Module } from '@nestjs/common';
import { CandidateSourcingController } from './candidate-sourcing.controller';

@Module({
  controllers: [CandidateSourcingController],
})
export class CandidateSourcingModule {}
