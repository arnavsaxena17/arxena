import { Injectable } from '@nestjs/common';
import { WorkspaceMemberProfileUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-profile-unipile.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import {
  CandidateNode,
  findManyPhoneCalls,
  graphqlMutationToCreatePhoneCall,
  graphqlToFetchAllCandidateData,
  Project,
  mutationToUpdateOnePhoneCall,
} from 'twenty-shared';
import { CandidateEngagementArx } from '../candidate-engagement/candidate-engagement';
import { FilterCandidates } from '../candidate-engagement/filter-candidates';
import { ElevenLabsClient } from './elevenlabs.client';

export type CallPurpose = 'screening' | 'interview_scheduling' | 'video_interview_followup' | 'generic';

export type HandleIncomingCallResult = {
  phoneCallId: string;
  systemPrompt: string;
  firstMessage: string;
  personId?: string;
};

const INBOUND_RECRUITER_PROMPT = `You are a recruiting assistant. The caller has reached the recruiter's line. Greet them politely, ask for their name and which role or company they're calling about. If they are a candidate, help them with next steps. Keep responses short and natural for voice.`;

function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 && !phone.startsWith('+')) {
    return '91' + digits;
  }
  if (digits.length > 10 && digits.startsWith('91')) {
    return digits;
  }
  return phone.replace(/\D/g, '');
}

@Injectable()
export class VoiceCallService {
  private elevenLabs: ElevenLabsClient | null = null;
  private agentId: string | null = null;
  private agentPhoneNumberId: string | null = null;
  private elevenLabsWhatsAppPhoneNumberId: string | null = null;
  private elevenLabsWhatsAppCallPermissionTemplateName: string | null = null;
  private elevenLabsWhatsAppCallPermissionTemplateLanguage: string | null = null;

  constructor(
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
  ) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (apiKey) {
      this.elevenLabs = new ElevenLabsClient(apiKey);
      this.agentId = process.env.ELEVENLABS_AGENT_ID ?? null;
      this.agentPhoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID ?? null;
      this.elevenLabsWhatsAppPhoneNumberId =
        process.env.ELEVENLABS_WHATSAPP_PHONE_NUMBER_ID ?? null;
      this.elevenLabsWhatsAppCallPermissionTemplateName =
        process.env.ELEVENLABS_WHATSAPP_CALL_PERMISSION_TEMPLATE_NAME ?? null;
      this.elevenLabsWhatsAppCallPermissionTemplateLanguage =
        process.env.ELEVENLABS_WHATSAPP_CALL_PERMISSION_TEMPLATE_LANGUAGE ?? 'en';
    }
  }

  async initiateOutboundCall(
    candidateId: string,
    projectId: string,
    callPurpose: CallPurpose,
    apiToken: string,
  ): Promise<{ phoneCallId: string; status: string; error?: string }> {
    const filter = { id: { eq: candidateId } };
    const res = await this.staticGraphQLService.executeGraphQL(
      graphqlToFetchAllCandidateData,
      { filter, first: 1, lastCursor: null },
      apiToken,
    );
    const edges = res?.data?.data?.candidates?.edges;
    const candidateNode = edges?.[0]?.node as (CandidateNode & { jobs?: Project }) | undefined;
    if (!candidateNode) {
      return { phoneCallId: '', status: 'error', error: 'Candidate not found' };
    }
    const job = candidateNode.projects ?? (Array.isArray((candidateNode as any).projects) ? (candidateNode as any).projects[0] : undefined);
    if (!job && projectId) {
      return { phoneCallId: '', status: 'error', error: 'Project not found for candidate' };
    }
    const candidateJob = (job || { id: projectId, name: '', jobLocation: '' }) as Project;
    const personId = candidateNode.peopleId ?? (candidateNode as any).people?.id;
    const rawPhone = candidateNode.phoneNumber?.primaryPhoneNumber ?? (candidateNode as any).people?.phones?.primaryPhoneNumber ?? '';
    const phoneNumber = normalizePhoneNumber(rawPhone);
    if (!phoneNumber) {
      return { phoneCallId: '', status: 'error', error: 'No phone number for candidate' };
    }

    const chatControlType =
      callPurpose === 'screening'
        ? 'startChat'
        : callPurpose === 'interview_scheduling'
          ? 'startMeetingSchedulingChat'
          : callPurpose === 'video_interview_followup'
            ? 'startVideoInterviewChat'
            : 'startChat';
    const candidateEngagement = CandidateEngagementArx.create(
      this.workspaceQueryService,
      this.staticGraphQLService,
      this.workspaceMemberProfileUnipileService,
    );
    const systemPrompt = await candidateEngagement.getSystemPrompt(
      candidateNode as CandidateNode,
      candidateJob,
      { chatControlType },
      apiToken,
    );
    const firstMessage = 'Hi, this is a quick call from the recruitment team. Do you have 2 minutes to talk?';

    const createRes = await this.staticGraphQLService.executeGraphQL(
      graphqlMutationToCreatePhoneCall,
      {
        input: {
          personId: personId || undefined,
          phoneNumber: '+' + phoneNumber,
          callType: 'OUTGOING',
          duration: 0,
          timestamp: new Date().toISOString(),
        },
      },
      apiToken,
    );
    const phoneCallId = createRes?.data?.data?.createPhoneCall?.id;
    if (!phoneCallId) {
      return { phoneCallId: '', status: 'error', error: 'Failed to create PhoneCall' };
    }

    if (this.elevenLabs && this.agentId && this.agentPhoneNumberId) {
      try {
        await this.elevenLabs.outboundCallTwilio({
          agent_id: this.agentId,
          agent_phone_number_id: this.agentPhoneNumberId,
          to_number: '+' + phoneNumber,
          conversation_initiation_client_data: {
            first_message: firstMessage,
            overrides: { agent: { prompt: { prompt: systemPrompt } } } as any,
          },
        });
        return { phoneCallId, status: 'initiated' };
      } catch (err: any) {
        return { phoneCallId, status: 'call_failed', error: err?.message || 'ElevenLabs outbound failed' };
      }
    }
    return { phoneCallId, status: 'created_no_telephony' };
  }

  async initiateOutboundCallWhatsApp(
    candidateId: string,
    projectId: string,
    callPurpose: CallPurpose,
    apiToken: string,
    whatsappUserId: string,
  ): Promise<{ phoneCallId: string; status: string; error?: string }> {
    const filter = { id: { eq: candidateId } };
    const res = await this.staticGraphQLService.executeGraphQL(
      graphqlToFetchAllCandidateData,
      { filter, first: 1, lastCursor: null },
      apiToken,
    );
    const edges = res?.data?.data?.candidates?.edges;
    const candidateNode = edges?.[0]?.node as (CandidateNode & { jobs?: Project }) | undefined;
    if (!candidateNode) {
      return { phoneCallId: '', status: 'error', error: 'Candidate not found' };
    }
    const job = candidateNode.projects ?? (Array.isArray((candidateNode as any).projects) ? (candidateNode as any).projects[0] : undefined);
    const candidateJob = (job || { id: projectId, name: '', jobLocation: '' }) as Project;
    const personId = candidateNode.peopleId ?? (candidateNode as any).people?.id;
    const rawPhone = candidateNode.phoneNumber?.primaryPhoneNumber ?? (candidateNode as any).people?.phones?.primaryPhoneNumber ?? '';
    const phoneNumber = normalizePhoneNumber(rawPhone);

    const chatControlType =
      callPurpose === 'screening'
        ? 'startChat'
        : callPurpose === 'interview_scheduling'
          ? 'startMeetingSchedulingChat'
          : callPurpose === 'video_interview_followup'
            ? 'startVideoInterviewChat'
            : 'startChat';
    const candidateEngagement = CandidateEngagementArx.create(
      this.workspaceQueryService,
      this.staticGraphQLService,
      this.workspaceMemberProfileUnipileService,
    );
    const systemPrompt = await candidateEngagement.getSystemPrompt(
      candidateNode as CandidateNode,
      candidateJob,
      { chatControlType },
      apiToken,
    );
    const firstMessage = 'Hi, this is a quick call from the recruitment team. Do you have 2 minutes to talk?';

    const createRes = await this.staticGraphQLService.executeGraphQL(
      graphqlMutationToCreatePhoneCall,
      {
        input: {
          personId: personId || undefined,
          phoneNumber: phoneNumber ? '+' + phoneNumber : undefined,
          callType: 'OUTGOING',
          duration: 0,
          timestamp: new Date().toISOString(),
        },
      },
      apiToken,
    );
    const phoneCallId = createRes?.data?.data?.createPhoneCall?.id;
    if (!phoneCallId) {
      return { phoneCallId: '', status: 'error', error: 'Failed to create PhoneCall' };
    }

    const hasWhatsAppConfig =
      this.elevenLabs &&
      this.agentId &&
      this.elevenLabsWhatsAppPhoneNumberId &&
      this.elevenLabsWhatsAppCallPermissionTemplateName &&
      this.elevenLabsWhatsAppCallPermissionTemplateLanguage;

    if (hasWhatsAppConfig) {
      try {
        await this.elevenLabs!.outboundCallWhatsApp({
          whatsapp_phone_number_id: this.elevenLabsWhatsAppPhoneNumberId!,
          whatsapp_user_id: whatsappUserId,
          whatsapp_call_permission_request_template_name:
            this.elevenLabsWhatsAppCallPermissionTemplateName!,
          whatsapp_call_permission_request_template_language_code:
            this.elevenLabsWhatsAppCallPermissionTemplateLanguage!,
          agent_id: this.agentId!,
          conversation_initiation_client_data: {
            first_message: firstMessage,
            dynamic_variables: { phone_call_id: phoneCallId },
            overrides: { agent: { prompt: { prompt: systemPrompt } } } as Record<string, unknown>,
          },
        });
        return { phoneCallId, status: 'initiated' };
      } catch (err: any) {
        return {
          phoneCallId,
          status: 'call_failed',
          error: err?.message || 'ElevenLabs WhatsApp outbound failed',
        };
      }
    }
    return { phoneCallId, status: 'created_no_telephony' };
  }

  async handleIncomingCall(
    fromNumber: string,
    apiToken: string,
  ): Promise<HandleIncomingCallResult> {
    const cleaned = normalizePhoneNumber(fromNumber);
    const filterCandidates = new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    );
    const person = await filterCandidates.getPersonDetailsByPhoneNumber(cleaned, apiToken);
    const personId = person?.id;
    let systemPrompt = INBOUND_RECRUITER_PROMPT;
    let firstMessage = 'Thanks for calling. How can I help you today?';

    if (person) {
      const candidateEngagement = CandidateEngagementArx.create(
        this.workspaceQueryService,
        this.staticGraphQLService,
        this.workspaceMemberProfileUnipileService,
      );
      const filter = { peopleId: { eq: personId } };
      const res = await this.staticGraphQLService.executeGraphQL(
        graphqlToFetchAllCandidateData,
        { filter, first: 1, lastCursor: null },
        apiToken,
      );
      const edges = res?.data?.data?.candidates?.edges;
      const candidateNode = edges?.[0]?.node as CandidateNode | undefined;
      const job = candidateNode?.projects as Project | undefined;
      if (candidateNode && job) {
        const chatControlType = 'startChat';
        const prompt = await candidateEngagement.getSystemPrompt(
          candidateNode,
          job,
          { chatControlType },
          apiToken,
        );
        if (prompt) systemPrompt = prompt;
        firstMessage = 'Hi, you’ve reached the recruitment team. Do you have a couple of minutes?';
      }
    }

    const createRes = await this.staticGraphQLService.executeGraphQL(
      graphqlMutationToCreatePhoneCall,
      {
        input: {
          personId: personId || undefined,
          phoneNumber: '+' + cleaned,
          callType: 'INCOMING',
          duration: 0,
          timestamp: new Date().toISOString(),
        },
      },
      apiToken,
    );
    const phoneCallId = createRes?.data?.data?.createPhoneCall?.id ?? '';
    return { phoneCallId, systemPrompt, firstMessage, personId };
  }

  async onConversationEnd(
    payload: { conversation_id?: string; phone_call_id?: string; transcript?: string; duration_seconds?: number; [k: string]: unknown },
    apiToken: string,
  ): Promise<void> {
    const phoneCallId = payload.phone_call_id ?? payload.phoneCallId;
    const transcript = typeof payload.transcript === 'string' ? payload.transcript : (payload as any).transcript?.text ?? '';
    const durationSeconds = payload.duration_seconds ?? (payload as any).duration ?? 0;
    if (!phoneCallId) return;

    await this.staticGraphQLService.executeGraphQL(
      mutationToUpdateOnePhoneCall,
      {
        id: phoneCallId,
        input: { transcript, duration: Math.round(Number(durationSeconds)) },
      },
      apiToken,
    );
  }

  async listCalls(apiToken: string, params: { personId?: string; limit?: number }): Promise<unknown> {
    const filter: Record<string, unknown> = {};
    if (params.personId) filter.personId = { eq: params.personId };
    const res = await this.staticGraphQLService.executeGraphQL(
      findManyPhoneCalls,
      { filter, limit: params.limit ?? 20 },
      apiToken,
    );
    return res?.data?.data?.phoneCalls ?? { edges: [] };
  }

  /**
   * Handle WhatsApp Business API webhook call events (incoming/outgoing call initiated or ended).
   * Creates or updates PhoneCall records. apiToken is required to create/update; resolve from
   * phone_number_id mapping or use WHATSAPP_BUSINESS_WEBHOOK_API_TOKEN env.
   */
  async handleWhatsAppBusinessCallEvent(
    payload: {
      phone_number_id?: string;
      from?: string;
      id?: string;
      timestamp?: string;
      type?: string;
      status?: string;
      duration_seconds?: number;
    },
    apiToken: string | null,
  ): Promise<void> {
    if (!apiToken) return;
    const fromNumber = payload.from ?? '';
    const cleaned = normalizePhoneNumber(fromNumber);
    if (!cleaned) return;

    const filterCandidates = new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    );
    const person = await filterCandidates.getPersonDetailsByPhoneNumber(cleaned, apiToken);
    const personId = person?.id;

    if (payload.status === 'ended' && payload.duration_seconds != null) {
      // Optional: update existing PhoneCall by matching recent record for this person/number.
      // For now we only create on "initiated"; Meta may send conversation_id in payload later.
      return;
    }

    await this.staticGraphQLService.executeGraphQL(
      graphqlMutationToCreatePhoneCall,
      {
        input: {
          personId: personId || undefined,
          phoneNumber: '+' + cleaned,
          callType: 'INCOMING',
          duration: payload.duration_seconds ?? 0,
          timestamp: payload.timestamp ? new Date(Number(payload.timestamp) * 1000).toISOString() : new Date().toISOString(),
        },
      },
      apiToken,
    );
  }
}
