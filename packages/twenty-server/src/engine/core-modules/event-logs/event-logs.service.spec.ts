import { EventLogTable } from 'twenty-shared/types';

import { ClickHouseService } from 'src/database/clickHouse/clickHouse.service';
import { BillingService } from 'src/engine/core-modules/billing/services/billing.service';
import { EnterprisePlanService } from 'src/engine/core-modules/enterprise/services/enterprise-plan.service';
import { EventLogsExceptionCode } from 'src/engine/core-modules/event-logs/event-logs.exception';
import { EventLogsService } from 'src/engine/core-modules/event-logs/event-logs.service';

describe('EventLogsService.validateAccess', () => {
  let service: EventLogsService;
  let getMainClient: jest.Mock;
  let hasEntitlement: jest.Mock;
  let isValid: jest.Mock;

  beforeEach(() => {
    getMainClient = jest.fn().mockReturnValue({});
    hasEntitlement = jest.fn().mockResolvedValue(true);
    isValid = jest.fn().mockReturnValue(true);

    service = new EventLogsService(
      { getMainClient } as unknown as ClickHouseService,
      { hasEntitlement } as unknown as BillingService,
      { isValid } as unknown as EnterprisePlanService,
      {} as never,
    );
  });

  const validateAccessError = async (table: EventLogTable) =>
    service.validateAccess('ws-1', table).then(
      () => undefined,
      (error) => error,
    );

  it('throws CLICKHOUSE_NOT_CONFIGURED when ClickHouse is unavailable', async () => {
    getMainClient.mockReturnValue(undefined);

    const error = await validateAccessError(EventLogTable.WORKSPACE_EVENT);

    expect(error?.code).toBe(EventLogsExceptionCode.CLICKHOUSE_NOT_CONFIGURED);
  });

  it('allows every log table with no entitlement check', async () => {
    isValid.mockReturnValue(false);
    hasEntitlement.mockResolvedValue(false);

    for (const table of Object.values(EventLogTable)) {
      await expect(
        service.validateAccess('ws-1', table),
      ).resolves.toBeUndefined();
    }

    expect(hasEntitlement).not.toHaveBeenCalled();
  });
});
