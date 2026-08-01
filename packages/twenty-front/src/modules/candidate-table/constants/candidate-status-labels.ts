export const STATUS_LABELS: Record<string, string> = {
  NOT_INTERESTED: 'Not Interested',
  INTERESTED: 'Interested',
  CV_RECEIVED: 'CV Received',
  NOT_FIT: 'Not Fit',
  SCREENING: 'Screening',
  RECRUITER_INTERVIEW: 'Recruiter Interview',
  CV_SENT: 'CV Sent',
  CLIENT_INTERVIEW: 'Client Interview',
  NEGOTIATION: 'Negotiation',
};

export const CANDIDATE_CONVERSATION_STATUS_LABELS: Record<string, string> = {
  ONLY_ADDED_NO_CONVERSATION: 'No Conversation',
  CONVERSATION_STARTED_HAS_NOT_RESPONDED: 'Started, No Response',
  SHARED_JD_HAS_NOT_RESPONDED: 'Shared JD, No Response',
  CANDIDATE_REFUSES_TO_RELOCATE: 'Refuses Relocation',
  STOPPED_RESPONDING_ON_QUESTIONS: 'Stopped Responding',
  CANDIDATE_SALARY_OUT_OF_RANGE: 'Salary Out of Range',
  CANDIDATE_IS_KEEN_TO_CHAT: 'Keen to Chat',
  CANDIDATE_DECLINED_OPPORTUNITY: 'Declined Opportunity',
  CANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT: 'Followed Up',
  CANDIDATE_IS_RELUCTANT_TO_DISCUSS_COMPENSATION: 'Reluctant on Compensation',
  CONVERSATION_CLOSED_TO_BE_CONTACTED: 'Closed to Contact',
};

export const MESSAGING_CHANNEL_OPTIONS = [
  'baileys',
  'whatsapp-unipile',
  'linkedin',
  'linkedin-sock',
];
