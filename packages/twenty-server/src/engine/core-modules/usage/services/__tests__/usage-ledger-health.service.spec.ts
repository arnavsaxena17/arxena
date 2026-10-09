import { type EventLogEmitterService } from 'src/engine/core-modules/event-logs/emit/event-log-emitter.service';
import { UsageLedgerHealthService } from 'src/engine/core-modules/usage/services/usage-ledger-health.service';
import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

const buildService = ({
  billingEnabled,
  capPollerEnabled,
  sinkEnabled,
}: {
  billingEnabled: boolean;
  capPollerEnabled: boolean;
  sinkEnabled: boolean;
}) =>
  new UsageLedgerHealthService(
    {
      get: (key: string) =>
        key === 'IS_BILLING_ENABLED' ? billingEnabled : capPollerEnabled,
    } as unknown as TwentyConfigService,
    { isEnabled: () => sinkEnabled } as unknown as EventLogEmitterService,
  );

describe('UsageLedgerHealthService', () => {
  it('should report nothing when billing is disabled', () => {
    const service = buildService({
      billingEnabled: false,
      capPollerEnabled: false,
      sinkEnabled: false,
    });

    expect(service.getConfigurationProblems()).toEqual([]);
  });

  it('should report a missing event sink when billing is enabled', () => {
    const service = buildService({
      billingEnabled: true,
      capPollerEnabled: true,
      sinkEnabled: false,
    });

    expect(service.getConfigurationProblems()).toEqual([
      expect.stringContaining('no usage event sink'),
    ]);
  });

  it('should report the cap poller being off when billing is enabled', () => {
    const service = buildService({
      billingEnabled: true,
      capPollerEnabled: false,
      sinkEnabled: true,
    });

    expect(service.getConfigurationProblems()).toEqual([
      expect.stringContaining('BILLING_USAGE_CAP_CLICKHOUSE_ENABLED'),
    ]);
  });

  it('should report nothing for a healthy configuration', () => {
    const service = buildService({
      billingEnabled: true,
      capPollerEnabled: true,
      sinkEnabled: true,
    });

    expect(service.getConfigurationProblems()).toEqual([]);
  });
});
