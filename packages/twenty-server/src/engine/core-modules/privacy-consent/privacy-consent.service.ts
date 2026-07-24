import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { isValidUuid, PRIVACY_POLICY_VERSION } from 'twenty-shared';
import { Repository } from 'typeorm';

import { RecordWebsitePrivacyConsentDto } from './dto/record-website-privacy-consent.dto';
import {
    PrivacyConsentActionEnum,
    PrivacyConsentEventEntity,
    PrivacyConsentSourceEnum,
    PrivacyConsentTypeEnum,
    type PrivacyConsentCategoriesJson,
} from './privacy-consent-event.entity';

export type RecordSignupPrivacyConsentInput = {
  userId: string;
  visitorId?: string;
  policyVersion?: string;
  userAgent?: string;
  locale?: string;
};

@Injectable()
export class PrivacyConsentService {
  private readonly logger = new Logger(PrivacyConsentService.name);

  constructor(
    @InjectRepository(PrivacyConsentEventEntity, 'core')
    private readonly privacyConsentRepository: Repository<PrivacyConsentEventEntity>,
  ) {}

  async recordWebsiteCookieConsent(
    input: RecordWebsitePrivacyConsentDto,
    metadata: { userAgent?: string },
  ): Promise<PrivacyConsentEventEntity> {
    this.assertValidVisitorId(input.visitorId);
    this.assertValidCategories(input.categories);

    const event = this.privacyConsentRepository.create({
      visitorId: input.visitorId,
      userId: null,
      consentType: PrivacyConsentTypeEnum.COOKIE_BANNER,
      policyVersion: input.policyVersion,
      action: input.action as PrivacyConsentActionEnum,
      categories: input.categories,
      source: PrivacyConsentSourceEnum.WEBSITE,
      userAgent: metadata.userAgent ?? null,
      locale: input.locale ?? null,
      linkedAt: null,
    });

    const saved = await this.privacyConsentRepository.save(event);

    this.logger.log(
      `Recorded website cookie consent visitorId=${input.visitorId} action=${input.action}`,
    );

    return saved;
  }

  async recordSignupConsent(
    input: RecordSignupPrivacyConsentInput,
  ): Promise<void> {
    const policyVersion = input.policyVersion ?? PRIVACY_POLICY_VERSION;
    const now = new Date();

    await this.privacyConsentRepository.save(
      this.privacyConsentRepository.create({
        userId: input.userId,
        visitorId: input.visitorId ?? input.userId,
        consentType: PrivacyConsentTypeEnum.TERMS_AT_SIGNUP,
        policyVersion,
        action: PrivacyConsentActionEnum.ACCEPT_ALL,
        categories: {
          necessary: true,
          analytics: false,
          functional: false,
        },
        source: PrivacyConsentSourceEnum.APP,
        userAgent: input.userAgent ?? null,
        locale: input.locale ?? null,
        linkedAt: now,
      }),
    );

    if (input.visitorId) {
      await this.linkVisitorConsentsToUser(input.visitorId, input.userId, now);
    }

    this.logger.log(
      `Recorded signup privacy consent userId=${input.userId} visitorId=${input.visitorId ?? 'none'}`,
    );
  }

  private async linkVisitorConsentsToUser(
    visitorId: string,
    userId: string,
    linkedAt: Date,
  ): Promise<void> {
    this.assertValidVisitorId(visitorId);

    const visitorEvents = await this.privacyConsentRepository.find({
      where: {
        visitorId,
        consentType: PrivacyConsentTypeEnum.COOKIE_BANNER,
      },
      order: { createdAt: 'ASC' },
    });

    if (visitorEvents.length === 0) {
      return;
    }

    for (const event of visitorEvents) {
      event.userId = userId;
      event.linkedAt = linkedAt;
    }

    await this.privacyConsentRepository.save(visitorEvents);
  }

  private assertValidVisitorId(visitorId: string): void {
    if (!isValidUuid(visitorId)) {
      throw new BadRequestException('Invalid visitorId');
    }
  }

  private assertValidCategories(
    categories: PrivacyConsentCategoriesJson,
  ): void {
    if (categories.necessary !== true) {
      throw new BadRequestException('Necessary cookies must remain enabled');
    }

    if (
      typeof categories.analytics !== 'boolean' ||
      typeof categories.functional !== 'boolean'
    ) {
      throw new BadRequestException('Invalid consent categories');
    }
  }
}
