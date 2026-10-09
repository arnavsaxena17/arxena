import { Logger } from '@nestjs/common';

import { type Repository } from 'typeorm';

import {
  BillingTreatmentOverrideService,
  sanitizeBillingTreatmentOverrides,
} from 'src/engine/core-modules/billing/services/billing-treatment-override.service';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

describe('sanitizeBillingTreatmentOverrides', () => {
  it('should keep valid feature and treatment pairs', () => {
    expect(
      sanitizeBillingTreatmentOverrides({
        AI_CHAT: 'SYSTEM',
        EMAIL_SEND: 'OFF',
      }),
    ).toEqual({ AI_CHAT: 'SYSTEM', EMAIL_SEND: 'OFF' });
  });

  it('should drop unknown features and unknown treatments', () => {
    expect(
      sanitizeBillingTreatmentOverrides({
        NOT_A_FEATURE: 'SYSTEM',
        AI_CHAT: 'FREE',
        toString: 'SYSTEM',
      }),
    ).toEqual({});
  });

  it('should return an empty object for null', () => {
    expect(sanitizeBillingTreatmentOverrides(null)).toEqual({});
  });
});

describe('BillingTreatmentOverrideService', () => {
  let service: BillingTreatmentOverrideService;
  let findOne: jest.Mock;
  let update: jest.Mock;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    findOne = jest.fn().mockResolvedValue({
      id: 'ws-1',
      billingTreatmentOverrides: { AI_CHAT: 'SYSTEM' },
    });
    update = jest.fn().mockResolvedValue(undefined);

    service = new BillingTreatmentOverrideService({
      findOne,
      update,
    } as unknown as Repository<WorkspaceEntity>);
  });

  it('should resolve to the override when one is set', async () => {
    await expect(service.resolveTreatment('ws-1', 'AI_CHAT')).resolves.toBe(
      'SYSTEM',
    );
  });

  it('should resolve to the feature default when there is no override', async () => {
    await expect(service.resolveTreatment('ws-1', 'EMAIL_SEND')).resolves.toBe(
      'CUSTOMER',
    );
  });

  it('should read the workspace once within the cache window', async () => {
    await service.resolveTreatment('ws-1', 'AI_CHAT');
    await service.resolveTreatment('ws-1', 'EMAIL_SEND');

    expect(findOne).toHaveBeenCalledTimes(1);
  });

  it('should fall back to defaults instead of failing when the lookup errors', async () => {
    findOne.mockRejectedValue(new Error('db down'));

    await expect(service.resolveTreatment('ws-1', 'AI_CHAT')).resolves.toBe(
      'CUSTOMER',
    );
  });

  it('should store a new override alongside the existing ones', async () => {
    await service.setOverride({
      workspaceId: 'ws-1',
      feature: 'EMAIL_SEND',
      treatment: 'SYSTEM',
      actor: 'admin@example.com',
    });

    expect(update).toHaveBeenCalledWith(
      { id: 'ws-1' },
      {
        billingTreatmentOverrides: { AI_CHAT: 'SYSTEM', EMAIL_SEND: 'SYSTEM' },
      },
    );
    await expect(service.resolveTreatment('ws-1', 'EMAIL_SEND')).resolves.toBe(
      'SYSTEM',
    );
  });

  it('should remove an override when the treatment is null', async () => {
    await service.setOverride({
      workspaceId: 'ws-1',
      feature: 'AI_CHAT',
      treatment: null,
      actor: 'admin@example.com',
    });

    expect(update).toHaveBeenCalledWith(
      { id: 'ws-1' },
      { billingTreatmentOverrides: {} },
    );
    await expect(service.resolveTreatment('ws-1', 'AI_CHAT')).resolves.toBe(
      'CUSTOMER',
    );
  });

  it('should log who changed the override', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn');

    await service.setOverride({
      workspaceId: 'ws-1',
      feature: 'AI_CHAT',
      treatment: 'OFF',
      actor: 'admin@example.com',
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('admin@example.com'),
    );
  });
});
