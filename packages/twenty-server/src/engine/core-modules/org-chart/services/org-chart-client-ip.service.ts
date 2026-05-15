import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';

import { OrgChartClientIpRuleEntity } from 'src/engine/core-modules/org-chart/org-chart-client-ip-rule.entity';
import {
  isCidrNotation,
  isIpv4InCidr,
  normalizeIpOrCidr,
} from 'src/engine/core-modules/org-chart/utils/org-chart-ip-cidr.util';

export type OrgChartClientIpDecision = {
  blocked: boolean;
  serveCachedOnly: boolean;
};

const MAX_USER_AGENT_LEN = 1024;
const RULES_CACHE_TTL_MS = 60_000;

@Injectable()
export class OrgChartClientIpService {
  private rulesCache: {
    rules: OrgChartClientIpRuleEntity[];
    loadedAt: number;
  } | null = null;

  constructor(
    @InjectRepository(OrgChartClientIpRuleEntity, 'core')
    private readonly ruleRepository: Repository<OrgChartClientIpRuleEntity>,
  ) {}

  static parseCloudFrontViewerAddress(
    raw: string | null | undefined,
  ): string | null {
    if (!raw || typeof raw !== 'string') {
      return null;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    if (trimmed.startsWith('[')) {
      const close = trimmed.indexOf(']');
      if (close === -1) {
        return null;
      }
      const ip = trimmed.slice(1, close).trim();
      return ip.length > 0 ? ip : null;
    }
    const lastColon = trimmed.lastIndexOf(':');
    if (lastColon === -1) {
      return trimmed;
    }
    const possiblePort = trimmed.slice(lastColon + 1);
    if (/^\d{1,5}$/.test(possiblePort)) {
      const host = trimmed.slice(0, lastColon).trim();
      return host.length > 0 ? host : null;
    }
    return trimmed;
  }

  private static headerString(
    req: Request,
    name: string,
  ): string | undefined {
    const v = req.headers[name];
    if (typeof v === 'string') {
      return v;
    }
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string') {
      return v[0];
    }
    return undefined;
  }

  static extractClientIpFromRequest(req: Request): string | null {
    const fromWebsiteProxy =
      OrgChartClientIpService.headerString(req, 'x-org-chart-client-ip');
    if (fromWebsiteProxy && fromWebsiteProxy.trim().length > 0) {
      return OrgChartClientIpService.normalizeClientIp(fromWebsiteProxy);
    }
    const cfViewer = OrgChartClientIpService.parseCloudFrontViewerAddress(
      OrgChartClientIpService.headerString(req, 'cloudfront-viewer-address'),
    );
    if (cfViewer) {
      return OrgChartClientIpService.normalizeClientIp(cfViewer);
    }
    const cfConnecting = OrgChartClientIpService.headerString(
      req,
      'cf-connecting-ip',
    )?.trim();
    if (cfConnecting) {
      return OrgChartClientIpService.normalizeClientIp(cfConnecting);
    }
    const trueClient = OrgChartClientIpService.headerString(
      req,
      'true-client-ip',
    )?.trim();
    if (trueClient) {
      return OrgChartClientIpService.normalizeClientIp(trueClient);
    }
    const forwarded = OrgChartClientIpService.headerString(
      req,
      'x-forwarded-for',
    );
    if (forwarded && forwarded.trim().length > 0) {
      const first = forwarded.split(',')[0]?.trim();
      if (first) {
        return OrgChartClientIpService.normalizeClientIp(first);
      }
    }
    const realIp = OrgChartClientIpService.headerString(
      req,
      'x-real-ip',
    )?.trim();
    if (realIp) {
      return OrgChartClientIpService.normalizeClientIp(realIp);
    }
    const socketIp = req.socket?.remoteAddress;
    if (socketIp) {
      return OrgChartClientIpService.normalizeClientIp(
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

  /** Normalizes a client IPv4 address (not CIDR). */
  static normalizeClientIp(raw: string): string | null {
    return normalizeIpOrCidr(raw);
  }

  private invalidateRulesCache(): void {
    this.rulesCache = null;
  }

  private async loadRulesCached(): Promise<OrgChartClientIpRuleEntity[]> {
    const now = Date.now();
    if (
      this.rulesCache &&
      now - this.rulesCache.loadedAt < RULES_CACHE_TTL_MS
    ) {
      return this.rulesCache.rules;
    }
    const rules = await this.ruleRepository.find({
      order: { updatedAt: 'DESC' },
    });
    this.rulesCache = { rules, loadedAt: now };
    return rules;
  }

  private findRuleForClientIp(
    clientIp: string,
    rules: OrgChartClientIpRuleEntity[],
  ): OrgChartClientIpRuleEntity | null {
    const exact = rules.find(
      (rule) =>
        !isCidrNotation(rule.ipAddress) && rule.ipAddress === clientIp,
    );
    if (exact) {
      return exact;
    }
    for (const rule of rules) {
      if (
        isCidrNotation(rule.ipAddress) &&
        isIpv4InCidr(clientIp, rule.ipAddress)
      ) {
        return rule;
      }
    }
    return null;
  }

  /**
   * When a rule exists for this IP (exact or CIDR match), increments totalRequests
   * and returns flags. Returns null when no rule matches.
   */
  async recordRequestAndGetDecision(
    clientIp: string | null,
    clientUserAgent: string | null,
  ): Promise<OrgChartClientIpDecision | null> {
    if (!clientIp) {
      return null;
    }
    const normalized = OrgChartClientIpService.normalizeClientIp(clientIp);
    if (!normalized) {
      return null;
    }

    const rules = await this.loadRulesCached();
    const existing = this.findRuleForClientIp(normalized, rules);
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
    const normalized = OrgChartClientIpService.normalizeClientIp(clientIp);
    if (!normalized) {
      return;
    }

    const rules = await this.loadRulesCached();
    const existing = this.findRuleForClientIp(normalized, rules);
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
    const normalized = normalizeIpOrCidr(input.ipAddress);
    if (!normalized) {
      throw new BadRequestException(
        'Invalid IP address or CIDR (use IPv4 or e.g. 43.173.0.0/16)',
      );
    }

    const existing = await this.ruleRepository.findOne({
      where: { ipAddress: normalized },
    });
    let saved: OrgChartClientIpRuleEntity;
    if (existing) {
      existing.isBlocked = input.isBlocked;
      existing.serveCachedOnly = input.serveCachedOnly;
      saved = await this.ruleRepository.save(existing);
    } else {
      saved = await this.ruleRepository.save(
        this.ruleRepository.create({
          ipAddress: normalized,
          isBlocked: input.isBlocked,
          serveCachedOnly: input.serveCachedOnly,
          totalRequests: 0,
          chartsServed: 0,
        }),
      );
    }
    this.invalidateRulesCache();
    return saved;
  }

  async deleteRule(id: string): Promise<boolean> {
    const res = await this.ruleRepository.delete({ id });
    this.invalidateRulesCache();
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
    this.invalidateRulesCache();
    return true;
  }
}
