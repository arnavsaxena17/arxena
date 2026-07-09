import { StepLogicalOperator, ViewFilterOperand } from 'twenty-shared';
import { v4 } from 'uuid';

export const FREE_TRIAL_LEAD_WORKFLOW_NAME =
  'Free Trial Lead — Meeting Follow-up';

export type FreeTrialLeadWorkflowConfig = {
  connectedAccountId: string;
  calendlyBookingUrl?: string;
  delayMinutes?: number;
};

export type FreeTrialLeadWorkflowDefinition = {
  trigger: Record<string, unknown>;
  steps: Record<string, unknown>[];
  stepIds: {
    delay: string;
    findOpportunity: string;
    findPerson: string;
    ifElse: string;
    llmThankYou: string;
    emailThankYou: string;
    llmScheduleReminder: string;
    emailScheduleReminder: string;
  };
};

const BASE_ERROR_HANDLING = {
  retryOnFailure: { value: false },
  continueOnFailure: { value: false },
};

export const buildFreeTrialLeadWorkflowDefinition = ({
  connectedAccountId,
  calendlyBookingUrl = 'https://calendly.com/arxena/30min',
  delayMinutes = 10,
}: FreeTrialLeadWorkflowConfig): FreeTrialLeadWorkflowDefinition => {
  const delayStepId = v4();
  const findOpportunityStepId = v4();
  const findPersonStepId = v4();
  const ifElseStepId = v4();
  const llmThankYouStepId = v4();
  const emailThankYouStepId = v4();
  const llmScheduleReminderStepId = v4();
  const emailScheduleReminderStepId = v4();

  const meetingBranchGroupId = v4();
  const meetingBranchFilterId = v4();
  const meetingBranchId = v4();
  const noMeetingBranchId = v4();

  const trigger = {
    type: 'DATABASE_EVENT',
    name: 'Opportunity is Created',
    nextStepIds: [delayStepId],
    settings: {
      eventName: 'opportunity.created',
      outputSchema: {},
    },
  };

  const steps = [
    {
      id: delayStepId,
      name: 'Wait 10 minutes',
      type: 'DELAY',
      valid: true,
      nextStepIds: [findOpportunityStepId],
      settings: {
        input: {
          delayType: 'DURATION',
          duration: {
            days: 0,
            hours: 0,
            minutes: delayMinutes,
            seconds: 0,
          },
        },
        outputSchema: {},
        errorHandlingOptions: BASE_ERROR_HANDLING,
      },
    },
    {
      id: findOpportunityStepId,
      name: 'Refresh Opportunity',
      type: 'FIND_RECORDS',
      valid: true,
      nextStepIds: [findPersonStepId],
      settings: {
        input: {
          objectName: 'opportunity',
          limit: 1,
          filter: {
            id: {
              eq: '{{trigger.recordId}}',
            },
          },
        },
        outputSchema: {},
        errorHandlingOptions: BASE_ERROR_HANDLING,
      },
    },
    {
      id: findPersonStepId,
      name: 'Find Point of Contact',
      type: 'FIND_RECORDS',
      valid: true,
      nextStepIds: [ifElseStepId],
      settings: {
        input: {
          objectName: 'person',
          limit: 1,
          filter: {
            id: {
              eq: `{{${findOpportunityStepId}.result.first.pointOfContactId}}`,
            },
          },
        },
        outputSchema: {},
        errorHandlingOptions: BASE_ERROR_HANDLING,
      },
    },
    {
      id: ifElseStepId,
      name: 'Calendly Meeting Scheduled?',
      type: 'IF_ELSE',
      valid: true,
      nextStepIds: [],
      settings: {
        input: {
          stepFilterGroups: [
            {
              id: meetingBranchGroupId,
              logicalOperator: StepLogicalOperator.AND,
            },
          ],
          stepFilters: [
            {
              id: meetingBranchFilterId,
              type: 'date',
              stepOutputKey: `{{${findOpportunityStepId}.result.first.meetingScheduledAt}}`,
              operand: ViewFilterOperand.IS_NOT_EMPTY,
              value: '',
              stepFilterGroupId: meetingBranchGroupId,
            },
          ],
          branches: [
            {
              id: meetingBranchId,
              nextStepIds: [llmThankYouStepId],
              filterGroupId: meetingBranchGroupId,
            },
            {
              id: noMeetingBranchId,
              nextStepIds: [llmScheduleReminderStepId],
            },
          ],
        },
        outputSchema: {},
        errorHandlingOptions: BASE_ERROR_HANDLING,
      },
    },
    {
      id: llmThankYouStepId,
      name: 'Generate Thank You Email',
      type: 'AI_AGENT',
      valid: true,
      nextStepIds: [emailThankYouStepId],
      settings: {
        input: {
          agentId: '',
          systemPrompt:
            'You write concise, warm onboarding emails for Arxena prospects who booked a demo meeting.',
          prompt: [
            'Write a short thank-you email for a free trial lead who scheduled a meeting.',
            'Lead name: {{' + findPersonStepId + '.result.first.name.firstName}} {{' + findPersonStepId + '.result.first.name.lastName}}',
            'Company: {{' + findOpportunityStepId + '.result.first.name}}',
            'Tone: professional, friendly, excited about the upcoming meeting.',
            'Return JSON only: { "message": "<email body in HTML>" }',
          ].join('\n'),
        },
        outputSchema: {},
        errorHandlingOptions: BASE_ERROR_HANDLING,
      },
    },
    {
      id: emailThankYouStepId,
      name: 'Send Thank You Email',
      type: 'SEND_EMAIL',
      valid: true,
      nextStepIds: [],
      settings: {
        input: {
          connectedAccountId,
          email: `{{${findPersonStepId}.result.first.emails.primaryEmail}}`,
          subject: 'Thanks for scheduling time with Arxena',
          body: `{{${llmThankYouStepId}.result.message}}`,
        },
        outputSchema: {
          success: { isLeaf: true, type: 'boolean' },
        },
        errorHandlingOptions: BASE_ERROR_HANDLING,
      },
    },
    {
      id: llmScheduleReminderStepId,
      name: 'Generate Scheduling Reminder',
      type: 'AI_AGENT',
      valid: true,
      nextStepIds: [emailScheduleReminderStepId],
      settings: {
        input: {
          agentId: '',
          systemPrompt:
            'You write concise follow-up emails encouraging Arxena free trial leads to book a demo.',
          prompt: [
            'Write a short email asking the lead to pick a meeting time.',
            'Lead name: {{' + findPersonStepId + '.result.first.name.firstName}} {{' + findPersonStepId + '.result.first.name.lastName}}',
            'Company: {{' + findOpportunityStepId + '.result.first.name}}',
            `Include this booking link: ${calendlyBookingUrl}`,
            'Tone: helpful, not pushy.',
            'Return JSON only: { "message": "<email body in HTML>" }',
          ].join('\n'),
        },
        outputSchema: {},
        errorHandlingOptions: BASE_ERROR_HANDLING,
      },
    },
    {
      id: emailScheduleReminderStepId,
      name: 'Send Scheduling Reminder',
      type: 'SEND_EMAIL',
      valid: true,
      nextStepIds: [],
      settings: {
        input: {
          connectedAccountId,
          email: `{{${findPersonStepId}.result.first.emails.primaryEmail}}`,
          subject: 'Pick a time to connect with Arxena',
          body: `{{${llmScheduleReminderStepId}.result.message}}`,
        },
        outputSchema: {
          success: { isLeaf: true, type: 'boolean' },
        },
        errorHandlingOptions: BASE_ERROR_HANDLING,
      },
    },
  ];

  return {
    trigger,
    steps,
    stepIds: {
      delay: delayStepId,
      findOpportunity: findOpportunityStepId,
      findPerson: findPersonStepId,
      ifElse: ifElseStepId,
      llmThankYou: llmThankYouStepId,
      emailThankYou: emailThankYouStepId,
      llmScheduleReminder: llmScheduleReminderStepId,
      emailScheduleReminder: emailScheduleReminderStepId,
    },
  };
};
