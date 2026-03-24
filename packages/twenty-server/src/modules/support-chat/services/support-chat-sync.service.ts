import { Injectable, Logger } from '@nestjs/common';

import { ILike } from 'typeorm';
import { v4 } from 'uuid';

import { FieldActorSource } from 'src/engine/metadata-modules/field-metadata/composite-types/actor.composite-type';
import { TwentyORMGlobalManager } from 'src/engine/twenty-orm/twenty-orm-global.manager';
import { CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';
import { PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';
import { SupportChatConfigService } from 'src/modules/support-chat/services/support-chat-config.service';
import {
  NormalizedSupportChatEvent,
  SupportAiDecision,
} from 'src/modules/support-chat/types/chatwoot.types';
import { TimelineActivityWorkspaceEntity } from 'src/modules/timeline/standard-objects/timeline-activity.workspace-entity';

const COMMON_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
]);

@Injectable()
export class SupportChatSyncService {
  private readonly logger = new Logger(SupportChatSyncService.name);

  constructor(
    private readonly twentyORMGlobalManager: TwentyORMGlobalManager,
    private readonly supportChatConfigService: SupportChatConfigService,
  ) {}

  async syncConversation(
    event: NormalizedSupportChatEvent,
    aiDecision: SupportAiDecision,
  ) {
    const workspaceId = this.supportChatConfigService.getSupportWorkspaceId();
    const companyId = await this.ensureCompany(workspaceId, event);
    const personId = await this.ensurePerson(workspaceId, event, companyId);

    await this.writeTimelineActivity(workspaceId, {
      personId,
      companyId,
      event,
      aiDecision,
    });

    return { workspaceId, personId, companyId };
  }

  private async ensureCompany(
    workspaceId: string,
    event: NormalizedSupportChatEvent,
  ): Promise<string | null> {
    const domain = this.getCompanyDomain(event.contact.email, event.contact.companyDomain);

    if (!domain) {
      return null;
    }

    const repository =
      await this.twentyORMGlobalManager.getRepositoryForWorkspace(
        workspaceId,
        CompanyWorkspaceEntity,
      );

    const existing = await repository.findOne({
      where: {
        domainName: {
          primaryLinkUrl: ILike(`%${domain}%`),
        },
      },
    });

    if (existing?.id) {
      return existing.id;
    }

    const position = ((await repository.maximum('position')) ?? 0) + 1;
    const created = await repository.save({
      id: v4(),
      name: this.domainToCompanyName(domain),
      domainName: {
        primaryLinkUrl: `https://${domain}`,
      },
      createdBy: {
        source: FieldActorSource.SYSTEM,
        workspaceMemberId: null,
        name: 'Arxena Support Chat',
        context: {},
      },
      address: {
        addressCity: '',
      },
      position,
    });

    return created.id;
  }

  private async ensurePerson(
    workspaceId: string,
    event: NormalizedSupportChatEvent,
    companyId: string | null,
  ): Promise<string | null> {
    if (!event.contact.email && !event.contact.phoneNumber && !event.contact.name) {
      return null;
    }

    const repository =
      await this.twentyORMGlobalManager.getRepositoryForWorkspace(
        workspaceId,
        PersonWorkspaceEntity,
      );

    let existing: PersonWorkspaceEntity | null = null;

    if (event.contact.email) {
      existing = await repository.findOne({
        where: {
          emails: {
            primaryEmail: ILike(event.contact.email),
          },
        },
      });
    }

    if (!existing && event.contact.name) {
      const { firstName, lastName } = this.splitName(event.contact.name);
      existing = await repository.findOne({
        where: {
          name: {
            firstName: ILike(firstName),
            lastName: ILike(lastName),
          },
        },
      });
    }

    if (existing?.id) {
      const patch: Partial<PersonWorkspaceEntity> = {};

      if (!existing.companyId && companyId) {
        patch.companyId = companyId;
      }

      if (!existing.phones?.primaryPhoneNumber && event.contact.phoneNumber) {
        patch.phones = {
          primaryPhoneNumber: event.contact.phoneNumber,
          primaryPhoneCountryCode: '',
          primaryPhoneCallingCode: '',
          additionalPhones: null,
        };
      }

      if (Object.keys(patch).length > 0) {
        await repository.save({
          id: existing.id,
          ...patch,
        });
      }

      return existing.id;
    }

    const position = ((await repository.maximum('position')) ?? 0) + 1;
    const { firstName, lastName } = this.splitName(event.contact.name);
    const created = await repository.save({
      id: v4(),
      name: {
        firstName,
        lastName,
      },
      emails: {
        primaryEmail: event.contact.email ?? '',
        additionalEmails: null,
      },
      companyId,
      phones: {
        primaryPhoneNumber: event.contact.phoneNumber ?? '',
        primaryPhoneCountryCode: '',
        primaryPhoneCallingCode: '',
        additionalPhones: null,
      },
      createdBy: {
        source: FieldActorSource.SYSTEM,
        workspaceMemberId: null,
        name: 'Arxena Support Chat',
        context: {},
      },
      position,
      city: '',
      jobTitle: '',
      phone: event.contact.phoneNumber ?? '',
      avatarUrl: '',
    });

    return created.id;
  }

  private async writeTimelineActivity(
    workspaceId: string,
    args: {
      personId: string | null;
      companyId: string | null;
      event: NormalizedSupportChatEvent;
      aiDecision: SupportAiDecision;
    },
  ) {
    const { personId, companyId, event, aiDecision } = args;
    const properties = {
      channel: 'chatwoot',
      event: event.event,
      conversationId: event.conversationId,
      displayId: event.displayId,
      conversationStatus: event.conversationStatus,
      content: event.content,
      summary: aiDecision.summary,
      aiDecision: aiDecision.decision,
      aiReason: aiDecision.reason,
      labels: event.labels,
      referer: event.referer,
      contactEmail: event.contact.email,
      contactPhoneNumber: event.contact.phoneNumber,
      chatwootConversationUrl: this.buildConversationUrl(
        event.accountId,
        event.conversationId,
      ),
    };
    const repository =
      await this.twentyORMGlobalManager.getRepositoryForWorkspace(
        workspaceId,
        TimelineActivityWorkspaceEntity,
      );

    await repository.save({
      id: v4(),
      name: 'support-chat-conversation',
      happensAt: event.createdAt ? new Date(event.createdAt) : new Date(),
      properties: properties as unknown as JSON,
      linkedRecordCachedName: `Chatwoot conversation #${event.displayId ?? event.conversationId}`,
      linkedRecordId: event.conversationId,
      linkedObjectMetadataId: null,
      workspaceMemberId: null,
      personId,
      companyId,
    });
  }

  private buildConversationUrl(
    accountId: string | undefined,
    conversationId: string,
  ) {
    const { baseUrl } = this.supportChatConfigService.getChatwootApiConfig();

    if (!accountId) {
      return `${baseUrl}/app/accounts`;
    }

    return `${baseUrl}/app/accounts/${accountId}/conversations/${conversationId}`;
  }

  private getCompanyDomain(
    email?: string,
    explicitDomain?: string,
  ): string | null {
    if (explicitDomain) {
      return explicitDomain;
    }

    if (!email || !email.includes('@')) {
      return null;
    }

    const domain = email.split('@')[1]?.toLowerCase();

    if (!domain || COMMON_EMAIL_DOMAINS.has(domain)) {
      return null;
    }

    return domain;
  }

  private splitName(name?: string) {
    if (!name?.trim()) {
      return { firstName: 'Support', lastName: 'Visitor' };
    }

    const [firstName, ...rest] = name.trim().split(/\s+/);

    return {
      firstName,
      lastName: rest.join(' '),
    };
  }

  private domainToCompanyName(domain: string) {
    return domain
      .split('.')
      .slice(0, 1)
      .join('')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}
