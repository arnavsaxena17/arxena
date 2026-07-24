import { OrgChartClientIpRuleEntity } from 'src/engine/core-modules/org-chart/org-chart-client-ip-rule.entity';
import { OrgChartClientIpService } from 'src/engine/core-modules/org-chart/services/org-chart-client-ip.service';

describe('OrgChartClientIpService CIDR matching', () => {
  const service = new OrgChartClientIpService({} as never);

  const findRule = (
    clientIp: string,
    rules: OrgChartClientIpRuleEntity[],
  ): OrgChartClientIpRuleEntity | null =>
    (
      service as unknown as {
        findRuleForClientIp: (
          ip: string,
          rules: OrgChartClientIpRuleEntity[],
        ) => OrgChartClientIpRuleEntity | null;
      }
    ).findRuleForClientIp(clientIp, rules);

  const baseRule = (
    ipAddress: string,
    overrides?: Partial<OrgChartClientIpRuleEntity>,
  ): OrgChartClientIpRuleEntity =>
    ({
      id: 'rule-1',
      ipAddress,
      isBlocked: false,
      serveCachedOnly: false,
      totalRequests: 0,
      chartsServed: 0,
      lastUserAgent: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as OrgChartClientIpRuleEntity;

  it('matches exact IP rules', () => {
    const rules = [baseRule('203.0.113.10', { id: 'a' })];
    expect(findRule('203.0.113.10', rules)?.id).toBe('a');
    expect(findRule('203.0.113.11', rules)).toBeNull();
  });

  it('matches CIDR rules', () => {
    const rules = [baseRule('43.173.0.0/16', { id: 'cidr' })];
    expect(findRule('43.173.180.243', rules)?.id).toBe('cidr');
    expect(findRule('43.172.1.1', rules)).toBeNull();
  });

  it('prefers exact IP over broader CIDR', () => {
    const rules = [
      baseRule('43.173.0.0/16', { id: 'cidr', isBlocked: true }),
      baseRule('43.173.180.243', { id: 'host', isBlocked: false }),
    ];
    expect(findRule('43.173.180.243', rules)?.id).toBe('host');
  });
});
