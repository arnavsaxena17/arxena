import { Module } from '@nestjs/common';

import { AiAgentOutputValidationService } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-agent/services/ai-agent-output-validation.service';

@Module({
  providers: [AiAgentOutputValidationService],
  exports: [AiAgentOutputValidationService],
})
export class AiAgentOutputValidationModule {}
