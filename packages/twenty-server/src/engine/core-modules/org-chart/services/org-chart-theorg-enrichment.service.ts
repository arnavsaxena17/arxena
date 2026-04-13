import { Injectable, Logger } from '@nestjs/common';
import type { OrgChartData } from 'twenty-shared';

import { TheOrgService } from 'src/engine/core-modules/theorg/services/theorg.service';
import type {
    TheOrgFetchMode,
    TheOrgPerson,
} from 'src/engine/core-modules/theorg/types/theorg.types';

import { normalizePersonForPythonOrgChartBuild } from '../utils/python-org-chart-person.util';
import { OrgChartService } from './org-chart.service';
import { PythonOrgChartService } from './python-org-chart.service';

/**
 * Enriches an existing org chart stored in ES/S3 by fetching the company's
 * leadership from TheOrg, transforming the people into the standardised format
 * the Python org-chart builder expects, and rebuilding a merged org chart that
 * contains both the original (potentially anonymous) nodes and the real-name
 * nodes sourced from TheOrg.
 */
@Injectable()
export class OrgChartTheOrgEnrichmentService {
  private readonly logger = new Logger(OrgChartTheOrgEnrichmentService.name);

  constructor(
    private readonly orgChartService: OrgChartService,
    private readonly theOrgService: TheOrgService,
    private readonly pythonOrgChartService: PythonOrgChartService,
  ) {}

  // ─── Public API ────────────────────────────────────────────────────────────

  async getEnrichedOrgChart(
    companyId: string,
    options: {
      companyName?: string;
      /** TheOrg slug — defaults to companyId */
      theOrgSlug?: string;
      /**
       * LinkedIn company slug from our data (defaults to `companyId`). When set, the
       * TheOrg company page’s “View on LinkedIn” URL must match this slug.
       */
      linkedinCompanySlug?: string;
      theOrgMode?: TheOrgFetchMode;
      country?: string;
      functionRoot?: string;
    } = {},
  ): Promise<Record<string, unknown>> {
    const theOrgSlug = options.theOrgSlug ?? companyId;
    const linkedinCompanySlug = options.linkedinCompanySlug ?? companyId;

    // 1. Load the existing org chart (ES → Redis → S3 → blank template).
    const { data: existingOrgChart } = await this.orgChartService.getOrgChart(
      companyId,
      {
        companyName: options.companyName,
        country: options.country,
        functionRoot: options.functionRoot,
      },
    );

    const resolvedCompanyName =
      (existingOrgChart.job_company_name as string | undefined) ??
      options.companyName ??
      companyId;

    // 2. Extract people already present in the stored org chart.
    const existingPeople = this.extractPeopleFromOrgChart(
      existingOrgChart,
      resolvedCompanyName,
    );
    this.logger.log(
      `Extracted ${existingPeople.length} people from existing org chart for companyId=${companyId}`,
    );

    // 3. Fetch leadership data from TheOrg.
    let theOrgPeople: Record<string, unknown>[] = [];
    let resolvedTheOrgSlug = theOrgSlug;
    try {
      const theOrgData = await this.theOrgService.fetchCompanyDetailsResolvingSlug(
        theOrgSlug,
        {
          mode: options.theOrgMode,
          persist: false,
          linkedinCompanySlug,
        },
      );
      resolvedTheOrgSlug = theOrgData.slug;
      const resolvedTheOrgCompanyName =
        theOrgData.companyName || resolvedCompanyName;
      theOrgPeople = this.transformTheOrgPeople(
        theOrgData.people,
        resolvedTheOrgCompanyName,
      );
      this.logger.log(`The org people ${JSON.stringify(theOrgData)}`)
      if (theOrgData.slugResolution) {
        this.logger.log(
          `TheOrg slug resolved input=${theOrgData.slugResolution.inputSlug} → candidate=${theOrgData.slugResolution.successfulCandidate} (tried ${theOrgData.slugResolution.attemptedSlugs.join(', ')})`,
        );
      }
      this.logger.log(
        `Fetched ${theOrgPeople.length} people from TheOrg for slug=${theOrgData.slug}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to fetch TheOrg data for inputSlug=${theOrgSlug}: ${(error as Error).message}`,
      );
    }

    if (theOrgPeople.length === 0) {
      this.logger.warn(
        `No TheOrg people found for inputSlug=${theOrgSlug}; returning existing org chart`,
      );
      return existingOrgChart;
    }

    // 4. Merge + deduplicate people lists (existing takes priority).
    const allPeople = this.mergePeople(existingPeople, theOrgPeople);
    this.logger.log(
      `Merged people list: ${allPeople.length} total (${existingPeople.length} existing + ${theOrgPeople.length} theorg, deduped)`,
    );

    const chartCountryHint =
      typeof existingOrgChart.country === 'string' &&
      existingOrgChart.country.trim() !== ''
        ? existingOrgChart.country.trim()
        : options.country?.trim();

    const pythonPeople = allPeople.map((person) =>
      normalizePersonForPythonOrgChartBuild(person, {
        companyId,
        companyName: resolvedCompanyName,
        defaultCountry: chartCountryHint,
      }),
    );

    // 5. Rebuild org chart via the Python service.
    let enrichedOrgChart: OrgChartData;
    try {
      enrichedOrgChart =
        await this.pythonOrgChartService.createOrgChartFromStandardizedPeople({
          people: pythonPeople,
          jobName: resolvedCompanyName,
          jobId: companyId,
          functionRoot: options.functionRoot,
          country: chartCountryHint,
        });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Python org chart build failed for companyId=${companyId}: ${message}`,
      );
      throw error instanceof Error
        ? error
        : new Error(`Python org chart build failed: ${message}`);
    }

    // 6. Return the rebuilt chart, preserving the original metadata fields.
    return {
      ...existingOrgChart,
      ...(enrichedOrgChart as Record<string, unknown>),
      company_id: companyId,
      job_company_id:
        (existingOrgChart.job_company_id as string | undefined) ?? companyId,
      job_company_name: resolvedCompanyName,
      org_enriched: true,
      org_slug: resolvedTheOrgSlug,
      org_mode: options.theOrgMode ?? 'combined',
      org_people_count: theOrgPeople.length,
      existing_people_count: existingPeople.length,
      total_people_count: allPeople.length,
    };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Parse the orgchart JSON string from the stored chart and flatten all
   * candidate objects into a standardised people array for Python.
   */
  private extractPeopleFromOrgChart(
    orgChart: Record<string, unknown>,
    companyName: string,
  ): Record<string, unknown>[] {
    const orgchartStr = orgChart.orgchart;
    if (typeof orgchartStr !== 'string' || !orgchartStr) {
      return [];
    }

    let nodes: Array<Record<string, unknown>>;
    try {
      nodes = JSON.parse(orgchartStr) as Array<Record<string, unknown>>;
    } catch {
      this.logger.warn('Failed to parse existing orgchart JSON');
      return [];
    }

    const people: Record<string, unknown>[] = [];

    for (const node of nodes) {
      const rawCandidates = node.candidates;
      if (!rawCandidates) continue;

      const candidateList: Array<Record<string, unknown>> = Array.isArray(
        rawCandidates,
      )
        ? (rawCandidates as Array<Record<string, unknown>>)
        : [rawCandidates as Record<string, unknown>];

      for (const candidate of candidateList) {
        const name = String(candidate.full_name ?? '').trim();
        if (!name || name === 'xx' || name === 'XX') continue;

        people.push({
          full_name: name,
          job_title: String(candidate.job_title ?? ''),
          job_company_name:
            String(
              candidate.job_company_name ?? '',
            ) || companyName,
          std_function: candidate.std_function ?? null,
          std_function_root: candidate.std_function_root ?? null,
          std_grade: candidate.std_grade ?? null,
          std_level: candidate.std_level ?? null,
          location_country:
            String(
              candidate.location_country ?? candidate.location_name ?? '',
            ),
          linkedin_url:
            String(
              candidate.linkedin_url ?? candidate.std_linkedin_url ?? '',
            ),
          profile_picture_url:
            candidate.profile_picture_url ?? candidate.image ?? null,
          category: candidate.category ?? null,
          source: 'existing_orgchart',
        });
      }
    }

    return people;
  }

  /**
   * Transform TheOrg people (TheOrgPerson) into the standardised input format
   * the Python org-chart builder expects.
   *
   * TheOrg people have real names and current job titles (role field) but no
   * pre-computed std_function/std_grade — Python will classify them.
   */
  private transformTheOrgPeople(
    people: TheOrgPerson[],
    companyName: string,
  ): Record<string, unknown>[] {
    return people
      .filter((person) => person.name?.trim())
      .map((person) => ({
        full_name: person.name,
        job_title: person.role ?? '',
        job_company_name: companyName,
        // std_* fields intentionally left null so Python can classify them.
        std_function: null,
        std_function_root: null,
        std_grade: null,
        std_level: null,
        location_country: '',
        source: 'theorg',
        category: 'theorg',
        org_node_id: person.nodeId,
        org_parent_node_id: person.parentNodeId ?? null,
        org_slug: person.slug ?? null,
        linkedin_url: person.linkedInUrl ?? '',
        profile_picture_url: person.profileImageUrl ?? null,
        profile_url: person.profileUrl ?? null,
        section: person.section ?? null,
        report_count: person.reportCount,
      }));
  }

  /**
   * Merge existing + TheOrg people lists.
   * Existing people take priority; TheOrg entries whose name already appears
   * in the existing list are skipped to avoid duplicates.
   */
  private mergePeople(
    existingPeople: Record<string, unknown>[],
    theOrgPeople: Record<string, unknown>[],
  ): Record<string, unknown>[] {
    const seenNames = new Set<string>();
    const merged: Record<string, unknown>[] = [];

    for (const person of [...existingPeople, ...theOrgPeople]) {
      const rawName = person['full_name'] ?? person['name'];
      const normalizedName = String(rawName ?? '').trim().toLowerCase();
      if (!normalizedName) continue;
      if (seenNames.has(normalizedName)) continue;
      seenNames.add(normalizedName);
      merged.push(person);
    }

    return merged;
  }
}
