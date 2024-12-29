import { Module } from '@nestjs/common';
import { MessageQueueModule } from 'src/engine/integrations/message-queue/message-queue.module';
import { messageQueueModuleFactory } from 'src/engine/integrations/message-queue/message-queue.module-factory';
import { EnvironmentService } from 'src/engine/integrations/environment/environment.service';
import { JobProcessAutomationController } from './job-process-automation.controller';
import { JobProcessAutomationService } from './job-process-automation.service';

@Module({
  imports: [],
  providers: [JobProcessAutomationService],
  controllers: [JobProcessAutomationController],
})
export class JobProcessAutomationModule {}
