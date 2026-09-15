import { Test, type TestingModule } from '@nestjs/testing';

import { OUTREACH_HITL_CONTEXT_TEMPLATES } from 'twenty-shared/arx';
import { FieldMetadataType } from 'twenty-shared/types';
import { WorkflowActionType } from 'twenty-shared/workflow';

import { ApprovalNotifierService } from 'src/engine/core-modules/arx-chat/services/workflow-approval/approval-notifier.service';
import { WorkflowFormDecisionPointerService } from 'src/engine/core-modules/arx-chat/services/workflow-approval/workflow-form-decision-pointer.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { FormWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/form/form.workflow-action';
import { type WorkflowFormAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

const profileStepId = 'b8e1d002-4a22-4c22-8c22-000000000002';

const draftStepId = '4582ca2b-2b80-4c4f-a802-7a923b296322';

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
      {
        id: 'editedBody',
        name: 'editedBody',
        type: FieldMetadataType.TEXT,
        label: 'Message',
        value: `{{${draftStepId}.message}}`,
      },
    ],
    notifyOnPending: {
      channels: ['WHATSAPP_OFFICIAL'],
      contextTemplate: OUTREACH_HITL_CONTEXT_TEMPLATES.firstLinkedInMessage,
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
  let mockPersistResolvedFormFields: jest.Mock;

  beforeEach(async () => {
    mockNotify = jest.fn().mockResolvedValue({
      results: [{ channel: 'WHATSAPP_OFFICIAL', status: 'sent_flow' }],
    });
    mockPersistResolvedFormFields = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormWorkflowAction,
        {
          provide: ApprovalNotifierService,
          useValue: { notify: mockNotify },
        },
        {
          provide: WorkflowFormDecisionPointerService,
          useValue: {
            createPointer: jest.fn().mockReturnValue('pointer'),
            persistResolvedFormFields: mockPersistResolvedFormFields,
          },
        },
        {
          provide: GlobalWorkspaceOrmManager,
          useValue: {
            executeInWorkspaceContext: jest.fn(async (fn: () => unknown) =>
              fn(),
            ),
            getRepository: jest.fn().mockResolvedValue({
              findOne: jest.fn().mockResolvedValue(null),
            }),
          },
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

  it('persists resolved field values on the run when the form parks', async () => {
    await action.execute({
      currentStepId: 'form-step',
      steps: [buildFormStep()],
      context: {
        [draftStepId]: { message: 'Hi Anish — great to connect.' },
      },
      runInfo: { workspaceId: 'workspace-1', workflowRunId: 'run-1' },
    });

    expect(mockPersistResolvedFormFields).toHaveBeenCalledWith(
      expect.objectContaining({
        stepId: 'form-step',
        workflowRunId: 'run-1',
        fields: expect.arrayContaining([
          expect.objectContaining({
            name: 'editedBody',
            value: 'Hi Anish — great to connect.',
          }),
        ]),
      }),
    );
  });

  it('collapses unresolvable field variables to empty instead of raw templates', async () => {
    await action.execute({
      currentStepId: 'form-step',
      steps: [buildFormStep()],
      context: {},
      runInfo: { workspaceId: 'workspace-1', workflowRunId: 'run-1' },
    });

    expect(mockPersistResolvedFormFields).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: expect.arrayContaining([
          expect.objectContaining({ name: 'editedBody', value: '' }),
        ]),
      }),
    );
  });
});
