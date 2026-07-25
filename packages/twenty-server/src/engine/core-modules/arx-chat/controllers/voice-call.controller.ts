import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { CallPurpose, VoiceCallService } from '../services/voice-call/voice-call.service';

function getApiToken(request: any): string | null {
  const auth = request?.headers?.authorization;
  if (!auth || typeof auth !== 'string') return null;
  const token = auth.split(' ')[1];
  return token?.replace(/[\r\n]+/g, '') ?? null;
}

@Controller('voice-calls')
export class VoiceCallController {
  constructor(private readonly voiceCallService: VoiceCallService) {}

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  async initiate(
    @Req() request: any,
    @Body()
    body: {
      candidateId: string;
      projectId: string;
      callPurpose?: CallPurpose;
      channel?: 'twilio' | 'whatsapp';
      whatsappUserId?: string;
    },
  ) {
    const apiToken = getApiToken(request);
    if (!apiToken) return { status: 401, error: 'Unauthorized' };
    const { candidateId, projectId, callPurpose = 'screening', channel, whatsappUserId } = body;
    if (!candidateId || !projectId) {
      return { status: 400, error: 'candidateId and projectId required' };
    }
    if (channel === 'whatsapp' && whatsappUserId) {
      const result = await this.voiceCallService.initiateOutboundCallWhatsApp(
        candidateId,
        projectId,
        callPurpose,
        apiToken,
        whatsappUserId,
      );
      if (result.error && result.status === 'error') {
        return { status: 400, error: result.error, phoneCallId: result.phoneCallId };
      }
      return { status: 201, phoneCallId: result.phoneCallId, callStatus: result.status };
    }
    const result = await this.voiceCallService.initiateOutboundCall(
      candidateId,
      projectId,
      callPurpose,
      apiToken,
    );
    if (result.error && result.status === 'error') {
      return { status: 400, error: result.error, phoneCallId: result.phoneCallId };
    }
    return { status: 201, phoneCallId: result.phoneCallId, callStatus: result.status };
  }

  @Post('incoming')
  async incoming(
    @Req() request: any,
    @Body() body: { from?: string; From?: string; Caller?: string; apiToken?: string },
  ) {
    const fromNumber = body.from ?? body.From ?? body.Caller ?? '';
    const apiToken = body.apiToken ?? getApiToken(request);
    if (!apiToken) {
      return { status: 400, error: 'apiToken or Authorization header required' };
    }
    const result = await this.voiceCallService.handleIncomingCall(fromNumber, apiToken);
    return result;
  }

  @Post('webhook')
  async webhook(
    @Req() request: any,
    @Body() body: Record<string, unknown>,
  ) {
    const apiToken = (body.apiToken as string) ?? (request?.headers?.['x-api-token'] as string) ?? process.env.VOICE_WEBHOOK_API_TOKEN ?? getApiToken(request);
    if (!apiToken) {
      return { status: 200, received: true, updated: false };
    }
    await this.voiceCallService.onConversationEnd(body as any, apiToken);
    return { status: 200, received: true, updated: true };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(
    @Req() request: any,
    @Query('personId') personId?: string,
    @Query('limit') limit?: string,
  ) {
    const apiToken = getApiToken(request);
    if (!apiToken) return { status: 401, error: 'Unauthorized' };
    const data = await this.voiceCallService.listCalls(apiToken, {
      personId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return data;
  }
}
