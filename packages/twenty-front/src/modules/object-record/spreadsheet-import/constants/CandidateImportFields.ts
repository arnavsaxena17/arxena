import { type SpreadsheetImportField } from '@/spreadsheet-import/types';
import { type IconComponent } from 'twenty-ui/icon';
import { FieldMetadataType } from '~/generated-metadata/graphql';

// ARX candidate fields not always present in object metadata — inject for spreadsheet mapping
export const getCandidateSpecificImportFields = (
  getIcon: (iconName: string) => IconComponent,
): SpreadsheetImportField[] => {
  const createField = (
    field: Omit<
      SpreadsheetImportField,
      'fieldMetadataItemId' | 'isNestedField' | 'Icon'
    > & { iconName: string },
  ): SpreadsheetImportField => ({
    Icon: getIcon(field.iconName),
    label: field.label,
    key: field.key,
    fieldMetadataItemId: `arx-candidate-import-${field.key}`,
    fieldType: field.fieldType,
    fieldMetadataType: field.fieldMetadataType,
    fieldValidationDefinitions: field.fieldValidationDefinitions,
    isNestedField: false,
  });

  return [
    createField({
      iconName: 'IconUsers',
      label: 'Status',
      key: 'status',
      fieldType: {
        type: 'select',
        options: [
          { label: 'Not Interested', value: 'NOT_INTERESTED' },
          { label: 'Interested', value: 'INTERESTED' },
          { label: 'CV Received', value: 'CV_RECEIVED' },
          { label: 'Not Fit', value: 'NOT_FIT' },
          { label: 'Sourced', value: 'SOURCED' },
          { label: 'Screening', value: 'SCREENING' },
          { label: 'Recruiter Interview', value: 'RECRUITER_INTERVIEW' },
          { label: 'CV Sent', value: 'CV_SENT' },
          { label: 'Client Interview', value: 'CLIENT_INTERVIEW' },
          { label: 'Negotiation', value: 'NEGOTIATION' },
        ],
      },
      fieldMetadataType: FieldMetadataType.SELECT,
    }),
    createField({
      iconName: 'IconUsers',
      label: 'Conversation Status',
      key: 'candConversationStatus',
      fieldType: {
        type: 'select',
        options: [
          {
            label: 'Conversation Closed To Be Contacted',
            value: 'CONVERSATION_CLOSED_TO_BE_CONTACTED',
          },
          {
            label: 'Candidate Is Keen To Chat',
            value: 'CANDIDATE_IS_KEEN_TO_CHAT',
          },
          {
            label: 'Candidate Has Followed Up To Setup Chat',
            value: 'CANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT',
          },
          {
            label: 'Candidate Is Reluctant To Discuss Compensation',
            value: 'CANDIDATE_IS_RELUCTANT_TO_DISCUSS_COMPENSATION',
          },
          {
            label: 'Candidate Salary Out of Range',
            value: 'CANDIDATE_SALARY_OUT_OF_RANGE',
          },
          {
            label: 'Candidate Refuses To Relocate',
            value: 'CANDIDATE_REFUSES_TO_RELOCATE',
          },
          {
            label: 'Shared JD Has Not Responded',
            value: 'SHARED_JD_HAS_NOT_RESPONDED',
          },
          {
            label: 'Stopped Responding On Questions',
            value: 'STOPPED_RESPONDING_ON_QUESTIONS',
          },
          {
            label: 'Candidate Declined Opportunity',
            value: 'CANDIDATE_DECLINED_OPPORTUNITY',
          },
          {
            label: 'Conversation Started Has Not Responded',
            value: 'CONVERSATION_STARTED_HAS_NOT_RESPONDED',
          },
          {
            label: 'Only Added No Conversation',
            value: 'ONLY_ADDED_NO_CONVERSATION',
          },
        ],
      },
      fieldMetadataType: FieldMetadataType.SELECT,
    }),
    createField({
      iconName: 'IconPhone',
      label: 'Remarks',
      key: 'remarks',
      fieldType: { type: 'input' },
      fieldMetadataType: FieldMetadataType.TEXT,
    }),
    createField({
      iconName: 'IconMessageChatbot',
      label: 'Start Chat',
      key: 'startChat',
      fieldType: { type: 'checkbox' },
      fieldMetadataType: FieldMetadataType.BOOLEAN,
    }),
    createField({
      iconName: 'IconMessageCheck',
      label: 'Start Chat Completed',
      key: 'startChatCompleted',
      fieldType: { type: 'checkbox' },
      fieldMetadataType: FieldMetadataType.BOOLEAN,
    }),
    createField({
      iconName: 'IconHandStop',
      label: 'Stop Chat',
      key: 'stopChat',
      fieldType: { type: 'checkbox' },
      fieldMetadataType: FieldMetadataType.BOOLEAN,
    }),
    createField({
      iconName: 'IconPencilStar',
      label: 'Source',
      key: 'source',
      fieldType: { type: 'input' },
      fieldMetadataType: FieldMetadataType.TEXT,
    }),
    createField({
      iconName: 'IconMessageCircle',
      label: 'Messaging Channel',
      key: 'messagingChannel',
      fieldType: { type: 'input' },
      fieldMetadataType: FieldMetadataType.TEXT,
    }),
    createField({
      iconName: 'IconLink',
      label: 'Resdex Naukri URL',
      key: 'resdexNaukriUrl',
      fieldType: { type: 'input' },
      fieldMetadataType: FieldMetadataType.LINKS,
    }),
    createField({
      iconName: 'IconLink',
      label: 'Hiring Naukri URL',
      key: 'hiringNaukriUrl',
      fieldType: { type: 'input' },
      fieldMetadataType: FieldMetadataType.LINKS,
    }),
    createField({
      iconName: 'IconUserCheck',
      label: 'Engagement Status',
      key: 'engagementStatus',
      fieldType: { type: 'checkbox' },
      fieldMetadataType: FieldMetadataType.BOOLEAN,
    }),
    createField({
      iconName: 'IconBrandWhatsapp',
      label: 'WhatsApp Provider',
      key: 'whatsappProvider',
      fieldType: { type: 'input' },
      fieldMetadataType: FieldMetadataType.TEXT,
    }),
    createField({
      iconName: 'IconShoppingCart',
      label: 'Is Profile Purchased',
      key: 'isProfilePurchased',
      fieldType: { type: 'checkbox' },
      fieldMetadataType: FieldMetadataType.BOOLEAN,
    }),
    createField({
      iconName: 'IconMessageNumber',
      label: 'Chat Count',
      key: 'chatCount',
      fieldType: { type: 'input' },
      fieldMetadataType: FieldMetadataType.NUMBER,
    }),
    createField({
      iconName: 'IconPencilStar',
      label: 'Campaign',
      key: 'campaign',
      fieldType: { type: 'input' },
      fieldMetadataType: FieldMetadataType.TEXT,
    }),
    createField({
      iconName: 'IconBuilding',
      label: 'Job Company Name',
      key: 'jobCompanyName',
      fieldType: { type: 'input' },
      fieldMetadataType: FieldMetadataType.TEXT,
    }),
    createField({
      iconName: 'IconVideo',
      label: 'Start Video Interview Chat',
      key: 'startVideoInterviewChat',
      fieldType: { type: 'checkbox' },
      fieldMetadataType: FieldMetadataType.BOOLEAN,
    }),
    createField({
      iconName: 'IconVideoCheck',
      label: 'Start Video Interview Chat Completed',
      key: 'startVideoInterviewChatCompleted',
      fieldType: { type: 'checkbox' },
      fieldMetadataType: FieldMetadataType.BOOLEAN,
    }),
    createField({
      iconName: 'IconCalendarTime',
      label: 'Start Meeting Scheduling Chat',
      key: 'startMeetingSchedulingChat',
      fieldType: { type: 'checkbox' },
      fieldMetadataType: FieldMetadataType.BOOLEAN,
    }),
    createField({
      iconName: 'IconCalendarCheck',
      label: 'Start Meeting Scheduling Chat Completed',
      key: 'startMeetingSchedulingChatCompleted',
      fieldType: { type: 'checkbox' },
      fieldMetadataType: FieldMetadataType.BOOLEAN,
    }),
    createField({
      iconName: 'IconMessageDots',
      label: 'Last Engagement Chat Control',
      key: 'lastEngagementChatControl',
      fieldType: { type: 'input' },
      fieldMetadataType: FieldMetadataType.TEXT,
    }),
    createField({
      iconName: 'IconJson',
      label: 'Job Specific Fields',
      key: 'jobSpecificFields',
      fieldType: { type: 'input' },
      fieldMetadataType: FieldMetadataType.RAW_JSON,
    }),
    createField({
      iconName: 'IconJson',
      label: 'Shortlist Object',
      key: 'shortlistObj',
      fieldType: { type: 'input' },
      fieldMetadataType: FieldMetadataType.RAW_JSON,
    }),
  ];
};
