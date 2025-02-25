import { Module } from '@nestjs/common';
import { JobProcessAutomationController } from './job-process-automation.controller';
import { JobProcessAutomationService } from './job-process-automation.service';

@Module({
  imports: [],
  providers: [JobProcessAutomationService],
  controllers: [JobProcessAutomationController],
})
export class JobProcessAutomationModule {}
