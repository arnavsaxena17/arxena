// Source column → target column when names diverge after job→project rename
export const LEGACY_COLUMN_RENAMES: Record<string, string> = {
  jobsId: 'projectsId',
  jobId: 'projectId',
};

// Per-table overrides when jobId became targetProjectId (morph tables)
// Also: copyTable auto-maps fooId → targetFooId when the target column exists
export const LEGACY_COLUMN_RENAMES_BY_TABLE: Record<
  string,
  Record<string, string>
> = {
  attachment: {
    jobId: 'targetProjectId',
    type: 'fileCategory',
    authorId: 'createdByWorkspaceMemberId',
  },
  noteTarget: { jobId: 'targetProjectId' },
  taskTarget: { jobId: 'targetProjectId' },
  timelineActivity: { jobId: 'targetProjectId' },
};

// Tables whose morph FKs must be reloaded after target* remap fixes
export const LEGACY_MORPH_TARGET_TABLES = [
  'attachment',
  'noteTarget',
  'taskTarget',
  'timelineActivity',
] as const;

export const LEGACY_TABLE_RENAMES: Record<string, string> = {
  _job: '_project',
};

// Tables loaded after workspaceMember exists; order matters for FKs
export const LEGACY_CRM_LOAD_ORDER: string[] = [
  'company',
  'person',
  '_project',
  'opportunity',
  'note',
  'task',
  'attachment',
  'noteTarget',
  'taskTarget',
  'timelineActivity',
  '_candidate',
  '_candidateField',
  '_candidateFieldValue',
  '_candidateEnrichment',
  '_candidateReminder',
  '_assistantThread',
  '_clientContact',
  '_clientInterview',
  '_cvSent',
  '_interviewSchedule',
  '_prompt',
  '_recruiterInterview',
  '_screening',
  '_shortlist',
  '_textMessage',
  '_videoInterview',
  '_videoInterviewModel',
  '_videoInterviewQuestion',
  '_videoInterviewResponse',
  '_videoInterviewTemplate',
  '_whatsappMessage',
  '_workspaceMemberProfile',
  'blocklist',
  'calendarEvent',
  'calendarEventParticipant',
  'calendarChannelEventAssociation',
  'messageThread',
  'message',
  'messageParticipant',
  'messageChannelMessageAssociation',
  'workflow',
  'workflowVersion',
  'workflowRun',
];

export const WORKSPACE_ARX_KEY_COLUMNS = [
  'openaikey',
  'twilio_account_sid',
  'twilio_auth_token',
  'linkedin_url',
  'whatsapp_key',
  'linkedin_unipile_account_id',
  'whatsapp_unipile_account_id',
  'linkedin_profile_id',
  'anthropic_key',
  'facebook_whatsapp_api_token',
  'facebook_whatsapp_phone_number_id',
  'whatsapp_web_phone_number',
  'facebook_whatsapp_app_id',
  'facebook_whatsapp_asset_id',
  'is_chrome_extension_installed',
  'chrome_extension_id',
  'is_org_chart_enabled',
] as const;

export const WORKSPACE_MEMBER_ID_COLUMNS = [
  'createdByWorkspaceMemberId',
  'updatedByWorkspaceMemberId',
  'recruiterId',
  'workspaceMemberId',
  'assigneeId',
] as const;
