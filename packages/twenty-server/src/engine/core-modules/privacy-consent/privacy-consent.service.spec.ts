import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import {
    PrivacyConsentActionEnum,
    PrivacyConsentEventEntity,
    PrivacyConsentSourceEnum,
    PrivacyConsentTypeEnum,
} from './privacy-consent-event.entity';
import { PrivacyConsentService } from './privacy-consent.service';

describe('PrivacyConsentService', () => {
  let service: PrivacyConsentService;
  let repository: jest.Mocked<Repository<PrivacyConsentEventEntity>>;

  const visitorId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';

  beforeEach(async () => {
    repository = {
      create: jest.fn((value) => value as PrivacyConsentEventEntity),
      save: jest.fn(async (value) => value as PrivacyConsentEventEntity),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<PrivacyConsentEventEntity>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrivacyConsentService,
        {
          provide: getRepositoryToken(PrivacyConsentEventEntity, 'core'),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(PrivacyConsentService);
  });

  it('records website cookie consent for anonymous visitors', async () => {
    console.log('test: records website cookie consent for anonymous visitors');

    await service.recordWebsiteCookieConsent(
      {
        visitorId,
        action: 'reject_all',
        policyVersion: '2025-03-27',
        categories: {
          necessary: true,
          analytics: false,
          functional: false,
        },
      },
      { userAgent: 'jest-agent' },
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        visitorId,
        userId: null,
        consentType: PrivacyConsentTypeEnum.COOKIE_BANNER,
        action: PrivacyConsentActionEnum.REJECT_ALL,
        source: PrivacyConsentSourceEnum.WEBSITE,
        userAgent: 'jest-agent',
      }),
    );
    expect(repository.save).toHaveBeenCalled();
  });

  it('records signup consent and links prior visitor events', async () => {
    console.log('test: records signup consent and links prior visitor events');

    const visitorEvent = {
      id: 'event-1',
      visitorId,
      userId: null,
      consentType: PrivacyConsentTypeEnum.COOKIE_BANNER,
      linkedAt: null,
    } as PrivacyConsentEventEntity;

    repository.find.mockResolvedValue([visitorEvent]);

    await service.recordSignupConsent({
      userId,
      visitorId,
      policyVersion: '2025-03-27',
      locale: 'en',
    });

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        consentType: PrivacyConsentTypeEnum.TERMS_AT_SIGNUP,
        source: PrivacyConsentSourceEnum.APP,
      }),
    );
    expect(visitorEvent.userId).toBe(userId);
    expect(visitorEvent.linkedAt).toBeInstanceOf(Date);
  });
});
