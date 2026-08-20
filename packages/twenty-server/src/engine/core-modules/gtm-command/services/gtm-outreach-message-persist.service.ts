import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import { GtmCommandMaterializeService } from 'src/engine/core-modules/gtm-command/services/gtm-command-materialize.service';
import { GtmWorkspaceAuthTokenService } from 'src/engine/core-modules/gtm-command/services/gtm-workspace-auth-token.service';
import { extractLinkedinProfileId } from 'src/engine/core-modules/gtm-command/utils/extract-linkedin-profile-id.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

export type GtmOutreachTranscriptChannel = 'LINKEDIN' | 'WHATSAPP' | 'EMAIL';

type ChatTurn = {
  role: string;
  content: string;
  id?: string;
  timestamp?: string;
};

type WhatsappMessageRecord = ObjectLiteral & {
  id: string;
  candidateId?: string | null;
  personId?: string | null;
  projectsId?: string | null;
  message?: string | null;
  messageObj?: unknown;
  messageObjWithTimeStamp?: unknown;
  typeOfMessage?: string | null;
  channel?: string | null;
  whatsappMessageId?: string | null;
  externalChatId?: string | null;
  phoneFrom?: string | null;
  phoneTo?: string | null;
};

type CandidateRecord = ObjectLiteral & {
  id: string;
  peopleId?: string | null;
  projectsId?: string | null;
  linkedinProfileId?: string | null;
  linkedinUrl?: { primaryLinkUrl?: string } | null;
  phoneNumber?: { primaryPhoneNumber?: string } | null;
};

@Injectable()
export class GtmOutreachMessagePersistService {
  private readonly logger = new Logger(GtmOutreachMessagePersistService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly gtmCommandMaterializeService: GtmCommandMaterializeService,
    private readonly gtmWorkspaceAuthTokenService: GtmWorkspaceAuthTokenService,
  ) {}

  async appendOutbound({
    workspaceId,
    channel,
    body,
    candidateId,
    linkedinProfileId,
    phone,
    externalMessageId,
    chatId,
    materializeOutbound = true,
  }: {
    workspaceId: string;
    channel: GtmOutreachTranscriptChannel;
    body: string;
    candidateId?: string | null;
    linkedinProfileId?: string | null;
    phone?: string | null;
    externalMessageId?: string | null;
    chatId?: string | null;
    materializeOutbound?: boolean;
  }): Promise<void> {
    const text = body.trim();

    if (!isNonEmptyString(text)) {
      return;
    }

    const resolvedCandidateId = await this.resolveCandidateId({
      workspaceId,
      candidateId,
      linkedinProfileId,
      phone,
    });

    if (!isNonEmptyString(resolvedCandidateId)) {
      this.logger.warn(
        `Skip transcript persist: no candidate for channel=${channel}`,
      );

      return;
    }

    await this.mergeTurns({
      workspaceId,
      candidateId: resolvedCandidateId,
      channel,
      turns: [
        {
          role: 'assistant',
          content: text,
          id: externalMessageId ?? undefined,
          timestamp: new Date().toISOString(),
        },
      ],
      chatId,
      latestExternalMessageId: externalMessageId,
      typeOfMessage: channel === 'LINKEDIN' ? 'linkedin' : 'messageFromSelf',
    });

    if (!materializeOutbound) {
      return;
    }

    try {
      const apiToken =
        await this.gtmWorkspaceAuthTokenService.resolveOrMint(workspaceId);

      await this.gtmCommandMaterializeService.applyCandidateEvent({
        candidateId: resolvedCandidateId,
        event: 'outbound_message',
        apiToken,
        messagingChannel:
          channel === 'WHATSAPP'
            ? 'WHATSAPP_UNIPILE'
            : channel === 'EMAIL'
              ? 'EMAIL'
              : 'LINKEDIN',
      });
    } catch (error) {
      this.logger.warn(
        `Outbound materialize failed for ${resolvedCandidateId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async mergeFetchedLinkedinMessages({
    workspaceId,
    candidateId,
    linkedinProfileId,
    chatId,
    messages,
  }: {
    workspaceId: string;
    candidateId?: string | null;
    linkedinProfileId?: string | null;
    chatId?: string | null;
    messages: Array<{
      id?: string;
      text?: string;
      timestamp?: string;
      isSender?: boolean;
    }>;
  }): Promise<string | null> {
    const resolvedCandidateId = await this.resolveCandidateId({
      workspaceId,
      candidateId,
      linkedinProfileId,
    });

    if (!isNonEmptyString(resolvedCandidateId) || messages.length === 0) {
      return resolvedCandidateId;
    }

    const turns = messages
      .filter((item) => isNonEmptyString(item.text?.trim()))
      .map((item) => ({
        role: item.isSender ? 'assistant' : 'user',
        content: item.text?.trim() ?? '',
        id: item.id,
        timestamp: item.timestamp,
      }));

    await this.mergeTurns({
      workspaceId,
      candidateId: resolvedCandidateId,
      channel: 'LINKEDIN',
      turns,
      chatId,
      latestExternalMessageId: messages.at(-1)?.id,
      typeOfMessage: 'linkedin',
    });

    return resolvedCandidateId;
  }

  private async resolveCandidateId({
    workspaceId,
    candidateId,
    linkedinProfileId,
    phone,
  }: {
    workspaceId: string;
    candidateId?: string | null;
    linkedinProfileId?: string | null;
    phone?: string | null;
  }): Promise<string | null> {
    if (isNonEmptyString(candidateId)) {
      return candidateId;
    }

    const slug = extractLinkedinProfileId(linkedinProfileId ?? '');
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const candidateRepository =
          await this.globalWorkspaceOrmManager.getRepository<CandidateRecord>(
            workspaceId,
            'candidate',
            { shouldBypassPermissionChecks: true },
          );

        if (isNonEmptyString(slug)) {
          const byProfileId = await candidateRepository.findOne({
            where: { linkedinProfileId: slug },
          });

          if (isDefined(byProfileId)) {
            return byProfileId.id;
          }
        }

        if (isNonEmptyString(phone)) {
          const byPhone = await candidateRepository.find({
            take: 50,
            order: { updatedAt: 'DESC' },
          });
          const match = byPhone.find(
            (row) =>
              row.phoneNumber?.primaryPhoneNumber?.replace(/\D/g, '') ===
              phone.replace(/\D/g, ''),
          );

          return match?.id ?? null;
        }

        return null;
      },
      authContext,
    );
  }

  private async mergeTurns({
    workspaceId,
    candidateId,
    channel,
    turns,
    chatId,
    latestExternalMessageId,
    typeOfMessage,
  }: {
    workspaceId: string;
    candidateId: string;
    channel: GtmOutreachTranscriptChannel;
    turns: ChatTurn[];
    chatId?: string | null;
    latestExternalMessageId?: string | null;
    typeOfMessage: string;
  }): Promise<void> {
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const messageRepository =
          await this.globalWorkspaceOrmManager.getRepository<WhatsappMessageRecord>(
            workspaceId,
            'whatsappMessage',
            { shouldBypassPermissionChecks: true },
          );
        const candidateRepository =
          await this.globalWorkspaceOrmManager.getRepository<CandidateRecord>(
            workspaceId,
            'candidate',
            { shouldBypassPermissionChecks: true },
          );
        const candidate = await candidateRepository.findOne({
          where: { id: candidateId },
        });
        const existing = await this.findChannelRow(
          messageRepository,
          candidateId,
          channel,
        );
        const mergedObj = this.mergeChatTurns(
          this.asTurns(existing?.messageObj),
          turns,
        );
        const mergedTs = this.mergeChatTurns(
          this.asTurns(existing?.messageObjWithTimeStamp),
          turns,
        );
        const lastContent = mergedObj.at(-1)?.content ?? '';
        const patch: Record<string, unknown> = {
          message: lastContent,
          messageObj: mergedObj,
          messageObjWithTimeStamp: mergedTs,
          typeOfMessage,
          channel,
          candidateId,
          personId: candidate?.peopleId ?? existing?.personId ?? null,
          projectsId: candidate?.projectsId ?? existing?.projectsId ?? null,
        };

        if (isNonEmptyString(latestExternalMessageId)) {
          patch.whatsappMessageId = latestExternalMessageId;
        }

        if (isNonEmptyString(chatId)) {
          patch.externalChatId = chatId;
        }

        if (isDefined(existing)) {
          try {
            await messageRepository.update(existing.id, patch);
          } catch {
            const { channel: _channel, externalChatId: _chat, ...rest } = patch;

            await messageRepository.update(existing.id, rest);
          }

          return;
        }

        try {
          await messageRepository.save(
            messageRepository.create({
              name: `${channel} ${candidateId.slice(0, 8)}`,
              ...patch,
            }),
          );
        } catch {
          const { channel: _channel, externalChatId: _chat, ...rest } = patch;

          await messageRepository.save(
            messageRepository.create({
              name: `${channel} ${candidateId.slice(0, 8)}`,
              ...rest,
            }),
          );
        }
      },
      authContext,
    );
  }

  private async findChannelRow(
    messageRepository: {
      find: (options: object) => Promise<WhatsappMessageRecord[]>;
    },
    candidateId: string,
    channel: GtmOutreachTranscriptChannel,
  ): Promise<WhatsappMessageRecord | null> {
    const rows = await messageRepository.find({
      where: { candidateId },
      order: { updatedAt: 'DESC' },
      take: 20,
    });
    const byChannel = rows.find((row) => row.channel === channel);

    if (isDefined(byChannel)) {
      return byChannel;
    }

    if (channel === 'LINKEDIN') {
      return (
        rows.find(
          (row) =>
            row.typeOfMessage === 'linkedin' ||
            `${row.phoneFrom ?? ''} ${row.phoneTo ?? ''}`.includes('linkedin'),
        ) ?? rows[0] ?? null
      );
    }

    return rows[0] ?? null;
  }

  private asTurns(value: unknown): ChatTurn[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.flatMap((item) => {
      if (typeof item !== 'object' || item === null) {
        return [];
      }

      const row = item as Record<string, unknown>;
      const content =
        typeof row.content === 'string'
          ? row.content
          : typeof row.message === 'string'
            ? row.message
            : '';

      if (!isNonEmptyString(content)) {
        return [];
      }

      return [
        {
          role: typeof row.role === 'string' ? row.role : 'user',
          content,
          id: typeof row.id === 'string' ? row.id : undefined,
          timestamp:
            typeof row.timestamp === 'string' ? row.timestamp : undefined,
        },
      ];
    });
  }

  private mergeChatTurns(existing: ChatTurn[], incoming: ChatTurn[]): ChatTurn[] {
    const merged = [...existing];
    const seen = new Set(
      existing.map((turn) => turn.id || `${turn.role}:${turn.content}`),
    );

    for (const turn of incoming) {
      const key = turn.id || `${turn.role}:${turn.content}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      merged.push(turn);
    }

    return merged;
  }
}
