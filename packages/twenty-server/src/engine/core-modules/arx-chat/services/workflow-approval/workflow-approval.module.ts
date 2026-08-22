import { Module } from '@nestjs/common';

import { ApprovalNotifierService } from 'src/engine/core-modules/arx-chat/services/workflow-approval/approval-notifier.service';
import { FacebookWhatsappWorkflowFormFlowService } from 'src/engine/core-modules/arx-chat/services/workflow-approval/facebook-whatsapp-workflow-form-flow.service';
import { FacebookWhatsappWorkflowFormTemplateService } from 'src/engine/core-modules/arx-chat/services/workflow-approval/facebook-whatsapp-workflow-form-template.service';
import { WorkflowFormDecisionPointerService } from 'src/engine/core-modules/arx-chat/services/workflow-approval/workflow-form-decision-pointer.service';
import { WorkflowFormNotifyTestService } from 'src/engine/core-modules/arx-chat/services/workflow-approval/workflow-form-notify-test.service';
import { WorkflowFormWhatsappDecisionService } from 'src/engine/core-modules/arx-chat/services/workflow-approval/workflow-form-whatsapp-decision.service';
import { WhatsappUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/whatsapp-unipile-request.service';
import { CacheStorageModule } from 'src/engine/core-modules/cache-storage/cache-storage.module';

@Module({
  imports: [CacheStorageModule],
  providers: [
    FacebookWhatsappWorkflowFormFlowService,
    FacebookWhatsappWorkflowFormTemplateService,
    WhatsappUnipileRequestService,
    ApprovalNotifierService,
    WorkflowFormDecisionPointerService,
    WorkflowFormNotifyTestService,
    WorkflowFormWhatsappDecisionService,
  ],
  exports: [
    FacebookWhatsappWorkflowFormFlowService,
    FacebookWhatsappWorkflowFormTemplateService,
    ApprovalNotifierService,
    WorkflowFormDecisionPointerService,
    WorkflowFormNotifyTestService,
    WorkflowFormWhatsappDecisionService,
  ],
})
export class WorkflowApprovalModule {}
