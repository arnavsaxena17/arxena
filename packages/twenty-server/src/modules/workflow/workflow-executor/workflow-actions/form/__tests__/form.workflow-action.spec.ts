import { Test, type TestingModule } from '@nestjs/testing';

import { WorkflowActionType } from 'twenty-shared/workflow';
import { FieldMetadataType } from 'twenty-shared/types';

import { ApprovalNotifierService } from 'src/engine/core-modules/arx-chat/services/workflow-approval/approval-notifier.service';
import { WorkflowFormDecisionPointerService } from 'src/engine/core-modules/arx-chat/services/workflow-approval/workflow-form-decision-pointer.service';
import { FormWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/form/form.workflow-action';
import { type WorkflowFormAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

const profileStepId = 'b8e1d002-4a22-4c22-8c22-000000000002';

const buildFormStep = (): WorkflowFormAction => ({
  id: 'form-step',
  type: WorkflowActionType.FORM,
  name: 'Approve / edit first message',
  valid: true,
  settings: {
    outputSchema: {},
    errorHandlingOptions: {
      retryOnFailure: { value: false },
      continueOnFailure: { value: false },
    },
    input: [
      {
        id: 'approve',
        name: 'approve',
        type: FieldMetadataType.BOOLEAN,
        label: 'Approve send',
      },
    ],
    notifyOnPending: {
      channels: ['WHATSAPP_OFFICIAL'],
      contextTemplate: 'Review first LinkedIn message',
      detailsTemplate: 'Contact: {{person.first.name}}',
      whatsappOfficialRegistryName: 'wf_form_boolean_text',
      recipients: {
        WHATSAPP_OFFICIAL: `{{${profileStepId}.first.phoneNumber}}`,
      },
    },
  },
});

describe('FormWorkflowAction', () => {
  let action: FormWorkflowAction;
  let mockNotify: jest.Mock;

  beforeEach(async () => {
    mockNotify = jest.fn().mockResolvedValue({
      results: [{ channel: 'WHATSAPP_OFFICIAL', status: 'sent_flow' }],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormWorkflowAction,
        {
          provide: ApprovalNotifierService,
          useValue: { notify: mockNotify },
        },
        {
          provide: WorkflowFormDecisionPointerService,
          useValue: { createPointer: jest.fn().mockReturnValue('pointer') },
        },
      ],
    }).compile();

    action = module.get(FormWorkflowAction);
  });

  it('resolves notify recipient phone variables before sending', async () => {
    const result = await action.execute({
      currentStepId: 'form-step',
      steps: [buildFormStep()],
      context: {
        [profileStepId]: { first: { phoneNumber: '+919892197720' } },
        person: { first: { name: 'ANISH SHAH' } },
      },
      runInfo: { workspaceId: 'workspace-1', workflowRunId: 'run-1' },
    });

    expect(result).toEqual({ pendingEvent: true });
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipients: expect.objectContaining({
          WHATSAPP_OFFICIAL: '+919892197720',
        }),
        detailsText: 'Contact: ANISH SHAH',
      }),
    );
  });
});
