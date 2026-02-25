/**
 * Minimal HTTP client for ElevenLabs Conversational AI APIs.
 * Used for outbound voice calls (Twilio and SIP trunk).
 */
const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

export type ElevenLabsOutboundTwilioPayload = {
  agent_id: string;
  agent_phone_number_id: string;
  to_number: string;
  conversation_initiation_client_data?: {
    first_message?: string;
    overrides?: Record<string, unknown>;
  };
};

export type ElevenLabsOutboundSipPayload = {
  agent_id: string;
  agent_phone_number_id: string;
  to_number: string;
  conversation_initiation_client_data?: {
    first_message?: string;
    overrides?: Record<string, unknown>;
  };
};

export type ElevenLabsOutboundWhatsAppPayload = {
  whatsapp_phone_number_id: string;
  whatsapp_user_id: string;
  whatsapp_call_permission_request_template_name: string;
  whatsapp_call_permission_request_template_language_code: string;
  agent_id: string;
  conversation_initiation_client_data?: {
    first_message?: string;
    dynamic_variables?: Record<string, string | number | boolean>;
    overrides?: Record<string, unknown>;
  };
};

export class ElevenLabsClient {
  constructor(private readonly apiKey: string) {}

  private async request<T>(
    method: string,
    path: string,
    body?: object,
  ): Promise<T> {
    const url = `${ELEVENLABS_BASE}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ElevenLabs API ${res.status}: ${text}`);
    }
    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return undefined as T;
    }
    return res.json() as Promise<T>;
  }

  async outboundCallTwilio(
    payload: ElevenLabsOutboundTwilioPayload,
  ): Promise<{ conversation_id?: string; [k: string]: unknown }> {
    return this.request('POST', '/convai/twilio/outbound-call', payload);
  }

  async outboundCallSipTrunk(
    payload: ElevenLabsOutboundSipPayload,
  ): Promise<{ conversation_id?: string; [k: string]: unknown }> {
    return this.request('POST', '/convai/sip-trunk/outbound-call', payload);
  }

  async outboundCallWhatsApp(
    payload: ElevenLabsOutboundWhatsAppPayload,
  ): Promise<{ success?: boolean; message?: string; conversation_id?: string; [k: string]: unknown }> {
    return this.request('POST', '/convai/whatsapp/outbound-call', payload);
  }
}
