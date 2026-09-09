import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { type ObjectRecordCreateEvent } from 'twenty-shared/database-events';
import { MessageParticipantRole } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { In, type ObjectLiteral } from 'typeorm';

import { OnDatabaseBatchEvent } from 'src/engine/api/graphql/graphql-query-runner/decorators/on-database-batch-event.decorator';
import { DatabaseEventAction } from 'src/engine/api/graphql/graphql-query-runner/enums/database-event-action';
import { OutreachInboundReplyWindowService } from 'src/engine/core-modules/outreach-command/jobs/outreach-inbound-reply-window.job';
import { OutreachMessagePersistService } from 'src/engine/core-modules/outreach-command/services/outreach-message-persist.service';
import { OutreachWorkspaceAuthTokenService } from 'src/engine/core-modules/outreach-command/services/outreach-workspace-auth-token.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { WorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/workspace-event-batch.type';
import { MessageDirection } from 'src/modules/messaging/common/enums/message-direction.enum';

type MessageChannelAssociationRecord = {
  messageId?: string | null;
  direction?: string | null;
  messageExternalId?: string | null;
};

type MessageRecord = ObjectLiteral & {
  id: string;
  text?: string | null;
  subject?: string | null;
  headerMessageId?: string | null;
  receivedAt?: Date | string | null;
};

type MessageParticipantRecord = ObjectLiteral & {
  messageId?: string | null;
  role?: string | null;
  handle?: string | null;
  personId?: string | null;
};

@Injectable()
export class OutreachInboundEmailListener {
  private readonly logger = new Logger(OutreachInboundEmailListener.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly gtmOutreachMessagePersistService: OutreachMessagePersistService,
    private readonly gtmInboundReplyWindowService: OutreachInboundReplyWindowService,
    private readonly gtmWorkspaceAuthTokenService: OutreachWorkspaceAuthTokenService,
  ) {}

  @OnDatabaseBatchEvent(
    'messageChannelMessageAssociation',
    DatabaseEventAction.CREATED,
  )
  async handleIncomingEmailAssociationCreated(
    payload: WorkspaceEventBatch<
      ObjectRecordCreateEvent<MessageChannelAssociationRecord>
    >,
  ): Promise<void> {
    const incomingMessageIds = [
      ...new Set(
        payload.events
          .map((event) => event.properties.after)
          .filter(
            (association) =>
              association.direction === MessageDirection.INCOMING &&
              isNonEmptyString(association.messageId),
          )
          .map((association) => association.messageId as string),
      ),
    ];

    if (incomingMessageIds.length === 0) {
      return;
    }

    const workspaceId = payload.workspaceId;
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const messageRepository =
        await this.globalWorkspaceOrmManager.getRepository<MessageRecord>(
          workspaceId,
          'message',
          { shouldBypassPermissionChecks: true },
        );
      const participantRepository =
        await this.globalWorkspaceOrmManager.getRepository<MessageParticipantRecord>(
          workspaceId,
          'messageParticipant',
          { shouldBypassPermissionChecks: true },
        );
      const messages = await messageRepository.find({
        where: { id: In(incomingMessageIds) },
      });
      const participants = await participantRepository.find({
        where: {
          messageId: In(incomingMessageIds),
          role: MessageParticipantRole.FROM,
        },
      });
      const participantsByMessageId = new Map<
        string,
        MessageParticipantRecord[]
      >();

      for (const participant of participants) {
        if (!isNonEmptyString(participant.messageId)) {
          continue;
        }

        const existing = participantsByMessageId.get(participant.messageId);

        if (isDefined(existing)) {
          existing.push(participant);
        } else {
          participantsByMessageId.set(participant.messageId, [participant]);
        }
      }

      let apiToken: string | null = null;

      for (const message of messages) {
        const fromParticipants = participantsByMessageId.get(message.id) ?? [];
        const content = [message.subject, message.text]
          .filter(isNonEmptyString)
          .join('\n\n')
          .trim();

        if (!isNonEmptyString(content) || fromParticipants.length === 0) {
          continue;
        }

        const match =
          await this.gtmOutreachMessagePersistService.findOutreachCandidateForInboundEmail(
            {
              workspaceId,
              fromEmail: fromParticipants[0]?.handle,
              personId: fromParticipants[0]?.personId,
            },
          );

        if (!isDefined(match)) {
          continue;
        }

        if (!isNonEmptyString(apiToken)) {
          apiToken =
            await this.gtmWorkspaceAuthTokenService.resolveOrMint(workspaceId);
        }

        if (!isNonEmptyString(apiToken)) {
          this.logger.warn(
            `Skip inbound email flush: no API token for workspace ${workspaceId}`,
          );

          return;
        }

        const receivedAt =
          message.receivedAt instanceof Date
            ? message.receivedAt.toISOString()
            : typeof message.receivedAt === 'string'
              ? message.receivedAt
              : new Date().toISOString();

        await this.gtmInboundReplyWindowService.schedule({
          workspaceId,
          candidateId: match.candidateId,
          delayMinutes: match.delayMinutes,
          apiToken,
          kind: 'outreach',
          channel: 'EMAIL',
          turn: {
            role: 'user',
            content,
            externalMessageId: message.headerMessageId ?? message.id,
            receivedAt,
          },
        });
      }
    }, authContext);
  }
}
