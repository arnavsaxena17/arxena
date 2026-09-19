import { OUTREACH_HITL_CONTEXT_TEMPLATES } from 'twenty-shared/arx';

import {
  buildOutreachConnectionNotePrompt,
  buildOutreachCreateReferralCandidatePrompt,
  buildOutreachFallbackEmailPrompt,
  buildOutreachFirstMessagePrompt,
  buildOutreachInboundSignalExtractionPrompt,
  buildOutreachMeetingBookedDetailsTemplate,
  buildOutreachMeetingReminderPrompt,
  buildOutreachNoShowPingPrompt,
  buildOutreachPostReplyFollowUpPrompt,
  buildOutreachQualifyProspectPrompt,
  buildOutreachRescheduleOfferPrompt,
  buildOutreachSalesChatDraftPrompt,
  buildOutreachStampSequenceStagePrompt,
  OUTREACH_DONT_RESPOND_SENTINEL,
} from 'src/engine/core-modules/outreach-command/prompts/outreach.prompts';
import {
  OUTREACH_ENRICH_CONTACT_SAMPLE_OUTPUT,
  OUTREACH_FETCH_LINKEDIN_MESSAGES_SAMPLE_OUTPUT,
  OUTREACH_FETCH_LINKEDIN_PROFILE_SAMPLE_OUTPUT,
  OUTREACH_GET_CALENDAR_AVAILABILITY_SAMPLE_OUTPUT,
  OUTREACH_SEARCH_COMPANIES_SAMPLE_OUTPUT,
  OUTREACH_SEARCH_PEOPLE_FOR_COMPANY_SAMPLE_OUTPUT,
  OUTREACH_SEARCH_PEOPLE_SAMPLE_OUTPUT,
  OUTREACH_UPLOAD_PROFILES_SAMPLE_OUTPUT,
  OUTREACH_UPSERT_COMPANIES_SAMPLE_OUTPUT,
  OUTREACH_VALIDATE_INBOUND_SIGNALS_SAMPLE_OUTPUT,
} from 'src/engine/core-modules/outreach-command/constants/outreach-logic-function-sample-output.const';
import {
  OUTREACH_WF_AGENT_EMAIL,
  OUTREACH_WF_AGENT_EXTRACT,
  OUTREACH_WF_AGENT_LINKEDIN,
  OUTREACH_WF_AGENT_QUALIFY,
  OUTREACH_WF_AGENT_REPLY,
  OUTREACH_WF_AI_EMAIL_OUTPUT,
  OUTREACH_WF_AI_EXTRACT_OUTPUT,
  OUTREACH_WF_AI_MESSAGE_OUTPUT,
  OUTREACH_WF_AI_QUALIFY_OUTPUT,
  OUTREACH_WF_AI_REPLY_OUTPUT,
  OUTREACH_WF_FIELD,
  OUTREACH_WF_HARVEST_PROJECT_ID,
  OUTREACH_WF_MEMBER_NO_COMPANY_STEP_ID,
  OUTREACH_WF_MEMBER_STEP_ID,
  OUTREACH_WF_ERROR_HANDLING,
  type OutreachWfFindRecordFilter,
  gtmWfAiAgentStep,
  gtmWfDatabaseEventTrigger,
  gtmWfDelayStep,
  gtmWfEntryStageTriggerFilter,
  gtmWfFilterStep,
  gtmWfFindField,
  gtmWfFindId,
  gtmWfFindRecordsStep,
  gtmWfFormStep,
  gtmWfFormDetailsTemplate,
  gtmWfIfElseStep,
  gtmWfMultiIfElseStep,
  gtmWfPreferredChannelRouterStep,
  OUTREACH_POST_REPLY_EMAIL_SUBJECT,
  gtmWfLogicFunctionStep,
  gtmWfManualTrigger,
  gtmWfMemberEmail,
  gtmWfMemberSenderProfile,
  gtmWfMemberStep,
  gtmWfMemberId,
  gtmWfSelectIsValue,
  gtmWfSendLinkedInMessageStep,
  gtmWfSendEmailStep,
  gtmWfSendWhatsappMessageStep,
  gtmWfTriggerAfter,
  gtmWfTriggerField,
  gtmWfUpdateRecordStep,
  gtmWfWebhookTrigger,
} from 'src/engine/workspace-manager/standard-objects-prefill-data/data/outreach-workflow-graph-helpers';

const IDS = {
  searchPeople: '31ece1d2-e7d3-4af6-93e3-cfd08aacd81d',
  uploadProfiles: '046369f4-3fba-4fde-81bd-7a0a68ce73ce',
  fetchAndSaveUpload: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  webhookSearchPeople: '12e8080d-8fe4-4f9c-9f6f-ca61c6f1ddba',
  webhookUploadProfiles: '137cf204-1cb1-4579-964c-2ed0a1abb687',
  searchCompanies: '6f42bcf3-9860-461e-9a90-26a513320895',
  upsertCompanies: '12ed9ad9-6f51-42d3-a038-ff4f2cabd15c',
  acceptFilter: 'cf89ad04-1bfd-4fcf-82d1-05fe1e364bc8',
  acceptFind: '0191a76e-bf48-417c-b2e2-7ce97e49edf3',
  fetchMessages: '8d620ee9-c194-4503-8e3d-8a8ba060e94b',
  fetchProfile: '4a2b0979-c2c2-4d04-9c8f-6ea2a9399cf8',
  draftFirst: '4582ca2b-2b80-4c4f-a802-7a923b296322',
  approveFirst: '4d4e9ac8-ecdd-4174-af3e-43b31971079b',
  sendFirst: 'ff764394-35a1-485c-ba86-595e1ef82171',
  waitFu1: '76e8ea56-075e-44dc-bb57-558c7b6b2dad',
  reloadFu1: '3f70efe0-e703-41bb-b770-eb5a2af625e1',
  filterFu1: '9561ea7f-508f-4c77-ab63-3885ff12327f',
  draftFu1: 'a9625050-c3a8-48d0-9b7d-e2119791d159',
  approveFu1: '894ae3fc-1035-4267-b80d-c045301e8d0c',
  sendFu1: 'ac175f1f-5560-4a3f-91a7-ebcddc4917fc',
  stampFu1: '1accba67-dfd0-47fd-bd9b-a0504e89b44e',
  waitFu2: '3f6a194c-2308-453e-a481-bdc2e357d4bb',
  reloadFu2: '1508878c-8690-4057-9e08-9a8ebb18eb2c',
  filterFu2: '31e45a3e-d11d-430f-b69c-a32d932f6ced',
  draftFu2: '86fdd033-0c9c-4ab6-b869-dcdcd5674417',
  approveFu2: '45f9b412-4a88-40b1-8787-518ae6aa52a5',
  sendFu2: 'dd27727a-1a78-40c9-af40-ec9c3adf283d',
  stampFu2: '36134a62-35ad-4da1-8363-894d97b96c3c',
  waitFu3: 'bb60a4bb-6fc2-4f18-8f88-e668063084f0',
  reloadFu3: '0446d2ac-abd7-4169-8ac8-bb195d40a7d1',
  filterFu3: 'a9325af8-b18c-46e3-a705-f95c02aa0111',
  draftFu3: 'e96f8582-a3a3-4caf-aa25-e6f9308f035f',
  approveFu3: '6add4b49-f5b5-4e50-aa37-4d40b85d4802',
  sendFu3: '0f4e1a09-93fb-477f-bd40-36e4936555a1',
  stampFu3: '4bd37dd4-e71f-4248-99d8-077bf61c9c6f',
  queuedFilter: 'd649c1e2-2c96-4ad0-bbaa-931bbd879946',
  queuedFind: 'bf5db0df-c7ec-4392-8c41-0845300ba790',
  hasCompanyIf: 'c7a10001-aaaa-4fcb-a7d8-17a7736ed045',
  findContacted: 'c7a10002-aaaa-4fcb-a7d8-17a7736ed045',
  contactedIf: 'c7a10003-aaaa-4fcb-a7d8-17a7736ed045',
  findEarlierQueued: 'c7a10004-aaaa-4fcb-a7d8-17a7736ed045',
  earlierQueuedIf: 'c7a10005-aaaa-4fcb-a7d8-17a7736ed045',
  markDeferredContacted: 'c7a10006-aaaa-4fcb-a7d8-17a7736ed045',
  markDeferredEarlierQueued: 'c7a10009-aaaa-4fcb-a7d8-17a7736ed045',
  sendConnect: 'c416d226-a466-4915-b9ab-282fb79ff044',
  sendConnectNoCompany: 'c7a1000a-aaaa-4fcb-a7d8-17a7736ed045',
  markSent: 'f2350842-a4ff-4c24-874c-9f016c20f3a9',
  waitAccept: '67f433aa-9f97-4b87-aa9e-792d23839323',
  reloadAfterWait: '69577635-4f2f-4596-8828-441c8484ad38',
  stillSent: 'a63c1a7d-b384-4a9e-9c78-dc95c0e6bc01',
  enrich: '1491491c-71c3-4ebd-9dfa-a3ee77b63e7c',
  enrichIf: '40a8ee6c-aaaa-45b7-8f8a-59342d23308f',
  draftEmail: '40a8ee6b-5ca1-45b7-8f8a-59342d23308f',
  approveEmail: 'c3662354-43e5-4b84-bb95-b8b125cd662b',
  saveEmail: 'd733bc3c-6f2c-4884-a95c-789d0d54fd28',
  sendEmail: 'c841cba1-e7e6-497d-b2ab-bf040c6f1fea',
  markEmailSent: '0983e8e3-e04a-4889-8ccd-b4229d090614',
  markFailedEnrich: '0983e8e3-bbbb-4889-8ccd-b4229d090614',
  repliedFilter: 'b876aa92-354c-43fc-a467-474dad0422ee',
  repliedFind: '2ce89d31-aaaa-4fcb-a7d8-17a7736ed045',
  findChats: '2ce89d30-8d50-4fcb-a7d8-17a7736ed045',
  calendar: '99a3378a-c6d4-43c4-bbf2-b703d4fdce09',
  extractSignals: '51a10028-aaaa-4fcb-a7d8-17a7736ed045',
  validateSignals: '51a10029-aaaa-4fcb-a7d8-17a7736ed045',
  draftReply: '55833274-116e-4522-98b3-316eac214fab',
  approveReply: 'c83e4113-c3b9-4207-8baf-e311be592bf3',
  sendReply: '47575b73-a4ae-444f-95c4-3847e850ae87',
  stampWaiting: '51a10008-aaaa-4fcb-a7d8-17a7736ed045',
  waitAfterInbound: '51a10009-aaaa-4fcb-a7d8-17a7736ed045',
  reloadAfterInboundWait: '51a1000a-aaaa-4fcb-a7d8-17a7736ed045',
  stillWaitingFilter: '51a1000b-aaaa-4fcb-a7d8-17a7736ed045',
  stampFailedAfterWait: '51a1000c-aaaa-4fcb-a7d8-17a7736ed045',
  stampFailedDontRespond: '51a10052-aaaa-4fcb-a7d8-17a7736ed045',
  // Post-reply silence cadence (after our answer, they go quiet)
  postReplyCalendar: '51a10030-aaaa-4fcb-a7d8-17a7736ed045',
  draftPostReplyFu1: '51a10031-aaaa-4fcb-a7d8-17a7736ed045',
  approvePostReplyFu1: '51a10032-aaaa-4fcb-a7d8-17a7736ed045',
  routePostReplyFu1: '51a10033-aaaa-4fcb-a7d8-17a7736ed045',
  postReplyFu1EmailBranch: '51a10034-aaaa-4fcb-a7d8-17a7736ed045',
  postReplyFu1WhatsappBranch: '51a10035-aaaa-4fcb-a7d8-17a7736ed045',
  postReplyFu1LinkedinBranch: '51a10036-aaaa-4fcb-a7d8-17a7736ed045',
  postReplyFu1EmailGroup: '51a10037-aaaa-4fcb-a7d8-17a7736ed045',
  postReplyFu1EmailFilter: '51a10038-aaaa-4fcb-a7d8-17a7736ed045',
  postReplyFu1WhatsappGroup: '51a10039-aaaa-4fcb-a7d8-17a7736ed045',
  postReplyFu1WhatsappFilter: '51a1003a-aaaa-4fcb-a7d8-17a7736ed045',
  sendPostReplyFu1Email: '51a1003b-aaaa-4fcb-a7d8-17a7736ed045',
  sendPostReplyFu1Whatsapp: '51a1003c-aaaa-4fcb-a7d8-17a7736ed045',
  sendPostReplyFu1Linkedin: '51a1003d-aaaa-4fcb-a7d8-17a7736ed045',
  waitPostReplyFu2: '51a1003e-aaaa-4fcb-a7d8-17a7736ed045',
  reloadPostReplyFu2: '51a1003f-aaaa-4fcb-a7d8-17a7736ed045',
  stillWaitingFu2Filter: '51a10040-aaaa-4fcb-a7d8-17a7736ed045',
  postReplyCalendar2: '51a10041-aaaa-4fcb-a7d8-17a7736ed045',
  draftPostReplyFu2: '51a10042-aaaa-4fcb-a7d8-17a7736ed045',
  approvePostReplyFu2: '51a10043-aaaa-4fcb-a7d8-17a7736ed045',
  routePostReplyFu2: '51a10044-aaaa-4fcb-a7d8-17a7736ed045',
  postReplyFu2EmailBranch: '51a10045-aaaa-4fcb-a7d8-17a7736ed045',
  postReplyFu2WhatsappBranch: '51a10046-aaaa-4fcb-a7d8-17a7736ed045',
  postReplyFu2LinkedinBranch: '51a10047-aaaa-4fcb-a7d8-17a7736ed045',
  postReplyFu2EmailGroup: '51a10048-aaaa-4fcb-a7d8-17a7736ed045',
  postReplyFu2EmailFilter: '51a10049-aaaa-4fcb-a7d8-17a7736ed045',
  postReplyFu2WhatsappGroup: '51a1004a-aaaa-4fcb-a7d8-17a7736ed045',
  postReplyFu2WhatsappFilter: '51a1004b-aaaa-4fcb-a7d8-17a7736ed045',
  sendPostReplyFu2Email: '51a1004c-aaaa-4fcb-a7d8-17a7736ed045',
  sendPostReplyFu2Whatsapp: '51a1004d-aaaa-4fcb-a7d8-17a7736ed045',
  sendPostReplyFu2Linkedin: '51a1004e-aaaa-4fcb-a7d8-17a7736ed045',
  waitPostReplyPark: '51a1004f-aaaa-4fcb-a7d8-17a7736ed045',
  reloadPostReplyPark: '51a10050-aaaa-4fcb-a7d8-17a7736ed045',
  stillWaitingParkFilter: '51a10051-aaaa-4fcb-a7d8-17a7736ed045',
  hasMeetingTimeIf: '51a1000d-aaaa-4fcb-a7d8-17a7736ed045',
  skipDontRespondIf: '51a1000e-aaaa-4fcb-a7d8-17a7736ed045',
  hasProspectEmailIf: '51a1000f-aaaa-4fcb-a7d8-17a7736ed045',
  sendProspectEmail: '51a10010-aaaa-4fcb-a7d8-17a7736ed045',
  hasReferralIf: '51a10011-aaaa-4fcb-a7d8-17a7736ed045',
  referralEmailBranch: '51a10012-aaaa-4fcb-a7d8-17a7736ed045',
  referralPhoneBranch: '51a10013-aaaa-4fcb-a7d8-17a7736ed045',
  referralElseBranch: '51a10014-aaaa-4fcb-a7d8-17a7736ed045',
  referralEmailGroup: '51a10015-aaaa-4fcb-a7d8-17a7736ed045',
  referralEmailFilter: '51a10016-aaaa-4fcb-a7d8-17a7736ed045',
  referralPhoneGroup: '51a10017-aaaa-4fcb-a7d8-17a7736ed045',
  referralPhoneFilter: '51a10018-aaaa-4fcb-a7d8-17a7736ed045',
  createReferral: '51a10019-aaaa-4fcb-a7d8-17a7736ed045',
  hasReferralEmailSendIf: '51a1001a-aaaa-4fcb-a7d8-17a7736ed045',
  sendReferralEmail: '51a1001b-aaaa-4fcb-a7d8-17a7736ed045',
  hasReferralPhoneSendIf: '51a1001c-aaaa-4fcb-a7d8-17a7736ed045',
  sendReferralWhatsapp: '51a1001d-aaaa-4fcb-a7d8-17a7736ed045',
  routeReplyChannelIf: '51a1001e-aaaa-4fcb-a7d8-17a7736ed045',
  replyEmailBranch: '51a1001f-aaaa-4fcb-a7d8-17a7736ed045',
  replyWhatsappBranch: '51a10020-aaaa-4fcb-a7d8-17a7736ed045',
  replyLinkedinBranch: '51a10021-aaaa-4fcb-a7d8-17a7736ed045',
  replyEmailGroup: '51a10022-aaaa-4fcb-a7d8-17a7736ed045',
  replyEmailFilter: '51a10023-aaaa-4fcb-a7d8-17a7736ed045',
  replyWhatsappGroup: '51a10024-aaaa-4fcb-a7d8-17a7736ed045',
  replyWhatsappFilter: '51a10025-aaaa-4fcb-a7d8-17a7736ed045',
  sendReplyEmail: '51a10026-aaaa-4fcb-a7d8-17a7736ed045',
  sendReplyWhatsapp: '51a10027-aaaa-4fcb-a7d8-17a7736ed045',
  meetingCreate: '4ef266df-bb2b-4457-b542-3fd9cc528e34',
  stageRouter: '60a10000-aaaa-4fcb-a7d8-17a7736ed045',
  stageBranchAccepted: '60a10001-aaaa-4fcb-a7d8-17a7736ed045',
  stageBranchReplied: '60a10002-aaaa-4fcb-a7d8-17a7736ed045',
  stageBranchElse: '60a10006-aaaa-4fcb-a7d8-17a7736ed045',
  stageGroupAccepted: '60a10101-aaaa-4fcb-a7d8-17a7736ed045',
  stageFilterAccepted: '60a10102-aaaa-4fcb-a7d8-17a7736ed045',
  stageGroupReplied: '60a10103-aaaa-4fcb-a7d8-17a7736ed045',
  stageFilterReplied: '60a10104-aaaa-4fcb-a7d8-17a7736ed045',
  stageBranchQueued: '60a10003-aaaa-4fcb-a7d8-17a7736ed045',
  stageGroupQueued: '60a10105-aaaa-4fcb-a7d8-17a7736ed045',
  stageFilterQueued: '60a10106-aaaa-4fcb-a7d8-17a7736ed045',
  // QUEUED qualify + connection note
  queuedFetchProfile: 'c7a1000b-aaaa-4fcb-a7d8-17a7736ed045',
  qualifyDraft: 'c7a1000c-aaaa-4fcb-a7d8-17a7736ed045',
  qualifyGoIf: 'c7a1000d-aaaa-4fcb-a7d8-17a7736ed045',
  stampEnrich: 'c7a1000e-aaaa-4fcb-a7d8-17a7736ed045',
  markSkippedQualify: 'c7a1000f-aaaa-4fcb-a7d8-17a7736ed045',
  draftConnectNote: 'c7a10010-aaaa-4fcb-a7d8-17a7736ed045',
  approveConnectNote: 'c7a10011-aaaa-4fcb-a7d8-17a7736ed045',
  draftConnectNoteNoCompany: 'c7a10012-aaaa-4fcb-a7d8-17a7736ed045',
  approveConnectNoteNoCompany: 'c7a10013-aaaa-4fcb-a7d8-17a7736ed045',
  // QUEUED re-entry: skip Send LinkedIn connection if already stamped
  connectionNotSentIf: 'c7a10014-aaaa-4fcb-a7d8-17a7736ed045',
  connectionNotSentNoCompanyIf: 'c7a10015-aaaa-4fcb-a7d8-17a7736ed045',
  // CONNECTION_ACCEPTED calendar before opener
  acceptCalendar: '51a1002a-aaaa-4fcb-a7d8-17a7736ed045',
  // CONNECTION_ACCEPTED: prior inbound in history → stamp REPLIED and stop
  hasInboundIf: '51a1002b-aaaa-4fcb-a7d8-17a7736ed045',
  stampRepliedFromHistory: '51a1002c-aaaa-4fcb-a7d8-17a7736ed045',
  // REPLIED meeting stamp (channel/email stamps moved to reply agent tools)
  stampMeetingBooked: '51a1002d-aaaa-4fcb-a7d8-17a7736ed045',
  // MEETING_BOOKED Step 7
  meetingBookedFind: 'c7a10020-aaaa-4fcb-a7d8-17a7736ed045',
  reminderDelay: 'c7a10021-aaaa-4fcb-a7d8-17a7736ed045',
  draftReminder: 'c7a10022-aaaa-4fcb-a7d8-17a7736ed045',
  approveReminder: 'c7a10023-aaaa-4fcb-a7d8-17a7736ed045',
  sendReminder: 'c7a10024-aaaa-4fcb-a7d8-17a7736ed045',
  waitToMeeting: 'c7a10025-aaaa-4fcb-a7d8-17a7736ed045',
  draftNoShow: 'c7a10026-aaaa-4fcb-a7d8-17a7736ed045',
  approveNoShow: 'c7a10027-aaaa-4fcb-a7d8-17a7736ed045',
  sendNoShow: 'c7a10028-aaaa-4fcb-a7d8-17a7736ed045',
  waitNextDay: 'c7a10029-aaaa-4fcb-a7d8-17a7736ed045',
  draftReschedule: 'c7a1002a-aaaa-4fcb-a7d8-17a7736ed045',
  approveReschedule: 'c7a1002b-aaaa-4fcb-a7d8-17a7736ed045',
  sendReschedule: 'c7a1002c-aaaa-4fcb-a7d8-17a7736ed045',
  stampStalled: 'c7a1002d-aaaa-4fcb-a7d8-17a7736ed045',
  stageBranchMeetingBooked: '60a10004-aaaa-4fcb-a7d8-17a7736ed045',
  stageGroupMeetingBooked: '60a10107-aaaa-4fcb-a7d8-17a7736ed045',
  stageFilterMeetingBooked: '60a10108-aaaa-4fcb-a7d8-17a7736ed045',
  // Person identity loads (after each candidate FIND)
  acceptPersonFind: 'c7a10201-aaaa-4fcb-a7d8-17a7736ed045',
  repliedPersonFind: 'c7a10202-aaaa-4fcb-a7d8-17a7736ed045',
  reloadAfterInboundWaitPersonFind: 'c7a10203-aaaa-4fcb-a7d8-17a7736ed045',
  reloadPostReplyFu2PersonFind: 'c7a10204-aaaa-4fcb-a7d8-17a7736ed045',
  queuedPersonFind: 'c7a10206-aaaa-4fcb-a7d8-17a7736ed045',
  reloadAfterWaitPersonFind: 'c7a10207-aaaa-4fcb-a7d8-17a7736ed045',
  meetingBookedPersonFind: 'c7a10208-aaaa-4fcb-a7d8-17a7736ed045',
  reloadFu1PersonFind: 'c7a10209-aaaa-4fcb-a7d8-17a7736ed045',
  reloadFu2PersonFind: 'c7a1020a-aaaa-4fcb-a7d8-17a7736ed045',
  reloadFu3PersonFind: 'c7a1020b-aaaa-4fcb-a7d8-17a7736ed045',
} as const;

export const OUTREACH_SEQUENCER_STEP_IDS = IDS;

export type OutreachSequencerGraphOptions = {
  useLlmConnectionNote: boolean;
  humanInTheLoop: boolean;
  whatsappEnabled: boolean;
  meetingFollowUpEnabled: boolean;
  checkDeduplicationPerCompany: boolean;
};

export const DEFAULT_OUTREACH_SEQUENCER_GRAPH_OPTIONS: OutreachSequencerGraphOptions =
  {
    useLlmConnectionNote: true,
    humanInTheLoop: true,
    whatsappEnabled: true,
    meetingFollowUpEnabled: true,
    checkDeduplicationPerCompany: false,
  };

const resolveOutreachSequencerGraphOptions = (
  options?: Partial<OutreachSequencerGraphOptions>,
): OutreachSequencerGraphOptions => ({
  ...DEFAULT_OUTREACH_SEQUENCER_GRAPH_OPTIONS,
  ...options,
});

// HITL uses approve.editedBody; automated sends the draft message directly.
const hitlOrDraftMessage = ({
  draftId,
  approveId,
  humanInTheLoop,
}: {
  draftId: string;
  approveId: string;
  humanInTheLoop: boolean;
}) =>
  humanInTheLoop ? `{{${approveId}.editedBody}}` : `{{${draftId}.message}}`;

export const inferOutreachSequencerGraphOptionsFromSteps = (
  steps: Array<{ id?: string; type?: string }> | null | undefined,
  _trigger?: { type?: string } | null,
): OutreachSequencerGraphOptions => {
  const stepIds = new Set(
    (steps ?? [])
      .map((step) => step.id)
      .filter((stepId): stepId is string => typeof stepId === 'string'),
  );

  return {
    useLlmConnectionNote: stepIds.has(IDS.draftConnectNote),
    humanInTheLoop:
      stepIds.has(IDS.approveFirst) || stepIds.has(IDS.approveReply),
    whatsappEnabled: stepIds.has(IDS.sendReplyWhatsapp),
    meetingFollowUpEnabled: stepIds.has(IDS.meetingBookedFind),
    checkDeduplicationPerCompany: stepIds.has(IDS.hasCompanyIf),
  };
};

const senderJson = () => gtmWfMemberSenderProfile();
const prospectEnrichment = (findId: string) =>
  gtmWfFindField(findId, 'outreachProspectEnrichment');

const candidateFind = (id: string, name: string, nextStepIds: string[]) =>
  gtmWfFindRecordsStep({
    id,
    name,
    objectName: 'candidate',
    fieldMetadataId: OUTREACH_WF_FIELD.candidateId,
    filterValue: gtmWfTriggerAfter('id'),
    filterLabel: 'Id',
    nextStepIds,
  });

// Identity (LinkedIn / email / phone / title) lives on person — load after candidate.
const personFind = (
  id: string,
  name: string,
  candidateFindId: string,
  nextStepIds: string[],
) =>
  gtmWfFindRecordsStep({
    id,
    name,
    objectName: 'person',
    fieldMetadataId: OUTREACH_WF_FIELD.personId,
    filterValue: gtmWfFindField(candidateFindId, 'peopleId'),
    filterLabel: 'Id',
    nextStepIds,
  });

const CONTACTED_COMPANY_SIBLING_STAGES = [
  'CONNECTION_SENT',
  'CONNECTION_ACCEPTED',
  'CONNECTION_IGNORED',
  'PROFILE_CHECKED',
  'WARM_PATH',
  'COMMENTED',
  'EMAIL_ENRICHING',
  'EMAIL_SENT',
  'INMAIL_SENT',
  'WHATSAPP_SENT',
  'REPLIED',
  'WAITING_REPLY',
  'NEGOTIATING',
  'MEETING_BOOKED',
  'FAILED_ENRICH',
  'FAILED_NO_REPLY',
];

const companySiblingFilters = (
  extra: OutreachWfFindRecordFilter[],
): OutreachWfFindRecordFilter[] => [
  {
    fieldMetadataId: OUTREACH_WF_FIELD.jobCompanyName,
    filterValue: gtmWfFindField(
      IDS.queuedPersonFind,
      OUTREACH_WF_FIELD.jobCompanyNamePath,
    ),
    filterType: 'TEXT',
    filterLabel: 'Job Company Name',
    filterOperand: 'CONTAINS',
  },
  {
    fieldMetadataId: OUTREACH_WF_FIELD.projectId,
    filterValue: gtmWfFindField(IDS.queuedFind, 'projectId'),
    filterType: 'UUID',
    filterLabel: 'Project',
    filterOperand: 'IS',
  },
  {
    fieldMetadataId: OUTREACH_WF_FIELD.candidateId,
    filterValue: gtmWfFindId(IDS.queuedFind),
    filterType: 'UUID',
    filterLabel: 'Id',
    filterOperand: 'IS_NOT',
  },
  ...extra,
];

const linkedinDraftPrompt = (
  findId: string,
  kind: 'opener' | 'fu1' | 'fu2' | 'fu3',
) =>
  buildOutreachFirstMessagePrompt({
    senderJson: senderJson(),
    prospectEnrichmentJson: prospectEnrichment(findId),
    chatHistory: `{{${IDS.fetchMessages}.text}}`,
    calendarSlots: `{{${IDS.acceptCalendar}.slots}}`,
    kind,
  });

const followUpSteps = ({
  n,
  findId,
  personFindId,
  filterId,
  draftId,
  approveId,
  sendId,
  stampId,
  waitId,
  nextFindId,
  isLast,
  humanInTheLoop,
}: {
  n: 1 | 2 | 3;
  findId: string;
  personFindId: string;
  filterId: string;
  draftId: string;
  approveId: string;
  sendId: string;
  stampId: string;
  waitId?: string;
  nextFindId?: string;
  isLast: boolean;
  humanInTheLoop: boolean;
}) => [
  candidateFind(findId, `Reload candidate before follow-up ${n}`, [
    personFindId,
  ]),
  personFind(personFindId, `Load Person (follow-up ${n})`, findId, [filterId]),
  gtmWfFilterStep({
    id: filterId,
    name: `No reply yet (follow-up ${n})`,
    stepOutputKey: gtmWfFindField(findId, 'outreachSequenceStage'),
    value: 'CONNECTION_ACCEPTED',
    nextStepIds: [draftId],
  }),
  gtmWfAiAgentStep({
    id: draftId,
    name: `Draft LinkedIn follow-up ${n}`,
    prompt: linkedinDraftPrompt(findId, `fu${n}` as 'fu1' | 'fu2' | 'fu3'),
    agentId: OUTREACH_WF_AGENT_LINKEDIN,
    outputSchema: OUTREACH_WF_AI_MESSAGE_OUTPUT,
    nextStepIds: [humanInTheLoop ? approveId : sendId],
  }),
  ...(humanInTheLoop
    ? [
        gtmWfFormStep({
          id: approveId,
          name: `Approve follow-up ${n}`,
          editedBodyValue: `{{${draftId}.message}}`,
          contextTemplate: OUTREACH_HITL_CONTEXT_TEMPLATES.linkedInFollowUp(n),
          detailsTemplate: gtmWfFormDetailsTemplate({
            findId,
            personFindId,
            draftStepId: draftId,
          }),
          nextStepIds: [sendId],
        }),
      ]
    : []),
  gtmWfSendLinkedInMessageStep({
    id: sendId,
    name: `Send follow-up ${n}`,
    body: hitlOrDraftMessage({ draftId, approveId, humanInTheLoop }),
    candidateId: gtmWfFindId(findId),
    linkedinProfileId: gtmWfFindField(
      personFindId,
      OUTREACH_WF_FIELD.linkedinProfileIdPath,
    ),
    linkedinUrl: gtmWfFindField(
      personFindId,
      OUTREACH_WF_FIELD.linkedinLinkUrlPath,
    ),
    nextStepIds: [stampId],
  }),
  gtmWfUpdateRecordStep({
    id: stampId,
    name: `Stamp follow-up ${n}`,
    objectRecordId: gtmWfFindId(findId),
    objectRecord: isLast
      ? {
          linkedinFollowUpCount: n,
          outreachSequenceStage: 'FAILED_NO_REPLY',
        }
      : { linkedinFollowUpCount: n },
    nextStepIds: waitId ? [waitId] : undefined,
  }),
  ...(waitId && nextFindId
    ? [
        gtmWfDelayStep({
          id: waitId,
          name: `Wait 7 days before follow-up ${n + 1}`,
          days: 7,
          nextStepIds: [nextFindId],
        }),
      ]
    : []),
];

// CONNECTION_ACCEPTED entry: LinkedIn opener plus the three follow-ups.
// Reads the shared member/profile load, so it carries no member steps of its own.
// If fetch-linkedin-messages already has an inbound turn (manual thread mid-journey),
// stamp REPLIED and stop so candidate.upserted re-enters the replied branch.
const acceptedBranchSteps = ({
  humanInTheLoop,
}: {
  humanInTheLoop: boolean;
}) => [
  candidateFind(IDS.acceptFind, 'Load Candidate', [IDS.acceptPersonFind]),
  personFind(IDS.acceptPersonFind, 'Load Person', IDS.acceptFind, [
    IDS.fetchMessages,
  ]),
  gtmWfLogicFunctionStep({
    id: IDS.fetchMessages,
    name: 'Fetch LinkedIn messages',
    logicFunctionId: '__LF_fetch-linkedin-messages__',
    logicFunctionInput: {
      candidateId: gtmWfFindId(IDS.acceptFind),
      workspaceMemberId: gtmWfMemberId(),
    },
    sampleOutput: OUTREACH_FETCH_LINKEDIN_MESSAGES_SAMPLE_OUTPUT,
    nextStepIds: [IDS.hasInboundIf],
  }),
  gtmWfIfElseStep({
    id: IDS.hasInboundIf,
    name: 'Prior inbound reply in history?',
    stepOutputKey: `{{${IDS.fetchMessages}.hasInboundReply}}`,
    value: 'true',
    type: 'BOOLEAN',
    operand: 'IS',
    ifNextStepIds: [IDS.stampRepliedFromHistory],
    elseNextStepIds: [IDS.fetchProfile],
  }),
  gtmWfUpdateRecordStep({
    id: IDS.stampRepliedFromHistory,
    name: 'Mark REPLIED — prior inbound in history',
    objectRecordId: gtmWfFindId(IDS.acceptFind),
    objectRecord: {
      outreachSequenceStage: 'REPLIED',
    },
  }),
  gtmWfLogicFunctionStep({
    id: IDS.fetchProfile,
    name: 'Fetch LinkedIn profile',
    logicFunctionId: '__LF_fetch-linkedin-profile__',
    logicFunctionInput: {
      linkedinUrl: gtmWfFindField(
        IDS.acceptPersonFind,
        OUTREACH_WF_FIELD.linkedinLinkUrlPath,
      ),
      linkedinProfileId: gtmWfFindField(
        IDS.acceptPersonFind,
        OUTREACH_WF_FIELD.linkedinProfileIdPath,
      ),
      candidateId: gtmWfFindId(IDS.acceptFind),
      workspaceMemberId: gtmWfMemberId(),
    },
    sampleOutput: OUTREACH_FETCH_LINKEDIN_PROFILE_SAMPLE_OUTPUT,
    nextStepIds: [IDS.acceptCalendar],
  }),
  gtmWfLogicFunctionStep({
    id: IDS.acceptCalendar,
    name: 'Get calendar availability (opener)',
    logicFunctionId: '__LF_get-calendar-availability__',
    logicFunctionInput: {
      days: 5,
      slotMinutes: 20,
      workspaceMemberId: gtmWfMemberId(),
    },
    sampleOutput: OUTREACH_GET_CALENDAR_AVAILABILITY_SAMPLE_OUTPUT,
    nextStepIds: [IDS.draftFirst],
  }),
  gtmWfAiAgentStep({
    id: IDS.draftFirst,
    name: 'Draft first LinkedIn message',
    prompt: linkedinDraftPrompt(IDS.acceptFind, 'opener'),
    agentId: OUTREACH_WF_AGENT_LINKEDIN,
    outputSchema: OUTREACH_WF_AI_MESSAGE_OUTPUT,
    nextStepIds: [humanInTheLoop ? IDS.approveFirst : IDS.sendFirst],
  }),
  ...(humanInTheLoop
    ? [
        gtmWfFormStep({
          id: IDS.approveFirst,
          name: 'Approve / edit first message',
          editedBodyValue: `{{${IDS.draftFirst}.message}}`,
          contextTemplate: OUTREACH_HITL_CONTEXT_TEMPLATES.firstLinkedInMessage,
          detailsTemplate: gtmWfFormDetailsTemplate({
            findId: IDS.acceptFind,
            personFindId: IDS.acceptPersonFind,
            draftStepId: IDS.draftFirst,
          }),
          nextStepIds: [IDS.sendFirst],
        }),
      ]
    : []),
  gtmWfSendLinkedInMessageStep({
    id: IDS.sendFirst,
    name: 'Send LinkedIn message',
    body: hitlOrDraftMessage({
      draftId: IDS.draftFirst,
      approveId: IDS.approveFirst,
      humanInTheLoop,
    }),
    candidateId: gtmWfFindId(IDS.acceptFind),
    linkedinProfileId: gtmWfFindField(
      IDS.acceptPersonFind,
      OUTREACH_WF_FIELD.linkedinProfileIdPath,
    ),
    linkedinUrl: gtmWfFindField(
      IDS.acceptPersonFind,
      OUTREACH_WF_FIELD.linkedinLinkUrlPath,
    ),
    nextStepIds: [IDS.waitFu1],
  }),
  gtmWfDelayStep({
    id: IDS.waitFu1,
    name: 'Wait 7 days before follow-up',
    days: 7,
    nextStepIds: [IDS.reloadFu1],
  }),
  ...followUpSteps({
    n: 1,
    findId: IDS.reloadFu1,
    personFindId: IDS.reloadFu1PersonFind,
    filterId: IDS.filterFu1,
    draftId: IDS.draftFu1,
    approveId: IDS.approveFu1,
    sendId: IDS.sendFu1,
    stampId: IDS.stampFu1,
    waitId: IDS.waitFu2,
    nextFindId: IDS.reloadFu2,
    isLast: false,
    humanInTheLoop,
  }),
  ...followUpSteps({
    n: 2,
    findId: IDS.reloadFu2,
    personFindId: IDS.reloadFu2PersonFind,
    filterId: IDS.filterFu2,
    draftId: IDS.draftFu2,
    approveId: IDS.approveFu2,
    sendId: IDS.sendFu2,
    stampId: IDS.stampFu2,
    waitId: IDS.waitFu3,
    nextFindId: IDS.reloadFu3,
    isLast: false,
    humanInTheLoop,
  }),
  ...followUpSteps({
    n: 3,
    findId: IDS.reloadFu3,
    personFindId: IDS.reloadFu3PersonFind,
    filterId: IDS.filterFu3,
    draftId: IDS.draftFu3,
    approveId: IDS.approveFu3,
    sendId: IDS.sendFu3,
    stampId: IDS.stampFu3,
    isLast: true,
    humanInTheLoop,
  }),
];

// REPLIED entry: sales closer, channel routing, referral fan-out, meeting invite.
const repliedBranchSteps = ({
  humanInTheLoop,
  whatsappEnabled,
  meetingFollowUpEnabled,
}: {
  humanInTheLoop: boolean;
  whatsappEnabled: boolean;
  meetingFollowUpEnabled: boolean;
}) => {
  const replyBody = hitlOrDraftMessage({
    draftId: IDS.draftReply,
    approveId: IDS.approveReply,
    humanInTheLoop,
  });
  const postReplyFu1Body = hitlOrDraftMessage({
    draftId: IDS.draftPostReplyFu1,
    approveId: IDS.approvePostReplyFu1,
    humanInTheLoop,
  });
  const postReplyFu2Body = hitlOrDraftMessage({
    draftId: IDS.draftPostReplyFu2,
    approveId: IDS.approvePostReplyFu2,
    humanInTheLoop,
  });
  const afterMeetingCreateNextStepIds = meetingFollowUpEnabled
    ? [IDS.stampMeetingBooked]
    : [IDS.stampWaiting];

  return [
    candidateFind(IDS.repliedFind, 'Load Candidate', [IDS.repliedPersonFind]),
    personFind(IDS.repliedPersonFind, 'Load Person', IDS.repliedFind, [
      IDS.findChats,
    ]),
    gtmWfFindRecordsStep({
      id: IDS.findChats,
      name: 'Load inbound WhatsApp / LinkedIn / email messages',
      objectName: 'chatMessage',
      fieldMetadataId: OUTREACH_WF_FIELD.chatCandidateId,
      filterValue: gtmWfFindId(IDS.repliedFind),
      filterLabel: 'Candidate',
      filterType: 'UUID',
      limit: 20,
      orderBy: {
        recordSorts: [
          {
            id: `${IDS.findChats.slice(0, 8)}-0000-4000-8000-00000000s001`,
            fieldMetadataId: OUTREACH_WF_FIELD.chatCreatedAt,
            direction: 'DESC',
          },
        ],
        gqlOperationOrderBy: [{ createdAt: 'DescNullsLast' }],
      },
      nextStepIds: [IDS.calendar],
    }),
    gtmWfLogicFunctionStep({
      id: IDS.calendar,
      name: 'Get calendar availability',
      logicFunctionId: '__LF_get-calendar-availability__',
      logicFunctionInput: {
        days: 5,
        slotMinutes: 20,
        workspaceMemberId: gtmWfMemberId(),
      },
      sampleOutput: OUTREACH_GET_CALENDAR_AVAILABILITY_SAMPLE_OUTPUT,
      nextStepIds: [IDS.extractSignals],
    }),
    gtmWfAiAgentStep({
      id: IDS.extractSignals,
      name: 'Extract inbound signals',
      prompt: buildOutreachInboundSignalExtractionPrompt({
        transcript: `{{${IDS.findChats}.text}}`,
        lastChannel: `{{${IDS.findChats}.first.channel}}`,
        slots: `{{${IDS.calendar}.text}}`,
      }),
      agentId: OUTREACH_WF_AGENT_EXTRACT,
      outputSchema: OUTREACH_WF_AI_EXTRACT_OUTPUT,
      nextStepIds: [IDS.validateSignals],
    }),
    // Grounds the extraction before any branch reads it: a hallucinated contact or
    // an invented time would otherwise create records and send messages.
    gtmWfLogicFunctionStep({
      id: IDS.validateSignals,
      name: 'Validate inbound signals',
      logicFunctionId: '__LF_validate-inbound-signals__',
      logicFunctionInput: {
        transcript: `{{${IDS.findChats}.text}}`,
        slots: `{{${IDS.calendar}.slots}}`,
        lastInboundChannel: `{{${IDS.findChats}.first.channel}}`,
        preferredChannel: gtmWfFindField(
          IDS.repliedPersonFind,
          OUTREACH_WF_FIELD.outreachPreferredChannelPath,
        ),
        acceptedSlotIndex: `{{${IDS.extractSignals}.acceptedSlotIndex}}`,
        requestedChannelSwitch: `{{${IDS.extractSignals}.requestedChannelSwitch}}`,
        prospectEmail: `{{${IDS.extractSignals}.prospectEmail}}`,
        referralName: `{{${IDS.extractSignals}.referralName}}`,
        referralEmail: `{{${IDS.extractSignals}.referralEmail}}`,
        referralPhone: `{{${IDS.extractSignals}.referralPhone}}`,
        shouldNotRespond: `{{${IDS.extractSignals}.shouldNotRespond}}`,
      },
      sampleOutput: OUTREACH_VALIDATE_INBOUND_SIGNALS_SAMPLE_OUTPUT,
      // Reply agent stamps preferred channel / email via candidate CRUD tools.
      nextStepIds: [IDS.draftReply],
    }),
    gtmWfAiAgentStep({
      id: IDS.draftReply,
      name: 'Draft sales reply',
      prompt: buildOutreachSalesChatDraftPrompt({
        name: gtmWfFindField(IDS.repliedFind, 'name'),
        title: gtmWfFindField(
          IDS.repliedPersonFind,
          OUTREACH_WF_FIELD.jobTitlePath,
        ),
        transcript: `{{${IDS.findChats}.text}}`,
        slots: `{{${IDS.calendar}.text}}`,
        conversationStage: gtmWfFindField(
          IDS.repliedFind,
          'outreachConversationStage',
        ),
        replyChannel: `{{${IDS.validateSignals}.replyChannel}}`,
        confirmedStartsAt: `{{${IDS.validateSignals}.startsAt}}`,
        referralName: `{{${IDS.validateSignals}.referralName}}`,
        prospectEmail: `{{${IDS.validateSignals}.prospectEmail}}`,
        preferredChannelToStamp: `{{${IDS.validateSignals}.preferredChannelToStamp}}`,
        shouldNotRespond: `{{${IDS.validateSignals}.shouldNotRespond}}`,
        candidateId: gtmWfFindId(IDS.repliedFind),
        senderJson: senderJson(),
        prospectEnrichmentJson: prospectEnrichment(IDS.repliedFind),
      }),
      agentId: OUTREACH_WF_AGENT_REPLY,
      outputSchema: OUTREACH_WF_AI_REPLY_OUTPUT,
      nextStepIds: [humanInTheLoop ? IDS.approveReply : IDS.skipDontRespondIf],
    }),
    // HITL is WhatsApp-approvable only: approve + editedBody. Classification and
    // secondary copy stay on validateSignals / draftReply for branch reads.
    ...(humanInTheLoop
      ? [
          gtmWfFormStep({
            id: IDS.approveReply,
            name: 'Approve / edit reply',
            editedBodyValue: `{{${IDS.draftReply}.message}}`,
            contextTemplate: OUTREACH_HITL_CONTEXT_TEMPLATES.inboundSalesReply,
            detailsTemplate: gtmWfFormDetailsTemplate({
              findId: IDS.repliedFind,
              personFindId: IDS.repliedPersonFind,
              draftStepId: IDS.draftReply,
              extra: [
                buildOutreachMeetingBookedDetailsTemplate({
                  name: gtmWfFindField(IDS.repliedFind, 'name'),
                  inbound: `{{${IDS.findChats}.text}}`,
                }),
                `Channel: {{${IDS.validateSignals}.replyChannel}}`,
                `Starts: {{${IDS.validateSignals}.startsAt}}`,
                `Referral: {{${IDS.validateSignals}.referralName}}`,
              ],
            }),
            nextStepIds: [IDS.skipDontRespondIf],
          }),
        ]
      : []),
    gtmWfIfElseStep({
      id: IDS.skipDontRespondIf,
      name: 'Skip send if #DONTRESPOND#',
      stepOutputKey: replyBody,
      value: OUTREACH_DONT_RESPOND_SENTINEL,
      type: 'TEXT',
      operand: 'CONTAINS',
      // Opt-out: park immediately — do not enter post-reply follow-up cadence.
      ifNextStepIds: [IDS.stampFailedDontRespond],
      elseNextStepIds: [IDS.routeReplyChannelIf],
    }),
    gtmWfPreferredChannelRouterStep({
      id: IDS.routeReplyChannelIf,
      name: 'Reply on last inbound channel',
      channelStepOutputKey: `{{${IDS.validateSignals}.replyChannel}}`,
      emailBranch: {
        id: IDS.replyEmailBranch,
        filterGroupId: IDS.replyEmailGroup,
        filterId: IDS.replyEmailFilter,
        nextStepIds: [IDS.sendReplyEmail],
      },
      ...(whatsappEnabled
        ? {
            whatsappBranch: {
              id: IDS.replyWhatsappBranch,
              filterGroupId: IDS.replyWhatsappGroup,
              filterId: IDS.replyWhatsappFilter,
              nextStepIds: [IDS.sendReplyWhatsapp],
            },
          }
        : {}),
      linkedinBranch: {
        id: IDS.replyLinkedinBranch,
        nextStepIds: [IDS.sendReply],
      },
    }),
    gtmWfSendEmailStep({
      id: IDS.sendReplyEmail,
      name: 'Send reply by email',
      to: gtmWfFindField(
        IDS.repliedPersonFind,
        OUTREACH_WF_FIELD.emailsPrimaryPath,
      ),
      subject: `{{${IDS.draftReply}.emailSubject}}`,
      body: replyBody,
      nextStepIds: [
        IDS.hasProspectEmailIf,
        IDS.hasReferralIf,
        IDS.hasMeetingTimeIf,
      ],
    }),
    ...(whatsappEnabled
      ? [
          gtmWfSendWhatsappMessageStep({
            id: IDS.sendReplyWhatsapp,
            name: 'Send reply on WhatsApp',
            phone: gtmWfFindField(
              IDS.repliedPersonFind,
              OUTREACH_WF_FIELD.phonesPrimaryPath,
            ),
            body: replyBody,
            candidateId: gtmWfFindId(IDS.repliedFind),
            nextStepIds: [
              IDS.hasProspectEmailIf,
              IDS.hasReferralIf,
              IDS.hasMeetingTimeIf,
            ],
          }),
        ]
      : []),
    gtmWfSendLinkedInMessageStep({
      id: IDS.sendReply,
      name: 'Send reply on LinkedIn',
      body: replyBody,
      candidateId: gtmWfFindId(IDS.repliedFind),
      linkedinProfileId: gtmWfFindField(
        IDS.repliedPersonFind,
        OUTREACH_WF_FIELD.linkedinProfileIdPath,
      ),
      linkedinUrl: gtmWfFindField(
        IDS.repliedPersonFind,
        OUTREACH_WF_FIELD.linkedinLinkUrlPath,
      ),
      nextStepIds: [
        IDS.hasProspectEmailIf,
        IDS.hasReferralIf,
        IDS.hasMeetingTimeIf,
      ],
    }),
    gtmWfIfElseStep({
      id: IDS.hasProspectEmailIf,
      name: 'Send details by email?',
      stepOutputKey: `{{${IDS.validateSignals}.prospectEmail}}`,
      value: '',
      type: 'TEXT',
      operand: 'IS_NOT_EMPTY',
      ifNextStepIds: [IDS.sendProspectEmail],
      elseNextStepIds: [],
    }),
    gtmWfSendEmailStep({
      id: IDS.sendProspectEmail,
      name: 'Email details to prospect',
      to: `{{${IDS.validateSignals}.prospectEmail}}`,
      subject: `{{${IDS.draftReply}.emailSubject}}`,
      body: `{{${IDS.draftReply}.emailBody}}`,
    }),
    gtmWfMultiIfElseStep({
      id: IDS.hasReferralIf,
      name: 'Referred someone else?',
      branches: [
        {
          id: IDS.referralEmailBranch,
          filterGroupId: IDS.referralEmailGroup,
          filterId: IDS.referralEmailFilter,
          stepOutputKey: `{{${IDS.validateSignals}.referralEmail}}`,
          value: '',
          type: 'TEXT',
          operand: 'IS_NOT_EMPTY',
          nextStepIds: [IDS.createReferral],
        },
        {
          id: IDS.referralPhoneBranch,
          filterGroupId: IDS.referralPhoneGroup,
          filterId: IDS.referralPhoneFilter,
          stepOutputKey: `{{${IDS.validateSignals}.referralPhone}}`,
          value: '',
          type: 'TEXT',
          operand: 'IS_NOT_EMPTY',
          nextStepIds: [IDS.createReferral],
        },
        {
          id: IDS.referralElseBranch,
          nextStepIds: [],
        },
      ],
    }),
    gtmWfAiAgentStep({
      id: IDS.createReferral,
      name: 'Create referred candidate',
      prompt: buildOutreachCreateReferralCandidatePrompt({
        referralName: `{{${IDS.validateSignals}.referralName}}`,
        referralEmail: `{{${IDS.validateSignals}.referralEmail}}`,
        referralPhone: `{{${IDS.validateSignals}.referralPhone}}`,
        jobCompanyName: gtmWfFindField(
          IDS.repliedPersonFind,
          OUTREACH_WF_FIELD.jobCompanyNamePath,
        ),
        projectId: gtmWfFindField(IDS.repliedFind, 'projectId'),
      }),
      agentId: OUTREACH_WF_AGENT_REPLY,
      outputSchema: OUTREACH_WF_AI_REPLY_OUTPUT,
      nextStepIds: whatsappEnabled
        ? [IDS.hasReferralEmailSendIf, IDS.hasReferralPhoneSendIf]
        : [IDS.hasReferralEmailSendIf],
    }),
    gtmWfIfElseStep({
      id: IDS.hasReferralEmailSendIf,
      name: 'Referral has email?',
      stepOutputKey: `{{${IDS.validateSignals}.referralEmail}}`,
      value: '',
      type: 'TEXT',
      operand: 'IS_NOT_EMPTY',
      ifNextStepIds: [IDS.sendReferralEmail],
      elseNextStepIds: [],
    }),
    gtmWfSendEmailStep({
      id: IDS.sendReferralEmail,
      name: 'Email referred person',
      to: `{{${IDS.validateSignals}.referralEmail}}`,
      subject: `{{${IDS.draftReply}.emailSubject}}`,
      body: `{{${IDS.draftReply}.referralMessage}}`,
    }),
    ...(whatsappEnabled
      ? [
          gtmWfIfElseStep({
            id: IDS.hasReferralPhoneSendIf,
            name: 'Referral has phone?',
            stepOutputKey: `{{${IDS.validateSignals}.referralPhone}}`,
            value: '',
            type: 'TEXT',
            operand: 'IS_NOT_EMPTY',
            ifNextStepIds: [IDS.sendReferralWhatsapp],
            elseNextStepIds: [],
          }),
          gtmWfSendWhatsappMessageStep({
            id: IDS.sendReferralWhatsapp,
            name: 'WhatsApp referred person',
            phone: `{{${IDS.validateSignals}.referralPhone}}`,
            body: `{{${IDS.draftReply}.referralMessage}}`,
            candidateId: `{{${IDS.createReferral}.referralCandidateId}}`,
          }),
        ]
      : []),
    gtmWfIfElseStep({
      id: IDS.hasMeetingTimeIf,
      name: 'Meeting time filled?',
      stepOutputKey: `{{${IDS.validateSignals}.startsAt}}`,
      value: '',
      type: 'TEXT',
      operand: 'IS_NOT_EMPTY',
      ifNextStepIds: [IDS.meetingCreate],
      elseNextStepIds: [IDS.stampWaiting],
    }),
    {
      id: IDS.meetingCreate,
      name: 'Create calendar invite',
      type: 'CREATE_CALENDAR_EVENT',
      valid: true,
      settings: {
        input: {
          title: `Walkthrough — ${gtmWfFindField(IDS.repliedPersonFind, OUTREACH_WF_FIELD.jobCompanyNamePath)}`,
          endsAt: `{{${IDS.validateSignals}.endsAt}}`,
          location: '',
          startsAt: `{{${IDS.validateSignals}.startsAt}}`,
          timeZone: '',
          attendees: `${gtmWfFindField(IDS.repliedPersonFind, OUTREACH_WF_FIELD.emailsPrimaryPath)}, ${gtmWfMemberEmail()}`,
          isFullDay: false,
          description: `{{${OUTREACH_WF_MEMBER_STEP_ID}.first.outreachSenderProfile.meeting.agenda_template}}`,
          addConferencing: true,
          sendInvitations: true,
          connectedAccountId: '',
        },
        outputSchema: {},
        errorHandlingOptions: OUTREACH_WF_ERROR_HANDLING,
      },
      nextStepIds: afterMeetingCreateNextStepIds,
    },
    ...(meetingFollowUpEnabled
      ? [
          gtmWfAiAgentStep({
            id: IDS.stampMeetingBooked,
            name: 'Mark MEETING_BOOKED',
            prompt: buildOutreachStampSequenceStagePrompt({
              candidateId: gtmWfFindId(IDS.repliedFind),
              outreachSequenceStage: 'MEETING_BOOKED',
            }),
            agentId: OUTREACH_WF_AGENT_REPLY,
            outputSchema: OUTREACH_WF_AI_REPLY_OUTPUT,
          }),
        ]
      : []),
    gtmWfAiAgentStep({
      id: IDS.stampWaiting,
      name: 'Mark WAITING_REPLY',
      prompt: buildOutreachStampSequenceStagePrompt({
        candidateId: gtmWfFindId(IDS.repliedFind),
        outreachSequenceStage: 'WAITING_REPLY',
      }),
      agentId: OUTREACH_WF_AGENT_REPLY,
      outputSchema: OUTREACH_WF_AI_REPLY_OUTPUT,
      nextStepIds: [IDS.waitAfterInbound],
    }),
    // Post-reply silence cadence: they replied once, we answered, then quiet.
    // FU1 at +5d, FU2 at +7d more, then park. A new inbound restamps REPLIED and
    // aborts these filters. Opt-out (#DONTRESPOND#) skips this path entirely.
    gtmWfDelayStep({
      id: IDS.waitAfterInbound,
      name: 'Wait 5 days after our reply',
      days: 5,
      nextStepIds: [IDS.reloadAfterInboundWait],
    }),
    candidateFind(IDS.reloadAfterInboundWait, 'Reload after post-reply wait', [
      IDS.reloadAfterInboundWaitPersonFind,
    ]),
    personFind(
      IDS.reloadAfterInboundWaitPersonFind,
      'Load Person (post-reply wait)',
      IDS.reloadAfterInboundWait,
      [IDS.stillWaitingFilter],
    ),
    gtmWfFilterStep({
      id: IDS.stillWaitingFilter,
      name: 'Still WAITING_REPLY (before FU1)',
      stepOutputKey: gtmWfFindField(
        IDS.reloadAfterInboundWait,
        'outreachSequenceStage',
      ),
      value: 'WAITING_REPLY',
      nextStepIds: [IDS.postReplyCalendar],
    }),
    gtmWfLogicFunctionStep({
      id: IDS.postReplyCalendar,
      name: 'Get calendar for post-reply FU1',
      logicFunctionId: '__LF_get-calendar-availability__',
      logicFunctionInput: {
        days: 5,
        slotMinutes: 20,
        workspaceMemberId: gtmWfMemberId(),
      },
      sampleOutput: OUTREACH_GET_CALENDAR_AVAILABILITY_SAMPLE_OUTPUT,
      nextStepIds: [IDS.draftPostReplyFu1],
    }),
    gtmWfAiAgentStep({
      id: IDS.draftPostReplyFu1,
      name: 'Draft post-reply follow-up 1',
      prompt: buildOutreachPostReplyFollowUpPrompt({
        senderJson: senderJson(),
        prospectEnrichmentJson: prospectEnrichment(IDS.reloadAfterInboundWait),
        chatHistory: `{{${IDS.findChats}.text}}`,
        calendarSlots: `{{${IDS.postReplyCalendar}.slots}}`,
        kind: 'fu1',
      }),
      agentId: OUTREACH_WF_AGENT_LINKEDIN,
      outputSchema: OUTREACH_WF_AI_MESSAGE_OUTPUT,
      nextStepIds: [
        humanInTheLoop ? IDS.approvePostReplyFu1 : IDS.routePostReplyFu1,
      ],
    }),
    ...(humanInTheLoop
      ? [
          gtmWfFormStep({
            id: IDS.approvePostReplyFu1,
            name: 'Approve post-reply follow-up 1',
            editedBodyValue: `{{${IDS.draftPostReplyFu1}.message}}`,
            contextTemplate: OUTREACH_HITL_CONTEXT_TEMPLATES.postReplyFollowUp1,
            detailsTemplate: gtmWfFormDetailsTemplate({
              findId: IDS.reloadAfterInboundWait,
              personFindId: IDS.reloadAfterInboundWaitPersonFind,
              draftStepId: IDS.draftPostReplyFu1,
            }),
            nextStepIds: [IDS.routePostReplyFu1],
          }),
        ]
      : []),
    gtmWfPreferredChannelRouterStep({
      id: IDS.routePostReplyFu1,
      name: 'Send post-reply FU1 on preferred channel',
      channelStepOutputKey: gtmWfFindField(
        IDS.reloadAfterInboundWaitPersonFind,
        OUTREACH_WF_FIELD.outreachPreferredChannelPath,
      ),
      emailBranch: {
        id: IDS.postReplyFu1EmailBranch,
        filterGroupId: IDS.postReplyFu1EmailGroup,
        filterId: IDS.postReplyFu1EmailFilter,
        nextStepIds: [IDS.sendPostReplyFu1Email],
      },
      ...(whatsappEnabled
        ? {
            whatsappBranch: {
              id: IDS.postReplyFu1WhatsappBranch,
              filterGroupId: IDS.postReplyFu1WhatsappGroup,
              filterId: IDS.postReplyFu1WhatsappFilter,
              nextStepIds: [IDS.sendPostReplyFu1Whatsapp],
            },
          }
        : {}),
      linkedinBranch: {
        id: IDS.postReplyFu1LinkedinBranch,
        nextStepIds: [IDS.sendPostReplyFu1Linkedin],
      },
    }),
    gtmWfSendEmailStep({
      id: IDS.sendPostReplyFu1Email,
      name: 'Send post-reply FU1 by email',
      to: gtmWfFindField(
        IDS.reloadAfterInboundWaitPersonFind,
        OUTREACH_WF_FIELD.emailsPrimaryPath,
      ),
      subject: OUTREACH_POST_REPLY_EMAIL_SUBJECT,
      body: postReplyFu1Body,
      nextStepIds: [IDS.waitPostReplyFu2],
    }),
    ...(whatsappEnabled
      ? [
          gtmWfSendWhatsappMessageStep({
            id: IDS.sendPostReplyFu1Whatsapp,
            name: 'Send post-reply FU1 on WhatsApp',
            phone: gtmWfFindField(
              IDS.reloadAfterInboundWaitPersonFind,
              OUTREACH_WF_FIELD.phonesPrimaryPath,
            ),
            body: postReplyFu1Body,
            candidateId: gtmWfFindId(IDS.reloadAfterInboundWait),
            nextStepIds: [IDS.waitPostReplyFu2],
          }),
        ]
      : []),
    gtmWfSendLinkedInMessageStep({
      id: IDS.sendPostReplyFu1Linkedin,
      name: 'Send post-reply FU1 on LinkedIn',
      body: postReplyFu1Body,
      candidateId: gtmWfFindId(IDS.reloadAfterInboundWait),
      linkedinProfileId: gtmWfFindField(
        IDS.reloadAfterInboundWaitPersonFind,
        OUTREACH_WF_FIELD.linkedinProfileIdPath,
      ),
      linkedinUrl: gtmWfFindField(
        IDS.reloadAfterInboundWaitPersonFind,
        OUTREACH_WF_FIELD.linkedinLinkUrlPath,
      ),
      nextStepIds: [IDS.waitPostReplyFu2],
    }),
    gtmWfDelayStep({
      id: IDS.waitPostReplyFu2,
      name: 'Wait 7 days before post-reply FU2',
      days: 7,
      nextStepIds: [IDS.reloadPostReplyFu2],
    }),
    candidateFind(IDS.reloadPostReplyFu2, 'Reload before post-reply FU2', [
      IDS.reloadPostReplyFu2PersonFind,
    ]),
    personFind(
      IDS.reloadPostReplyFu2PersonFind,
      'Load Person (post-reply FU2)',
      IDS.reloadPostReplyFu2,
      [IDS.stillWaitingFu2Filter],
    ),
    gtmWfFilterStep({
      id: IDS.stillWaitingFu2Filter,
      name: 'Still WAITING_REPLY (before FU2)',
      stepOutputKey: gtmWfFindField(
        IDS.reloadPostReplyFu2,
        'outreachSequenceStage',
      ),
      value: 'WAITING_REPLY',
      nextStepIds: [IDS.postReplyCalendar2],
    }),
    gtmWfLogicFunctionStep({
      id: IDS.postReplyCalendar2,
      name: 'Get calendar for post-reply FU2',
      logicFunctionId: '__LF_get-calendar-availability__',
      logicFunctionInput: {
        days: 5,
        slotMinutes: 20,
        workspaceMemberId: gtmWfMemberId(),
      },
      sampleOutput: OUTREACH_GET_CALENDAR_AVAILABILITY_SAMPLE_OUTPUT,
      nextStepIds: [IDS.draftPostReplyFu2],
    }),
    gtmWfAiAgentStep({
      id: IDS.draftPostReplyFu2,
      name: 'Draft post-reply follow-up 2',
      prompt: buildOutreachPostReplyFollowUpPrompt({
        senderJson: senderJson(),
        prospectEnrichmentJson: prospectEnrichment(IDS.reloadPostReplyFu2),
        chatHistory: `{{${IDS.findChats}.text}}`,
        calendarSlots: `{{${IDS.postReplyCalendar2}.slots}}`,
        kind: 'fu2',
      }),
      agentId: OUTREACH_WF_AGENT_LINKEDIN,
      outputSchema: OUTREACH_WF_AI_MESSAGE_OUTPUT,
      nextStepIds: [
        humanInTheLoop ? IDS.approvePostReplyFu2 : IDS.routePostReplyFu2,
      ],
    }),
    ...(humanInTheLoop
      ? [
          gtmWfFormStep({
            id: IDS.approvePostReplyFu2,
            name: 'Approve post-reply follow-up 2',
            editedBodyValue: `{{${IDS.draftPostReplyFu2}.message}}`,
            contextTemplate:
              OUTREACH_HITL_CONTEXT_TEMPLATES.postReplyFollowUp2Last,
            detailsTemplate: gtmWfFormDetailsTemplate({
              findId: IDS.reloadPostReplyFu2,
              personFindId: IDS.reloadPostReplyFu2PersonFind,
              draftStepId: IDS.draftPostReplyFu2,
            }),
            nextStepIds: [IDS.routePostReplyFu2],
          }),
        ]
      : []),
    gtmWfPreferredChannelRouterStep({
      id: IDS.routePostReplyFu2,
      name: 'Send post-reply FU2 on preferred channel',
      channelStepOutputKey: gtmWfFindField(
        IDS.reloadPostReplyFu2PersonFind,
        OUTREACH_WF_FIELD.outreachPreferredChannelPath,
      ),
      emailBranch: {
        id: IDS.postReplyFu2EmailBranch,
        filterGroupId: IDS.postReplyFu2EmailGroup,
        filterId: IDS.postReplyFu2EmailFilter,
        nextStepIds: [IDS.sendPostReplyFu2Email],
      },
      ...(whatsappEnabled
        ? {
            whatsappBranch: {
              id: IDS.postReplyFu2WhatsappBranch,
              filterGroupId: IDS.postReplyFu2WhatsappGroup,
              filterId: IDS.postReplyFu2WhatsappFilter,
              nextStepIds: [IDS.sendPostReplyFu2Linkedin],
            },
          }
        : {}),
      linkedinBranch: {
        id: IDS.postReplyFu2LinkedinBranch,
        nextStepIds: [IDS.sendPostReplyFu2Linkedin],
      },
    }),
    gtmWfSendEmailStep({
      id: IDS.sendPostReplyFu2Email,
      name: 'Send post-reply FU2 by email',
      to: gtmWfFindField(
        IDS.reloadPostReplyFu2PersonFind,
        OUTREACH_WF_FIELD.emailsPrimaryPath,
      ),
      subject: OUTREACH_POST_REPLY_EMAIL_SUBJECT,
      body: postReplyFu2Body,
      nextStepIds: [IDS.waitPostReplyPark],
    }),
    ...(whatsappEnabled
      ? [
          gtmWfSendWhatsappMessageStep({
            id: IDS.sendPostReplyFu2Whatsapp,
            name: 'Send post-reply FU2 on WhatsApp',
            phone: gtmWfFindField(
              IDS.reloadPostReplyFu2PersonFind,
              OUTREACH_WF_FIELD.phonesPrimaryPath,
            ),
            body: postReplyFu2Body,
            candidateId: gtmWfFindId(IDS.reloadPostReplyFu2),
            nextStepIds: [IDS.waitPostReplyPark],
          }),
        ]
      : []),
    gtmWfSendLinkedInMessageStep({
      id: IDS.sendPostReplyFu2Linkedin,
      name: 'Send post-reply FU2 on LinkedIn',
      body: postReplyFu2Body,
      candidateId: gtmWfFindId(IDS.reloadPostReplyFu2),
      linkedinProfileId: gtmWfFindField(
        IDS.reloadPostReplyFu2PersonFind,
        OUTREACH_WF_FIELD.linkedinProfileIdPath,
      ),
      linkedinUrl: gtmWfFindField(
        IDS.reloadPostReplyFu2PersonFind,
        OUTREACH_WF_FIELD.linkedinLinkUrlPath,
      ),
      nextStepIds: [IDS.waitPostReplyPark],
    }),
    gtmWfDelayStep({
      id: IDS.waitPostReplyPark,
      name: 'Wait 7 days before parking post-reply',
      days: 7,
      nextStepIds: [IDS.reloadPostReplyPark],
    }),
    candidateFind(IDS.reloadPostReplyPark, 'Reload before park post-reply', [
      IDS.stillWaitingParkFilter,
    ]),
    gtmWfFilterStep({
      id: IDS.stillWaitingParkFilter,
      name: 'Still WAITING_REPLY (park)',
      stepOutputKey: gtmWfFindField(
        IDS.reloadPostReplyPark,
        'outreachSequenceStage',
      ),
      value: 'WAITING_REPLY',
      nextStepIds: [IDS.stampFailedAfterWait],
    }),
    gtmWfUpdateRecordStep({
      id: IDS.stampFailedAfterWait,
      name: 'Mark FAILED_NO_REPLY',
      objectRecordId: gtmWfFindId(IDS.reloadPostReplyPark),
      objectRecord: { outreachSequenceStage: 'FAILED_NO_REPLY' },
    }),
    gtmWfUpdateRecordStep({
      id: IDS.stampFailedDontRespond,
      name: 'Mark FAILED_NO_REPLY (opt-out)',
      objectRecordId: gtmWfFindId(IDS.repliedFind),
      objectRecord: { outreachSequenceStage: 'FAILED_NO_REPLY' },
    }),
  ];
};

// QUEUED entry: qualify/enrich, optional company dedupe, connection note,
// LinkedIn connection, then email fallback.
// hoistedMember=true means workspace member is loaded once above the stage router,
// so both send-connection variants read the shared load and the duplicate
// "no company" member step disappears.
const queuedBranchSteps = ({
  hoistedMember,
  useLlmConnectionNote,
  humanInTheLoop,
  checkDeduplicationPerCompany,
}: {
  hoistedMember: boolean;
  useLlmConnectionNote: boolean;
  humanInTheLoop: boolean;
  checkDeduplicationPerCompany: boolean;
}) => {
  const companyConnectEntryId = useLlmConnectionNote
    ? IDS.draftConnectNote
    : IDS.connectionNotSentIf;
  const noCompanyConnectEntryId = useLlmConnectionNote
    ? IDS.draftConnectNoteNoCompany
    : IDS.connectionNotSentNoCompanyIf;
  const connectMessage = !useLlmConnectionNote
    ? ''
    : hitlOrDraftMessage({
        draftId: IDS.draftConnectNote,
        approveId: IDS.approveConnectNote,
        humanInTheLoop,
      });
  const connectMessageNoCompany = !useLlmConnectionNote
    ? ''
    : hitlOrDraftMessage({
        draftId: IDS.draftConnectNoteNoCompany,
        approveId: IDS.approveConnectNoteNoCompany,
        humanInTheLoop,
      });

  return [
    candidateFind(IDS.queuedFind, 'Load Candidate', [IDS.queuedPersonFind]),
    personFind(
      IDS.queuedPersonFind,
      'Load Person',
      IDS.queuedFind,
      hoistedMember ? [IDS.queuedFetchProfile] : [OUTREACH_WF_MEMBER_STEP_ID],
    ),
    ...(hoistedMember
      ? []
      : [
          gtmWfMemberStep([IDS.queuedFetchProfile]),
          ...(checkDeduplicationPerCompany
            ? [
                gtmWfMemberStep(
                  useLlmConnectionNote
                    ? [IDS.draftConnectNoteNoCompany]
                    : [IDS.connectionNotSentNoCompanyIf],
                  {
                    memberStepId: OUTREACH_WF_MEMBER_NO_COMPANY_STEP_ID,
                    memberStepName: 'Load workspace member (no company)',
                  },
                ),
              ]
            : []),
        ]),
    gtmWfLogicFunctionStep({
      id: IDS.queuedFetchProfile,
      name: 'Fetch LinkedIn profile (qualify)',
      logicFunctionId: '__LF_fetch-linkedin-profile__',
      logicFunctionInput: {
        linkedinUrl: gtmWfFindField(
          IDS.queuedPersonFind,
          OUTREACH_WF_FIELD.linkedinLinkUrlPath,
        ),
        linkedinProfileId: gtmWfFindField(
          IDS.queuedPersonFind,
          OUTREACH_WF_FIELD.linkedinProfileIdPath,
        ),
        candidateId: gtmWfFindId(IDS.queuedFind),
        workspaceMemberId: gtmWfMemberId(),
      },
      sampleOutput: OUTREACH_FETCH_LINKEDIN_PROFILE_SAMPLE_OUTPUT,
      nextStepIds: [IDS.qualifyDraft],
    }),
    gtmWfAiAgentStep({
      id: IDS.qualifyDraft,
      name: 'Qualify prospect',
      prompt: buildOutreachQualifyProspectPrompt({
        senderJson: senderJson(),
        profile: [
          `About: {{${IDS.queuedFetchProfile}.about}}`,
          `Skills: {{${IDS.queuedFetchProfile}.skills}}`,
        ].join('\n'),
        posts: '',
        crm: [
          `Name: ${gtmWfFindField(IDS.queuedFind, 'name')}`,
          `Title: ${gtmWfFindField(IDS.queuedPersonFind, OUTREACH_WF_FIELD.jobTitlePath)}`,
        ].join('\n'),
      }),
      agentId: OUTREACH_WF_AGENT_QUALIFY,
      outputSchema: OUTREACH_WF_AI_QUALIFY_OUTPUT,
      nextStepIds: [IDS.stampEnrich],
    }),
    gtmWfUpdateRecordStep({
      id: IDS.stampEnrich,
      name: 'Stamp prospect enrichment',
      objectRecordId: gtmWfFindId(IDS.queuedFind),
      objectRecord: {
        outreachProspectEnrichment: {
          go: `{{${IDS.qualifyDraft}.go}}`,
          score: `{{${IDS.qualifyDraft}.score}}`,
          segment: `{{${IDS.qualifyDraft}.segment}}`,
          reason: `{{${IDS.qualifyDraft}.reason}}`,
          first_name: `{{${IDS.qualifyDraft}.first_name}}`,
          honorific: `{{${IDS.qualifyDraft}.honorific}}`,
          company_short: `{{${IDS.qualifyDraft}.company_short}}`,
          industry_phrase: `{{${IDS.qualifyDraft}.industry_phrase}}`,
          hooks: `{{${IDS.qualifyDraft}.hooks}}`,
          likely_systems: `{{${IDS.qualifyDraft}.likely_systems}}`,
          matching_problem_statement: `{{${IDS.qualifyDraft}.matching_problem_statement}}`,
          referral_source: `{{${IDS.qualifyDraft}.referral_source}}`,
        },
      },
      nextStepIds: [IDS.qualifyGoIf],
    }),
    gtmWfIfElseStep({
      id: IDS.qualifyGoIf,
      name: 'Qualify go?',
      stepOutputKey: `{{${IDS.qualifyDraft}.go}}`,
      value: 'true',
      type: 'TEXT',
      operand: 'CONTAINS',
      // When company dedupe is off, skip has-company / sibling checks and go
      // straight to the single connection-note path.
      ifNextStepIds: [
        checkDeduplicationPerCompany ? IDS.hasCompanyIf : companyConnectEntryId,
      ],
      elseNextStepIds: [IDS.markSkippedQualify],
    }),
    gtmWfUpdateRecordStep({
      id: IDS.markSkippedQualify,
      name: 'Mark DEFERRED — skipped qualify',
      objectRecordId: gtmWfFindId(IDS.queuedFind),
      objectRecord: {
        outreachSequenceStage: 'DEFERRED',
      },
    }),
    ...(checkDeduplicationPerCompany
      ? [
          gtmWfIfElseStep({
            id: IDS.hasCompanyIf,
            name: 'Has company name?',
            stepOutputKey: gtmWfFindField(
              IDS.queuedPersonFind,
              OUTREACH_WF_FIELD.jobCompanyNamePath,
            ),
            value: '',
            type: 'TEXT',
            operand: 'IS_NOT_EMPTY',
            ifNextStepIds: [IDS.findContacted],
            // Own draft path — must not share draftConnectNote with company path, or
            // IF_ELSE skip kills the later join from earlierQueuedIf.
            elseNextStepIds: hoistedMember
              ? [noCompanyConnectEntryId]
              : [OUTREACH_WF_MEMBER_NO_COMPANY_STEP_ID],
          }),
          gtmWfFindRecordsStep({
            id: IDS.findContacted,
            name: 'Find contacted company sibling',
            objectName: 'candidate',
            filters: companySiblingFilters([
              {
                fieldMetadataId: OUTREACH_WF_FIELD.outreachSequenceStage,
                filterValue: JSON.stringify(CONTACTED_COMPANY_SIBLING_STAGES),
                filterType: 'SELECT',
                filterLabel: 'Outreach Sequence Stage',
                filterOperand: 'IS',
              },
            ]),
            nextStepIds: [IDS.contactedIf],
          }),
          gtmWfIfElseStep({
            id: IDS.contactedIf,
            name: 'Company already contacted?',
            stepOutputKey: gtmWfFindId(IDS.findContacted),
            value: '',
            type: 'TEXT',
            operand: 'IS_NOT_EMPTY',
            ifNextStepIds: [IDS.markDeferredContacted],
            elseNextStepIds: [IDS.findEarlierQueued],
          }),
          gtmWfFindRecordsStep({
            id: IDS.findEarlierQueued,
            name: 'Find earlier QUEUED sibling',
            objectName: 'candidate',
            filters: companySiblingFilters([
              {
                fieldMetadataId: OUTREACH_WF_FIELD.outreachSequenceStage,
                filterValue: gtmWfSelectIsValue('QUEUED'),
                filterType: 'SELECT',
                filterLabel: 'Outreach Sequence Stage',
                filterOperand: 'IS',
              },
              {
                fieldMetadataId: OUTREACH_WF_FIELD.createdAt,
                filterValue: gtmWfFindField(IDS.queuedFind, 'createdAt'),
                filterType: 'DATE_TIME',
                filterLabel: 'Creation date',
                filterOperand: 'IS_BEFORE',
              },
            ]),
            nextStepIds: [IDS.earlierQueuedIf],
          }),
          gtmWfIfElseStep({
            id: IDS.earlierQueuedIf,
            name: 'Earlier QUEUED sibling?',
            stepOutputKey: gtmWfFindId(IDS.findEarlierQueued),
            value: '',
            type: 'TEXT',
            operand: 'IS_NOT_EMPTY',
            ifNextStepIds: [IDS.markDeferredEarlierQueued],
            elseNextStepIds: [companyConnectEntryId],
          }),
          // Unique DEFERRED terminals — shared id would be cascade-skipped when the
          // other IF_ELSE's unused branch is pruned.
          gtmWfUpdateRecordStep({
            id: IDS.markDeferredContacted,
            name: 'Mark DEFERRED — company already contacted',
            objectRecordId: gtmWfFindId(IDS.queuedFind),
            objectRecord: {
              outreachSequenceStage: 'DEFERRED',
            },
          }),
          gtmWfUpdateRecordStep({
            id: IDS.markDeferredEarlierQueued,
            name: 'Mark DEFERRED — earlier QUEUED sibling',
            objectRecordId: gtmWfFindId(IDS.queuedFind),
            objectRecord: {
              outreachSequenceStage: 'DEFERRED',
            },
          }),
        ]
      : []),
    ...(useLlmConnectionNote
      ? [
          gtmWfAiAgentStep({
            id: IDS.draftConnectNote,
            name: 'Draft connection note',
            prompt: buildOutreachConnectionNotePrompt({
              senderJson: senderJson(),
              // Stamped on candidate after Qualify — Test can fill from the record
              // (or default {}). Do not chip qualifyDraft.* (AI_AGENT predecessors
              // are not hydrated by AI agent Test).
              prospectEnrichmentJson: prospectEnrichment(IDS.queuedFind),
            }),
            agentId: OUTREACH_WF_AGENT_LINKEDIN,
            outputSchema: OUTREACH_WF_AI_MESSAGE_OUTPUT,
            nextStepIds: [
              humanInTheLoop ? IDS.approveConnectNote : IDS.connectionNotSentIf,
            ],
          }),
          ...(humanInTheLoop
            ? [
                gtmWfFormStep({
                  id: IDS.approveConnectNote,
                  name: 'Approve connection note',
                  editedBodyValue: `{{${IDS.draftConnectNote}.message}}`,
                  contextTemplate:
                    OUTREACH_HITL_CONTEXT_TEMPLATES.linkedInConnectionNote,
                  detailsTemplate: gtmWfFormDetailsTemplate({
                    findId: IDS.queuedFind,
                    personFindId: IDS.queuedPersonFind,
                    draftStepId: IDS.draftConnectNote,
                  }),
                  nextStepIds: [IDS.connectionNotSentIf],
                }),
              ]
            : []),
          ...(checkDeduplicationPerCompany
            ? [
                gtmWfAiAgentStep({
                  id: IDS.draftConnectNoteNoCompany,
                  name: 'Draft connection note (no company)',
                  prompt: buildOutreachConnectionNotePrompt({
                    senderJson: senderJson(),
                    prospectEnrichmentJson: prospectEnrichment(IDS.queuedFind),
                  }),
                  agentId: OUTREACH_WF_AGENT_LINKEDIN,
                  outputSchema: OUTREACH_WF_AI_MESSAGE_OUTPUT,
                  nextStepIds: [
                    humanInTheLoop
                      ? IDS.approveConnectNoteNoCompany
                      : IDS.connectionNotSentNoCompanyIf,
                  ],
                }),
                ...(humanInTheLoop
                  ? [
                      gtmWfFormStep({
                        id: IDS.approveConnectNoteNoCompany,
                        name: 'Approve connection note (no company)',
                        editedBodyValue: `{{${IDS.draftConnectNoteNoCompany}.message}}`,
                        contextTemplate:
                          OUTREACH_HITL_CONTEXT_TEMPLATES.linkedInConnectionNote,
                        detailsTemplate: gtmWfFormDetailsTemplate({
                          findId: IDS.queuedFind,
                          personFindId: IDS.queuedPersonFind,
                          draftStepId: IDS.draftConnectNoteNoCompany,
                        }),
                        nextStepIds: [IDS.connectionNotSentNoCompanyIf],
                      }),
                    ]
                  : []),
              ]
            : []),
        ]
      : []),
    // Under candidate.upserted, a later QUEUED restamp (deferred resume / re-enroll)
    // would otherwise send a second connection. Gate on outreachAnalytics.connectionSentAt.
    gtmWfIfElseStep({
      id: IDS.connectionNotSentIf,
      name: 'Connection not yet sent?',
      stepOutputKey: gtmWfFindField(
        IDS.queuedFind,
        'outreachAnalytics.connectionSentAt',
      ),
      value: '',
      type: 'TEXT',
      operand: 'IS_EMPTY',
      ifNextStepIds: [IDS.sendConnect],
      elseNextStepIds: [],
    }),
    ...(checkDeduplicationPerCompany
      ? [
          gtmWfIfElseStep({
            id: IDS.connectionNotSentNoCompanyIf,
            name: 'Connection not yet sent? (no company)',
            stepOutputKey: gtmWfFindField(
              IDS.queuedFind,
              'outreachAnalytics.connectionSentAt',
            ),
            value: '',
            type: 'TEXT',
            operand: 'IS_EMPTY',
            ifNextStepIds: [IDS.sendConnectNoCompany],
            elseNextStepIds: [],
          }),
        ]
      : []),
    {
      id: IDS.sendConnect,
      name: 'Send LinkedIn connection',
      type: 'SEND_LINKEDIN_CONNECTION_REQUEST',
      valid: true,
      settings: {
        input: {
          message: connectMessage,
          linkedinUrl: gtmWfFindField(
            IDS.queuedPersonFind,
            OUTREACH_WF_FIELD.linkedinLinkUrlPath,
          ),
          linkedinProfileId: gtmWfFindField(
            IDS.queuedPersonFind,
            OUTREACH_WF_FIELD.linkedinProfileIdPath,
          ),
          candidateId: gtmWfFindId(IDS.queuedFind),
          workspaceMemberId: gtmWfMemberId(),
        },
        outputSchema: {},
        errorHandlingOptions: OUTREACH_WF_ERROR_HANDLING,
      },
      nextStepIds: [IDS.markSent],
    },
    ...(checkDeduplicationPerCompany
      ? [
          {
            id: IDS.sendConnectNoCompany,
            name: 'Send LinkedIn connection (no company)',
            type: 'SEND_LINKEDIN_CONNECTION_REQUEST',
            valid: true,
            settings: {
              input: {
                message: connectMessageNoCompany,
                linkedinUrl: gtmWfFindField(
                  IDS.queuedPersonFind,
                  OUTREACH_WF_FIELD.linkedinLinkUrlPath,
                ),
                linkedinProfileId: gtmWfFindField(
                  IDS.queuedPersonFind,
                  OUTREACH_WF_FIELD.linkedinProfileIdPath,
                ),
                candidateId: gtmWfFindId(IDS.queuedFind),
                workspaceMemberId: hoistedMember
                  ? gtmWfMemberId()
                  : gtmWfMemberId(OUTREACH_WF_MEMBER_NO_COMPANY_STEP_ID),
              },
              outputSchema: {},
              errorHandlingOptions: OUTREACH_WF_ERROR_HANDLING,
            },
            nextStepIds: [IDS.markSent],
          },
        ]
      : []),
    gtmWfUpdateRecordStep({
      id: IDS.markSent,
      name: 'Mark CONNECTION_SENT',
      objectRecordId: gtmWfFindId(IDS.queuedFind),
      objectRecord: {
        outreachSequenceStage: 'CONNECTION_SENT',
      },
      nextStepIds: [IDS.waitAccept],
    }),
    gtmWfDelayStep({
      id: IDS.waitAccept,
      name: 'Wait 3 days for accept',
      days: 3,
      nextStepIds: [IDS.reloadAfterWait],
    }),
    candidateFind(IDS.reloadAfterWait, 'Reload candidate after wait', [
      IDS.reloadAfterWaitPersonFind,
    ]),
    personFind(
      IDS.reloadAfterWaitPersonFind,
      'Load Person (after wait)',
      IDS.reloadAfterWait,
      [IDS.stillSent],
    ),
    gtmWfFilterStep({
      id: IDS.stillSent,
      name: 'Still CONNECTION_SENT',
      stepOutputKey: gtmWfFindField(
        IDS.reloadAfterWait,
        'outreachSequenceStage',
      ),
      value: 'CONNECTION_SENT',
      nextStepIds: [IDS.enrich],
    }),
    gtmWfLogicFunctionStep({
      id: IDS.enrich,
      name: 'Enrich email',
      logicFunctionId: '__LF_enrich-contact__',
      logicFunctionInput: {
        candidateId: gtmWfFindId(IDS.reloadAfterWait),
        linkedinUrl: gtmWfFindField(
          IDS.reloadAfterWaitPersonFind,
          OUTREACH_WF_FIELD.linkedinLinkUrlPath,
        ),
        wantEmail: true,
        wantPhone: false,
      },
      sampleOutput: OUTREACH_ENRICH_CONTACT_SAMPLE_OUTPUT,
      nextStepIds: [IDS.enrichIf],
    }),
    gtmWfIfElseStep({
      id: IDS.enrichIf,
      name: 'Email found?',
      stepOutputKey: `{{${IDS.enrich}.email}}`,
      value: '',
      type: 'TEXT',
      operand: 'IS_NOT_EMPTY',
      ifNextStepIds: [IDS.draftEmail],
      elseNextStepIds: [IDS.markFailedEnrich],
    }),
    gtmWfAiAgentStep({
      id: IDS.draftEmail,
      name: 'Draft fallback email',
      prompt: buildOutreachFallbackEmailPrompt({
        name: gtmWfFindField(IDS.reloadAfterWait, 'name'),
        title: gtmWfFindField(
          IDS.reloadAfterWaitPersonFind,
          OUTREACH_WF_FIELD.jobTitlePath,
        ),
      }),
      agentId: OUTREACH_WF_AGENT_EMAIL,
      outputSchema: OUTREACH_WF_AI_EMAIL_OUTPUT,
      nextStepIds: [humanInTheLoop ? IDS.approveEmail : IDS.saveEmail],
    }),
    ...(humanInTheLoop
      ? [
          gtmWfFormStep({
            id: IDS.approveEmail,
            name: 'Approve / edit email',
            editedBodyValue: `{{${IDS.draftEmail}.message}}`,
            contextTemplate: OUTREACH_HITL_CONTEXT_TEMPLATES.fallbackEmail,
            detailsTemplate: gtmWfFormDetailsTemplate({
              findId: IDS.reloadAfterWait,
              personFindId: IDS.reloadAfterWaitPersonFind,
              draftStepId: IDS.draftEmail,
            }),
            nextStepIds: [IDS.saveEmail],
          }),
        ]
      : []),
    {
      id: IDS.saveEmail,
      name: 'Save email draft',
      type: 'DRAFT_EMAIL',
      valid: true,
      settings: {
        input: {
          body: hitlOrDraftMessage({
            draftId: IDS.draftEmail,
            approveId: IDS.approveEmail,
            humanInTheLoop,
          }),
          subject: `{{${IDS.draftEmail}.subject}}`,
          recipients: {
            cc: '',
            to: `{{${IDS.enrich}.email}}`,
            bcc: '',
          },
          connectedAccountId: '',
        },
        outputSchema: {},
        errorHandlingOptions: OUTREACH_WF_ERROR_HANDLING,
      },
      nextStepIds: [IDS.sendEmail],
    },
    {
      id: IDS.sendEmail,
      name: 'Send email',
      type: 'SEND_EMAIL',
      valid: true,
      settings: {
        input: {
          body: hitlOrDraftMessage({
            draftId: IDS.draftEmail,
            approveId: IDS.approveEmail,
            humanInTheLoop,
          }),
          subject: `{{${IDS.draftEmail}.subject}}`,
          recipients: {
            cc: '',
            to: `{{${IDS.enrich}.email}}`,
            bcc: '',
          },
          connectedAccountId: '',
        },
        outputSchema: {},
        errorHandlingOptions: OUTREACH_WF_ERROR_HANDLING,
      },
      nextStepIds: [IDS.markEmailSent],
    },
    gtmWfUpdateRecordStep({
      id: IDS.markEmailSent,
      name: 'Mark EMAIL_SENT',
      objectRecordId: gtmWfFindId(IDS.reloadAfterWait),
      objectRecord: { outreachSequenceStage: 'EMAIL_SENT' },
    }),
    gtmWfUpdateRecordStep({
      id: IDS.markFailedEnrich,
      name: 'Mark FAILED_ENRICH',
      objectRecordId: gtmWfFindId(IDS.reloadAfterWait),
      objectRecord: { outreachSequenceStage: 'FAILED_ENRICH' },
    }),
  ];
};

// MEETING_BOOKED entry: day-before reminder, no-show ping, reschedule, then stall.
const meetingBookedBranchSteps = ({
  humanInTheLoop,
}: {
  humanInTheLoop: boolean;
}) => [
  candidateFind(IDS.meetingBookedFind, 'Load Candidate (meeting booked)', [
    IDS.meetingBookedPersonFind,
  ]),
  personFind(
    IDS.meetingBookedPersonFind,
    'Load Person (meeting booked)',
    IDS.meetingBookedFind,
    [IDS.reminderDelay],
  ),
  gtmWfDelayStep({
    id: IDS.reminderDelay,
    name: 'Wait 1 day before reminder',
    days: 1,
    nextStepIds: [IDS.draftReminder],
  }),
  gtmWfAiAgentStep({
    id: IDS.draftReminder,
    name: 'Draft meeting reminder',
    prompt: buildOutreachMeetingReminderPrompt({
      senderJson: senderJson(),
      name: gtmWfFindField(IDS.meetingBookedFind, 'name'),
    }),
    agentId: OUTREACH_WF_AGENT_LINKEDIN,
    outputSchema: OUTREACH_WF_AI_MESSAGE_OUTPUT,
    nextStepIds: [humanInTheLoop ? IDS.approveReminder : IDS.sendReminder],
  }),
  ...(humanInTheLoop
    ? [
        gtmWfFormStep({
          id: IDS.approveReminder,
          name: 'Approve meeting reminder',
          editedBodyValue: `{{${IDS.draftReminder}.message}}`,
          contextTemplate: OUTREACH_HITL_CONTEXT_TEMPLATES.meetingReminder,
          detailsTemplate: gtmWfFormDetailsTemplate({
            findId: IDS.meetingBookedFind,
            personFindId: IDS.meetingBookedPersonFind,
            draftStepId: IDS.draftReminder,
          }),
          nextStepIds: [IDS.sendReminder],
        }),
      ]
    : []),
  gtmWfSendLinkedInMessageStep({
    id: IDS.sendReminder,
    name: 'Send meeting reminder',
    body: hitlOrDraftMessage({
      draftId: IDS.draftReminder,
      approveId: IDS.approveReminder,
      humanInTheLoop,
    }),
    candidateId: gtmWfFindId(IDS.meetingBookedFind),
    linkedinProfileId: gtmWfFindField(
      IDS.meetingBookedPersonFind,
      OUTREACH_WF_FIELD.linkedinProfileIdPath,
    ),
    linkedinUrl: gtmWfFindField(
      IDS.meetingBookedPersonFind,
      OUTREACH_WF_FIELD.linkedinLinkUrlPath,
    ),
    nextStepIds: [IDS.waitToMeeting],
  }),
  gtmWfDelayStep({
    id: IDS.waitToMeeting,
    name: 'Wait 1 day after meeting',
    days: 1,
    nextStepIds: [IDS.draftNoShow],
  }),
  gtmWfAiAgentStep({
    id: IDS.draftNoShow,
    name: 'Draft no-show ping',
    prompt: buildOutreachNoShowPingPrompt({
      senderJson: senderJson(),
      name: gtmWfFindField(IDS.meetingBookedFind, 'name'),
    }),
    agentId: OUTREACH_WF_AGENT_LINKEDIN,
    outputSchema: OUTREACH_WF_AI_MESSAGE_OUTPUT,
    nextStepIds: [humanInTheLoop ? IDS.approveNoShow : IDS.sendNoShow],
  }),
  ...(humanInTheLoop
    ? [
        gtmWfFormStep({
          id: IDS.approveNoShow,
          name: 'Approve no-show ping',
          editedBodyValue: `{{${IDS.draftNoShow}.message}}`,
          contextTemplate: OUTREACH_HITL_CONTEXT_TEMPLATES.noShowPing,
          detailsTemplate: gtmWfFormDetailsTemplate({
            findId: IDS.meetingBookedFind,
            personFindId: IDS.meetingBookedPersonFind,
            draftStepId: IDS.draftNoShow,
          }),
          nextStepIds: [IDS.sendNoShow],
        }),
      ]
    : []),
  gtmWfSendLinkedInMessageStep({
    id: IDS.sendNoShow,
    name: 'Send no-show ping',
    body: hitlOrDraftMessage({
      draftId: IDS.draftNoShow,
      approveId: IDS.approveNoShow,
      humanInTheLoop,
    }),
    candidateId: gtmWfFindId(IDS.meetingBookedFind),
    linkedinProfileId: gtmWfFindField(
      IDS.meetingBookedPersonFind,
      OUTREACH_WF_FIELD.linkedinProfileIdPath,
    ),
    linkedinUrl: gtmWfFindField(
      IDS.meetingBookedPersonFind,
      OUTREACH_WF_FIELD.linkedinLinkUrlPath,
    ),
    nextStepIds: [IDS.waitNextDay],
  }),
  gtmWfDelayStep({
    id: IDS.waitNextDay,
    name: 'Wait 1 day before reschedule',
    days: 1,
    nextStepIds: [IDS.draftReschedule],
  }),
  gtmWfAiAgentStep({
    id: IDS.draftReschedule,
    name: 'Draft reschedule offer',
    prompt: buildOutreachRescheduleOfferPrompt({
      senderJson: senderJson(),
      name: gtmWfFindField(IDS.meetingBookedFind, 'name'),
    }),
    agentId: OUTREACH_WF_AGENT_LINKEDIN,
    outputSchema: OUTREACH_WF_AI_MESSAGE_OUTPUT,
    nextStepIds: [humanInTheLoop ? IDS.approveReschedule : IDS.sendReschedule],
  }),
  ...(humanInTheLoop
    ? [
        gtmWfFormStep({
          id: IDS.approveReschedule,
          name: 'Approve reschedule offer',
          editedBodyValue: `{{${IDS.draftReschedule}.message}}`,
          contextTemplate: OUTREACH_HITL_CONTEXT_TEMPLATES.rescheduleOffer,
          detailsTemplate: gtmWfFormDetailsTemplate({
            findId: IDS.meetingBookedFind,
            personFindId: IDS.meetingBookedPersonFind,
            draftStepId: IDS.draftReschedule,
          }),
          nextStepIds: [IDS.sendReschedule],
        }),
      ]
    : []),
  gtmWfSendLinkedInMessageStep({
    id: IDS.sendReschedule,
    name: 'Send reschedule offer',
    body: hitlOrDraftMessage({
      draftId: IDS.draftReschedule,
      approveId: IDS.approveReschedule,
      humanInTheLoop,
    }),
    candidateId: gtmWfFindId(IDS.meetingBookedFind),
    linkedinProfileId: gtmWfFindField(
      IDS.meetingBookedPersonFind,
      OUTREACH_WF_FIELD.linkedinProfileIdPath,
    ),
    linkedinUrl: gtmWfFindField(
      IDS.meetingBookedPersonFind,
      OUTREACH_WF_FIELD.linkedinLinkUrlPath,
    ),
    nextStepIds: [IDS.stampStalled],
  }),
  gtmWfUpdateRecordStep({
    id: IDS.stampStalled,
    name: 'Mark FAILED_NO_REPLY after booking',
    objectRecordId: gtmWfFindId(IDS.meetingBookedFind),
    objectRecord: { outreachSequenceStage: 'FAILED_NO_REPLY' },
  }),
];

// Outreach dashboard company fields (projectIds, outreachFunnelStage, peopleReached,
// firstContactAt, coverageBucket) are materialized by OutreachCommandMaterializeService,
// not by UPDATE_RECORD steps in these graphs.
//
// LinkedIn-first semantics:
// - connection_sent = first outreach touch (peopleReached, funnel REACHED)
// - connection_accepted = time to first contact (company.firstContactAt, Speed tab)
//
// | Workflow / step | Dashboard fields populated |
// | --- | --- |
// | Harvest upsert-companies LF | company.projectIds, outreachFunnelStage=ADDED |
// | SEND_LINKEDIN_CONNECTION_REQUEST | connection_sent → peopleReached / REACHED |
// | Unipile connection_accepted webhook | connection_accepted → firstContactAt |
// | SEND_LINKEDIN_MESSAGE / INMAIL / WHATSAPP | outbound_message → company rollup |
// | SEND_EMAIL (per-candidate run, fallback) | outbound_message → firstContactAt |
// | CREATE_CALENDAR_EVENT | meeting_booked → company rollup |
// | Unipile inbound reply flush (kind=outreach) | REPLIED / meeting → company rollup |
// | UPDATE_RECORD stage markers | candidate.outreachSequenceStage only (no company rollup) |
// | enrich-contact LF | candidate.enrichStatus only (no company rollup) |
//
// Candidate-only charts (outreachSequenceStage) work from UPDATE_RECORD alone.
// Company funnel / coverage charts need the send/webhook materialize paths above.

export const buildCandidateSequencerGraph = (
  options?: Partial<OutreachSequencerGraphOptions>,
): {
  name: string;
  trigger: Record<string, unknown>;
  steps: unknown[];
} => {
  const resolved = resolveOutreachSequencerGraphOptions(options);
  const {
    useLlmConnectionNote,
    humanInTheLoop,
    whatsappEnabled,
    meetingFollowUpEnabled,
    checkDeduplicationPerCompany,
  } = resolved;

  const stageBranches = [
    {
      id: IDS.stageBranchQueued,
      filterGroupId: IDS.stageGroupQueued,
      filterId: IDS.stageFilterQueued,
      stepOutputKey: gtmWfTriggerAfter('outreachSequenceStage'),
      value: 'QUEUED',
      nextStepIds: [IDS.queuedFind],
    },
    {
      id: IDS.stageBranchAccepted,
      filterGroupId: IDS.stageGroupAccepted,
      filterId: IDS.stageFilterAccepted,
      stepOutputKey: gtmWfTriggerAfter('outreachSequenceStage'),
      value: 'CONNECTION_ACCEPTED',
      nextStepIds: [IDS.acceptFind],
    },
    {
      id: IDS.stageBranchReplied,
      filterGroupId: IDS.stageGroupReplied,
      filterId: IDS.stageFilterReplied,
      stepOutputKey: gtmWfTriggerAfter('outreachSequenceStage'),
      value: 'REPLIED',
      nextStepIds: [IDS.repliedFind],
    },
    ...(meetingFollowUpEnabled
      ? [
          {
            id: IDS.stageBranchMeetingBooked,
            filterGroupId: IDS.stageGroupMeetingBooked,
            filterId: IDS.stageFilterMeetingBooked,
            stepOutputKey: gtmWfTriggerAfter('outreachSequenceStage'),
            value: 'MEETING_BOOKED',
            nextStepIds: [IDS.meetingBookedFind],
          },
        ]
      : []),
    {
      id: IDS.stageBranchElse,
      nextStepIds: [],
    },
  ];

  const steps = [
    gtmWfMemberStep([IDS.stageRouter]),
    gtmWfMultiIfElseStep({
      id: IDS.stageRouter,
      name: 'Route by outreach stage',
      branches: stageBranches,
    }),
    ...queuedBranchSteps({
      hoistedMember: true,
      useLlmConnectionNote,
      humanInTheLoop,
      checkDeduplicationPerCompany,
    }),
    ...acceptedBranchSteps({ humanInTheLoop }),
    ...repliedBranchSteps({
      humanInTheLoop,
      whatsappEnabled,
      meetingFollowUpEnabled,
    }),
    ...(meetingFollowUpEnabled
      ? meetingBookedBranchSteps({ humanInTheLoop })
      : []),
  ];

  return {
    name: 'Outreach — Candidate Sequencer',
    trigger: gtmWfDatabaseEventTrigger({
      name: 'Prospect is Created or Updated',
      eventName: 'candidate.upserted',
      fields: ['outreachSequenceStage', 'candidateFlags'],
      filter: gtmWfEntryStageTriggerFilter({
        includeMeetingBooked: meetingFollowUpEnabled,
      }),
      nextStepIds: [OUTREACH_WF_MEMBER_STEP_ID],
    }),
    steps,
  };
};

export const OUTREACH_WORKFLOW_GRAPH_TEMPLATES: Array<{
  name: string;
  trigger: Record<string, unknown>;
  steps: unknown[];
}> = [
  {
    name: 'Company Created → ICP People Search',
    trigger: gtmWfDatabaseEventTrigger({
      name: 'Company is Created',
      eventName: 'company.created',
      nextStepIds: [IDS.searchPeople],
    }),
    steps: [
      gtmWfLogicFunctionStep({
        id: IDS.searchPeople,
        name: 'Search people for company',
        logicFunctionId: '__LF_search-people-for-company__',
        logicFunctionInput: {
          companyId: gtmWfTriggerAfter('id'),
        },
        sampleOutput: OUTREACH_SEARCH_PEOPLE_FOR_COMPANY_SAMPLE_OUTPUT,
        nextStepIds: [IDS.uploadProfiles],
      }),
      gtmWfLogicFunctionStep({
        id: IDS.uploadProfiles,
        name: 'Upload profiles',
        logicFunctionId: '__LF_upload-profiles__',
        logicFunctionInput: {
          people: `{{${IDS.searchPeople}.people}}`,
          projectId: `{{${IDS.searchPeople}.projectId}}`,
        },
        sampleOutput: OUTREACH_UPLOAD_PROFILES_SAMPLE_OUTPUT,
      }),
    ],
  },
  {
    name: 'Outreach — Fetch & Save People Profiles',
    trigger: gtmWfManualTrigger({
      nextStepIds: [IDS.fetchAndSaveUpload],
    }),
    steps: [
      gtmWfLogicFunctionStep({
        id: IDS.fetchAndSaveUpload,
        name: 'Fetch & Save People Profiles',
        logicFunctionId: '__LF_upload-profiles__',
        logicFunctionInput: {},
        sampleOutput: OUTREACH_UPLOAD_PROFILES_SAMPLE_OUTPUT,
      }),
    ],
  },
  {
    name: 'Search and Upload People Profiles',
    trigger: gtmWfWebhookTrigger({
      name: 'Search and upload webhook',
      nextStepIds: [IDS.webhookSearchPeople],
      expectedBody: {
        projectId: '',
        naturalLanguage: '',
        searchUrl: '',
        companyName: '',
        website: '',
        companyId: '',
        jobTitle: '',
        country: '',
        limit: 25,
      },
    }),
    steps: [
      gtmWfLogicFunctionStep({
        id: IDS.webhookSearchPeople,
        name: 'Search people',
        logicFunctionId: '__LF_search-people__',
        logicFunctionInput: {
          naturalLanguage: gtmWfTriggerField('naturalLanguage'),
          searchUrl: gtmWfTriggerField('searchUrl'),
          companyName: gtmWfTriggerField('companyName'),
          website: gtmWfTriggerField('website'),
          companyId: gtmWfTriggerField('companyId'),
          jobTitle: gtmWfTriggerField('jobTitle'),
          country: gtmWfTriggerField('country'),
          limit: gtmWfTriggerField('limit'),
        },
        sampleOutput: OUTREACH_SEARCH_PEOPLE_SAMPLE_OUTPUT,
        nextStepIds: [IDS.webhookUploadProfiles],
      }),
      gtmWfLogicFunctionStep({
        id: IDS.webhookUploadProfiles,
        name: 'Upload profiles',
        logicFunctionId: '__LF_upload-profiles__',
        logicFunctionInput: {
          people: `{{${IDS.webhookSearchPeople}.people}}`,
          projectId: gtmWfTriggerField('projectId'),
          companyId: gtmWfTriggerField('companyId'),
        },
        sampleOutput: OUTREACH_UPLOAD_PROFILES_SAMPLE_OUTPUT,
      }),
    ],
  },
  {
    name: 'Harvest — LinkedIn Companies',
    trigger: {
      name: 'Every few hours',
      type: 'CRON',
      position: { x: 0, y: 0 },
      settings: {
        type: 'HOURS',
        schedule: { hour: 6, minute: 0 },
        outputSchema: {},
      },
      nextStepIds: [IDS.searchCompanies],
    },
    steps: [
      gtmWfLogicFunctionStep({
        id: IDS.searchCompanies,
        name: 'Search LinkedIn companies',
        logicFunctionId: '__LF_search-companies__',
        logicFunctionInput: {
          limit: 15,
          query: '',
          keywords: '',
        },
        sampleOutput: OUTREACH_SEARCH_COMPANIES_SAMPLE_OUTPUT,
        nextStepIds: [IDS.upsertCompanies],
      }),
      gtmWfLogicFunctionStep({
        id: IDS.upsertCompanies,
        name: 'Upsert companies to CRM',
        logicFunctionId: '__LF_upsert-companies__',
        logicFunctionInput: {
          companies: `{{${IDS.searchCompanies}.companies}}`,
          projectId: OUTREACH_WF_HARVEST_PROJECT_ID,
        },
        sampleOutput: OUTREACH_UPSERT_COMPANIES_SAMPLE_OUTPUT,
      }),
    ],
  },
  // Merge of former Stage B (create/QUEUED) and Stage C (stage update) behind one
  // create-or-update trigger, so a new user manages one canvas instead of two.
  //
  // Safe because:
  // - The trigger allowlists the entry stages before a run is created, so the
  //   graph never wakes on its own CONNECTION_SENT / DEFERRED / EMAIL_SENT /
  //   FAILED_ENRICH / WAITING_REPLY / FAILED_NO_REPLY stamps.
  // - The router is IF_ELSE, not FILTER. A FILTER first would skip-cascade the whole
  //   run and kill the accepted / replied branches.
  // - Workspace member loads once above the router, so the branches share no
  //   downstream step ids and no IF_ELSE join can be cascade-skipped.
  // - QUEUED re-entry: connectionNotSentIf gates Send LinkedIn connection on
  //   empty outreachAnalytics.connectionSentAt (see queuedBranchSteps).
  // - CONNECTION_ACCEPTED: hasInboundIf stamps REPLIED when fetch-linkedin-messages
  //   already has an inbound turn, so the run stops and upsert re-enters replied.
  //
  // Legacy Stage B/C display names stay in OUTREACH_WORKFLOW_NAMES_TO_DEACTIVATE
  // so existing workspaces deactivate those graphs; they are not seeded here.
  // Graph shape is parameterized via buildCandidateSequencerGraph (Edit Workflow).
  buildCandidateSequencerGraph(),
];
