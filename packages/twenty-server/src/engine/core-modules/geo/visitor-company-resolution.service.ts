import { Injectable, Logger } from '@nestjs/common';

import { ClickHouseService } from 'src/database/clickHouse/clickHouse.service';
import { IpCompanyResolutionService } from 'src/engine/core-modules/geo/ip-company-resolution.service';

export type VisitorResolutionRecord = {
  ip: string;
  companyName: string | null;
  domain: string | null;
  asn: string | null;
  asnOwner: string | null;
  rdnsHostname: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  source: string | null;
  path?: string;
  workspaceId?: string;
};

const TABLE_NAME = 'visitor_company_resolution';

/**
 * Resolves a visitor's IP to a company via IpCompanyResolutionService and
 * persists the result to ClickHouse (visitor_company_resolution table).
 *
 * The table is created on first write if it does not exist. If ClickHouse is
 * unavailable, resolution still returns but `persisted` is false.
 *
 * GDPR note: this stores visitor IPs + resolved companies. The caller (e.g. the
 * marketing site) is responsible for obtaining consent before firing this for
 * EU traffic. This service is intentionally unauthenticated when exposed via
 * the controller because it is a tracking call from a public page.
 */
@Injectable()
export class VisitorCompanyResolutionService {
  private readonly logger = new Logger(VisitorCompanyResolutionService.name);

  constructor(
    private readonly ipCompanyResolutionService: IpCompanyResolutionService,
    private readonly clickHouseService: ClickHouseService,
  ) {}

  async resolveAndRecord(
    ip: string,
    opts?: { path?: string; workspaceId?: string },
  ): Promise<VisitorResolutionRecord & { persisted: boolean }> {
    const resolution =
      await this.ipCompanyResolutionService.resolveCompanyByIp(ip);

    const record: VisitorResolutionRecord = {
      ip,
      companyName: resolution.companyName,
      domain: resolution.domain,
      asn: resolution.asn,
      asnOwner: resolution.asnOwner,
      rdnsHostname: resolution.rdnsHostname,
      confidence: resolution.confidence,
      source: resolution.source,
      path: opts?.path,
      workspaceId: opts?.workspaceId,
    };

    const persisted = await this.persist(record);

    return { ...record, persisted };
  }

  private async persist(
    record: VisitorResolutionRecord,
  ): Promise<boolean> {
    try {
      const client = this.clickHouseService.getClient();
      if (!client) {
        return false;
      }

      await client.command({
        query: `
          CREATE TABLE IF NOT EXISTS ${TABLE_NAME}
          (
            ip String,
            company_name Nullable(String),
            domain Nullable(String),
            asn Nullable(String),
            asn_owner Nullable(String),
            rdns_hostname Nullable(String),
            confidence LowCardinality(String),
            source Nullable(String),
            path Nullable(String),
            workspace_id Nullable(String),
            resolved_at DateTime DEFAULT now()
          )
          ENGINE = MergeTree()
          ORDER BY (resolved_at, ip)
        `,
      });

      await client.insert({
        table: TABLE_NAME,
        values: [
          {
            ip: record.ip,
            company_name: record.companyName,
            domain: record.domain,
            asn: record.asn,
            asn_owner: record.asnOwner,
            rdns_hostname: record.rdnsHostname,
            confidence: record.confidence,
            source: record.source,
            path: record.path,
            workspace_id: record.workspaceId,
          },
        ],
        clickhouse_settings: { async_insert: 1, wait_end_of_query: 1 },
      });

      return true;
    } catch (error) {
      this.logger.warn('[VisitorCompanyResolutionService] persist failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
