import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { MessagingChannel, parseOutreachAnalytics } from 'twenty-shared/arx';
import { isDefined, escapeForIlike } from 'twenty-shared/utils';
import { ILike, type ObjectLiteral } from 'typeorm';

import { buildCreatedByFromSystem } from 'src/engine/core-modules/actor/utils/build-created-by-from-system.util';
import { OutreachCommandMaterializeService } from 'src/engine/core-modules/outreach-command/services/outreach-command-materialize.service';
import { OutreachWorkspaceAuthTokenService } from 'src/engine/core-modules/outreach-command/services/outreach-workspace-auth-token.service';
import { extractLinkedinProfileId } from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-profile-id.util';
import { concatenatedUserBurst } from 'src/engine/core-modules/outreach-command/utils/inbound-reply-window.util';
import { type OutreachCandidateEventKind } from 'src/engine/core-modules/outreach-command/utils/outreach-command-materialize.util';
import { isOutreachSequencerWorkflow } from 'src/engine/core-modules/outreach-command/utils/resolve-outreach-pause-resume-workflow-ids.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type WorkflowRunWorkspaceEntity } from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import { type WorkflowWorkspaceEntity } from 'src/modules/workflow/common/standard-objects/workflow.workspace-entity';

export type OutreachTranscriptChannel = 'LINKEDIN' | 'WHATSAPP' | 'EMAIL';

type ChatTurn = {
  role: string;
  content: string;
  id?: string;
  timestamp?: string;
};

type ChatMessageRecord = ObjectLiteral & {
  id: string;
  candidateId?: string | null;
  personId?: string | null;
  projectsId?: string | null;
  message?: string | null;
  messageObj?: unknown;
  messageObjWithTimeStamp?: unknown;
  typeOfMessage?: string | null;
  channel?: string | null;
  externalMessageId?: string | null;
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
  outreachAnalytics?: unknown;
  linkedinFollowUpCount?: number | null;
};

@Injectable()
export class OutreachMessagePersistService {
  private readonly logger = new Logger(OutreachMessagePersistService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly gtmCommandMaterializeService: OutreachCommandMaterializeService,
    private readonly gtmWorkspaceAuthTokenService: OutreachWorkspaceAuthTokenService,
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
    workflowRunId,
  }: {
    workspaceId: string;
    channel: OutreachTranscriptChannel;
    body: string;
    candidateId?: string | null;
    linkedinProfileId?: string | null;
    phone?: string | null;
    externalMessageId?: string | null;
    chatId?: string | null;
    materializeOutbound?: boolean;
    workflowRunId?: string | null;
  }): Promise<void> {
    if (isNonEmptyString(workflowRunId)) {
      const isSequencerWorkflow = await this.isOutreachSequencerWorkflowRun({
        workspaceId,
        workflowRunId,
      });

      if (!isSequencerWorkflow) {
        return;
      }
    }

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

    await this.materializeCandidateEvent({
      workspaceId,
      event: 'outbound_message',
      candidateId: resolvedCandidateId,
      messagingChannel:
        channel === 'WHATSAPP'
          ? MessagingChannel.WHATSAPP_UNIPILE
          : channel === 'EMAIL'
            ? MessagingChannel.EMAIL
            : MessagingChannel.LINKEDIN_CONNECT,
      workflowRunId,
    });
  }

  async materializeCandidateEvent({
    workspaceId,
    event,
    candidateId,
    linkedinProfileId,
    messagingChannel,
    outboundMessageKind,
    workflowRunId,
  }: {
    workspaceId: string;
    event: OutreachCandidateEventKind;
    candidateId?: string | null;
    linkedinProfileId?: string | null;
    messagingChannel?: string | null;
    outboundMessageKind?: string | null;
    workflowRunId?: string | null;
  }): Promise<void> {
    try {
      if (isNonEmptyString(workflowRunId)) {
        const isSequencerWorkflow =
          await this.isOutreachSequencerWorkflowRun({
            workspaceId,
            workflowRunId,
          });

        if (!isSequencerWorkflow) {
          return;
        }
      }

      const resolvedCandidateId = await this.resolveCandidateId({
        workspaceId,
        candidateId,
        linkedinProfileId,
      });

      if (!isNonEmptyString(resolvedCandidateId)) {
        this.logger.warn(
          `Skip GTM materialize ${event}: no candidate`,
        );

        return;
      }

      const candidate = await this.loadCandidate(
        workspaceId,
        resolvedCandidateId,
      );
      const apiToken =
        await this.gtmWorkspaceAuthTokenService.resolveOrMint(workspaceId);

      const candidateAnalytics = parseOutreachAnalytics(
        candidate?.outreachAnalytics,
      );

      await this.gtmCommandMaterializeService.applyCandidateEvent({
        candidateId: resolvedCandidateId,
        event,
        apiToken,
        messagingChannel,
        outboundMessageKind,
        existingConvertedOnMessageKind: candidateAnalytics?.convertedOnMessageKind,
        existingLastOutboundMessageKind:
          candidateAnalytics?.lastOutboundMessageKind,
      });
    } catch (error) {
      this.logger.warn(
        `GTM materialize ${event} failed: ${
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

  async persistInboundFlush({
    workspaceId,
    candidateId,
    channel,
    turns,
    chatId,
  }: {
    workspaceId: string;
    candidateId: string;
    channel: OutreachTranscriptChannel;
    turns: ChatTurn[];
    chatId?: string | null;
  }): Promise<boolean> {
    if (turns.length === 0) {
      return false;
    }

    await this.mergeTurns({
      workspaceId,
      candidateId,
      channel,
      turns,
      chatId,
      latestExternalMessageId: turns.at(-1)?.id,
      typeOfMessage: channel === 'LINKEDIN' ? 'linkedin' : 'whatsapp-unipile',
      messageFromUserBurst: true,
    });

    return true;
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

          try {
            const byUrl = await candidateRepository.findOne({
              where: {
                linkedinUrlPrimaryLinkUrl: ILike(
                  `%/in/${escapeForIlike(slug)}%`,
                ),
              },
            });

            if (isDefined(byUrl)) {
              return byUrl.id;
            }
          } catch {
            // Composite URL column may be unavailable on older workspaces.
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

  private async loadCandidate(
    workspaceId: string,
    candidateId: string,
  ): Promise<CandidateRecord | null> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const candidateRepository =
          await this.globalWorkspaceOrmManager.getRepository<CandidateRecord>(
            workspaceId,
            'candidate',
            { shouldBypassPermissionChecks: true },
          );

        return candidateRepository.findOne({
          where: { id: candidateId },
        });
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
    messageFromUserBurst,
  }: {
    workspaceId: string;
    candidateId: string;
    channel: OutreachTranscriptChannel;
    turns: ChatTurn[];
    chatId?: string | null;
    latestExternalMessageId?: string | null;
    typeOfMessage: string;
    messageFromUserBurst?: boolean;
  }): Promise<void> {
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const messageRepository =
          await this.globalWorkspaceOrmManager.getRepository<ChatMessageRecord>(
            workspaceId,
            'chatMessage',
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
        const burstContent = concatenatedUserBurst(mergedObj);
        const patch: Record<string, unknown> = {
          message: messageFromUserBurst && burstContent ? burstContent : lastContent,
          messageObj: mergedObj,
          messageObjWithTimeStamp: mergedTs,
          typeOfMessage,
          channel,
          candidateId,
          personId: candidate?.peopleId ?? existing?.personId ?? null,
          projectsId: candidate?.projectsId ?? existing?.projectsId ?? null,
        };

        if (isNonEmptyString(latestExternalMessageId)) {
          patch.externalMessageId = latestExternalMessageId;
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

        // Direct ORM insert skips GraphQL actor side-effects. Pass the nested
        // actor on a plain object (do not repository.create() first — TypeORM
        // create() only copies real columns and drops composite createdBy).
        const systemActor = buildCreatedByFromSystem();
        const createPayload = {
          name: `${channel} ${candidateId.slice(0, 8)}`,
          createdBy: systemActor,
          updatedBy: systemActor,
          ...patch,
        };

        try {
          await messageRepository.save(createPayload);
        } catch {
          const { channel: _channel, externalChatId: _chat, ...rest } = patch;

          await messageRepository.save({
            name: `${channel} ${candidateId.slice(0, 8)}`,
            createdBy: systemActor,
            updatedBy: systemActor,
            ...rest,
          });
        }
      },
      authContext,
    );
  }

  private async findChannelRow(
    messageRepository: {
      find: (options: object) => Promise<ChatMessageRecord[]>;
    },
    candidateId: string,
    channel: OutreachTranscriptChannel,
  ): Promise<ChatMessageRecord | null> {
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

  // Workflow action side-effects only for Stage B / Stage C runs.
  private async isOutreachSequencerWorkflowRun({
    workspaceId,
    workflowRunId,
  }: {
    workspaceId: string;
    workflowRunId: string;
  }): Promise<boolean> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const workflowRunRepository =
          await this.globalWorkspaceOrmManager.getRepository<WorkflowRunWorkspaceEntity>(
            workspaceId,
            'workflowRun',
            { shouldBypassPermissionChecks: true },
          );
        const workflowRun = await workflowRunRepository.findOne({
          where: { id: workflowRunId },
        });

        if (!isDefined(workflowRun?.workflowId)) {
          return false;
        }

        const workflowRepository =
          await this.globalWorkspaceOrmManager.getRepository<WorkflowWorkspaceEntity>(
            workspaceId,
            'workflow',
            { shouldBypassPermissionChecks: true },
          );
        const workflow = await workflowRepository.findOne({
          where: { id: workflowRun.workflowId },
        });

        let project:
          | (ObjectLiteral & {
              outreachWorkflowId?: string | null;
              outreachConfig?: unknown;
              experimentConfig?: string | null;
            })
          | null = null;

        if (isNonEmptyString(workflowRun.candidateId)) {
          const candidate = await this.loadCandidate(
            workspaceId,
            workflowRun.candidateId,
          );

          if (isNonEmptyString(candidate?.projectsId)) {
            const projectRepository =
              await this.globalWorkspaceOrmManager.getRepository<
                ObjectLiteral & {
                  id: string;
                  outreachWorkflowId?: string | null;
                  outreachConfig?: unknown;
                  experimentConfig?: string | null;
                }
              >(workspaceId, 'project', {
                shouldBypassPermissionChecks: true,
              });
            project = await projectRepository.findOne({
              where: { id: candidate.projectsId },
            });
          }
        }

        return isOutreachSequencerWorkflow({
          workflowId: workflowRun.workflowId,
          workflowName: workflow?.name,
          outreachWorkflowId: project?.outreachWorkflowId,
          outreachConfig: project?.outreachConfig,
          experimentConfig: project?.experimentConfig,
        });
      },
      authContext,
    );
  }
}
