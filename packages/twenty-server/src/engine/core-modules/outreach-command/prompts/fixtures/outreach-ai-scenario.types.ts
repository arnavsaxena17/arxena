import { type OutreachValidatedInboundSignals } from 'src/engine/core-modules/outreach-command/utils/validate-outreach-inbound-signals.util';

export type OutreachAiPriority = 'must' | 'pass' | 'low';

export type OutreachAiNodeKind =
  | 'extract_inbound_signals'
  | 'draft_sales_reply'
  | 'qualify'
  | 'connection_note'
  | 'first_message_opener'
  | 'linkedin_follow_up_1'
  | 'linkedin_follow_up_2'
  | 'linkedin_follow_up_3'
  | 'post_reply_follow_up_1'
  | 'post_reply_follow_up_2'
  | 'fallback_email'
  | 'meeting_reminder'
  | 'no_show_ping'
  | 'reschedule_offer';

export type OutreachAiExtractExpectation = {
  acceptedSlotIndex: number;
  requestedChannelSwitch: 'NONE' | 'LINKEDIN' | 'WHATSAPP' | 'EMAIL';
  prospectEmail: string;
  referralName: string;
  referralEmail: string;
  referralPhone: string;
  shouldNotRespond: boolean;
};

export type OutreachAiSoftTextExpectation = {
  contains?: string[];
  notContains?: string[];
  maxWords?: number;
  nonEmptyKeys?: string[];
};

export type OutreachAiScenarioInputs = {
  transcript?: string;
  slots?: Array<{ startsAt: string; endsAt: string }> | string;
  lastChannel?: 'LINKEDIN' | 'WHATSAPP' | 'EMAIL';
  conversationStage?: string;
  name?: string;
  title?: string;
  senderJson?: string;
  prospectEnrichmentJson?: string;
  profile?: string;
  posts?: string;
  crm?: string;
  chatHistory?: string;
  calendarSlots?: string;
  replyChannel?: string;
  confirmedStartsAt?: string;
  referralName?: string;
  prospectEmail?: string;
  shouldNotRespond?: string;
  kind?: 'opener' | 'fu1' | 'fu2' | 'fu3';
};

export type OutreachAiScenarioExpected = {
  extract?: OutreachAiExtractExpectation;
  validate?: Partial<OutreachValidatedInboundSignals>;
  draft?: OutreachAiSoftTextExpectation;
  qualify?: { go: boolean };
  message?: OutreachAiSoftTextExpectation;
  email?: OutreachAiSoftTextExpectation & {
    subjectContains?: string[];
  };
};

export type OutreachAiScenario = {
  id: string;
  nodeKind: OutreachAiNodeKind;
  priority: OutreachAiPriority;
  description: string;
  sourcePublicIdentifier?: string;
  tags: string[];
  inputs: OutreachAiScenarioInputs;
  expected: OutreachAiScenarioExpected;
};
