import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';

import { OrgChartClientIpRuleEntity } from 'src/engine/core-modules/org-chart/org-chart-client-ip-rule.entity';

export type OrgChartClientIpDecision = {
  blocked: boolean;
  serveCachedOnly: boolean;
};

const MAX_IP_LEN = 64;
const MAX_USER_AGENT_LEN = 1024;

@Injectable()
export class OrgChartClientIpService {
  constructor(
    @InjectRepository(OrgChartClientIpRuleEntity, 'core')
    private readonly ruleRepository: Repository<OrgChartClientIpRuleEntity>,
  ) {}

  static extractClientIpFromRequest(req: Request): string | null {
    const fromProxy = req.headers['x-org-chart-client-ip'];
    if (typeof fromProxy === 'string' && fromProxy.trim().length > 0) {
      return OrgChartClientIpService.normalizeIp(fromProxy);
    }
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
      const first = forwarded.split(',')[0]?.trim();
      if (first) {
        return OrgChartClientIpService.normalizeIp(first);
      }
    }
    const socketIp = req.socket?.remoteAddress;
    if (socketIp) {
      return OrgChartClientIpService.normalizeIp(
        socketIp.replace(/^::ffff:/, ''),
      );
    }
    return null;
  }

  static extractClientUserAgentFromRequest(req: Request): string | null {
    const fromProxy = req.headers['x-org-chart-client-user-agent'];
    if (typeof fromProxy === 'string') {
      const normalized =
        OrgChartClientIpService.normalizeUserAgent(fromProxy);
      if (normalized) {
        return normalized;
      }
    }
    const ua = req.headers['user-agent'];
    if (typeof ua === 'string') {
      return OrgChartClientIpService.normalizeUserAgent(ua);
    }
    return null;
  }

  static normalizeUserAgent(raw: string | null | undefined): string | null {
    if (raw === null || raw === undefined || typeof raw !== 'string') {
      return null;
    }
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return null;
    }
    if (trimmed.length > MAX_USER_AGENT_LEN) {
      return trimmed.slice(0, MAX_USER_AGENT_LEN);
    }
    return trimmed;
  }

  static normalizeIp(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length > MAX_IP_LEN) {
      return null;
    }
    return trimmed;
  }

  /**
   * When a rule exists for this IP, increments totalRequests and returns flags.
   * Returns null when the IP is not on the watch list.
   */
  async recordRequestAndGetDecision(
    clientIp: string | null,
    clientUserAgent: string | null,
  ): Promise<OrgChartClientIpDecision | null> {
    if (!clientIp) {
      return null;
    }
    const normalized = OrgChartClientIpService.normalizeIp(clientIp);
    if (!normalized) {
      return null;
    }

    const existing = await this.ruleRepository.findOne({
      where: { ipAddress: normalized },
    });
    if (!existing) {
      return null;
    }

    await this.ruleRepository.increment(
      { id: existing.id },
      'totalRequests',
      1,
    );

    const normalizedUa =
      OrgChartClientIpService.normalizeUserAgent(clientUserAgent);
    if (normalizedUa) {
      await this.ruleRepository.update(
        { id: existing.id },
        { lastUserAgent: normalizedUa, updatedAt: new Date() },
      );
    }

    const updated = await this.ruleRepository.findOneOrFail({
      where: { id: existing.id },
    });

    return {
      blocked: updated.isBlocked,
      serveCachedOnly: updated.serveCachedOnly,
    };
  }

  async recordChartServed(clientIp: string | null): Promise<void> {
    if (!clientIp) {
      return;
    }
    const normalized = OrgChartClientIpService.normalizeIp(clientIp);
    if (!normalized) {
      return;
    }

    const existing = await this.ruleRepository.findOne({
      where: { ipAddress: normalized },
    });
    if (!existing) {
      return;
    }

    await this.ruleRepository.increment(
      { id: existing.id },
      'chartsServed',
      1,
    );
  }

  shouldCountAsChartServed(payload: Record<string, unknown>): boolean {
    if (payload.is_blank_template === true) {
      return false;
    }
    return true;
  }

  async listRules(): Promise<OrgChartClientIpRuleEntity[]> {
    return this.ruleRepository.find({ order: { updatedAt: 'DESC' } });
  }

  async upsertRule(input: {
    ipAddress: string;
    isBlocked: boolean;
    serveCachedOnly: boolean;
  }): Promise<OrgChartClientIpRuleEntity> {
    const normalized = OrgChartClientIpService.normalizeIp(input.ipAddress);
    if (!normalized) {
      throw new BadRequestException('Invalid IP address');
    }

    const existing = await this.ruleRepository.findOne({
      where: { ipAddress: normalized },
    });
    if (existing) {
      existing.isBlocked = input.isBlocked;
      existing.serveCachedOnly = input.serveCachedOnly;
      return this.ruleRepository.save(existing);
    }

    const created = this.ruleRepository.create({
      ipAddress: normalized,
      isBlocked: input.isBlocked,
      serveCachedOnly: input.serveCachedOnly,
      totalRequests: 0,
      chartsServed: 0,
    });
    return this.ruleRepository.save(created);
  }

  async deleteRule(id: string): Promise<boolean> {
    const res = await this.ruleRepository.delete({ id });
    return (res.affected ?? 0) > 0;
  }

  async resetCounters(id: string): Promise<boolean> {
    const rule = await this.ruleRepository.findOne({ where: { id } });
    if (!rule) {
      return false;
    }
    rule.totalRequests = 0;
    rule.chartsServed = 0;
    await this.ruleRepository.save(rule);
    return true;
  }
}
