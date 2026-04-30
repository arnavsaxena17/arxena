import { Injectable } from '@nestjs/common';
import type { OrgChartLinkedinCandidateSource } from 'src/engine/core-modules/org-chart/types/orgchart-linkedin-candidate-source.type';

/**
 * Maps internal profile provider labels (never sent to clients) to opaque public
 * slugs. The mapping is server-only; APIs and org chart JSON must use `ds_*`
 * node fields with these slugs — not raw provider names.
 */
@Injectable()
export class OrgChartProfileDataSourceMapperService {
  /**
   * Opaque slugs (stable, intentionally meaningless to end users).
   * Add new internals by assigning a new slug; never reuse a slug for a different provider.
   */
  private static readonly INTERNAL_TO_SLUG: Readonly<Record<string, string>> = {
    apollo: 'm7kq',
    apify: 'p2nw',
    linkedin_xray: 't9vx',
    unipile: 'h4rj',
    serp: 'q5lm',
    google_serp: 'q5lm',
    bright_data_serp: 'q5lm',
    bright_data: 'q5lm',
    pdl: 'k8fd',
    theorg: 'n3bc',
    linkedin_unipile: 'h4rj',
    linkedin_search: 'h4rj',
    linkedin_classic: 'h4rj',
    linkedin_sales_navigator: 'h4rj',
    linkedin_recruiter: 'h4rj',
    apollo_io: 'm7kq',
    coresignal: 'v2xb',
    contactout: 'c6yt',
  };

  private static readonly UNKNOWN_SLUG = 'u0';

  private static readonly LINKEDIN_CANDIDATE_SOURCE_TO_INTERNAL: Readonly<
    Record<OrgChartLinkedinCandidateSource, string>
  > = {
    unipile: 'unipile',
    apify: 'apify',
    contactout: 'contactout',
    linkedin_xray: 'linkedin_xray',
    m7kq: 'apollo',
    apollo: 'apollo',
  };

  private normalizeInternalKey(raw: string): string {
    return raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  }

  private resolveInternalLabel(
    sourceRaw: unknown,
    fallback?: OrgChartLinkedinCandidateSource,
  ): string | undefined {
    if (typeof sourceRaw === 'string' && sourceRaw.trim().length > 0) {
      return this.normalizeInternalKey(sourceRaw);
    }
    if (fallback) {
      return OrgChartProfileDataSourceMapperService.LINKEDIN_CANDIDATE_SOURCE_TO_INTERNAL[
        fallback
      ];
    }
    return undefined;
  }

  /**
   * Public slug for API/org-chart nodes (`ds_0`, etc.). Never returns internal names.
   */
  toPublicSlugFromRow(
    row: Record<string, unknown>,
    fallback?: OrgChartLinkedinCandidateSource,
  ): string | undefined {
    const internal = this.resolveInternalLabel(row.source, fallback);
    if (!internal) {
      return undefined;
    }
    return (
      OrgChartProfileDataSourceMapperService.INTERNAL_TO_SLUG[internal] ??
      OrgChartProfileDataSourceMapperService.UNKNOWN_SLUG
    );
  }
}
