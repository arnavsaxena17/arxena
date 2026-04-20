import { Injectable, Logger } from '@nestjs/common';

import { JSDOM } from 'jsdom';

import { BrightDataResidentialProxyService } from 'src/engine/core-modules/bright-data/services/bright-data-residential-proxy.service';
import { BrightDataSerpService } from 'src/engine/core-modules/bright-data/services/bright-data-serp.service';
import { BrightDataUnlockerService } from 'src/engine/core-modules/bright-data/services/bright-data-unlocker.service';
import { FileStorageService } from 'src/engine/core-modules/file-storage/file-storage.service';
import type {
  TheOfficialBoardCandidate,
  TheOfficialBoardCompanyResponse,
  TheOfficialBoardCompanyProjection,
  TheOfficialBoardDivision,
  TheOfficialBoardFetchCompanyOptions,
  TheOfficialBoardResponseSection,
  TheOfficialBoardSlugResolution,
  TheOfficialBoardStorageLocation,
  TheOfficialBoardStorageTarget,
  TheOfficialBoardSubsidiary,
} from 'src/engine/core-modules/theofficialboard/types/theofficialboard.types';
import {
  generateTheOfficialBoardSlugCandidates,
  normalizeTheOfficialBoardSlugInput,
} from 'src/engine/core-modules/theofficialboard/utils/theofficialboard-slug-candidates.util';
import {
  buildGoogleTheOfficialBoardSiteSearchUrl,
  extractTheOfficialBoardSlugFromSerpOrganic,
} from 'src/engine/core-modules/theofficialboard/utils/theofficialboard-slug-from-serp.util';

const BASE_URL = 'https://www.theofficialboard.com';
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

@Injectable()
export class TheOfficialBoardService {
  private readonly logger = new Logger(TheOfficialBoardService.name);

  constructor(
    private readonly fileStorageService: FileStorageService,
    private readonly brightDataSerpService: BrightDataSerpService,
    private readonly brightDataUnlockerService: BrightDataUnlockerService,
    private readonly brightDataResidentialProxyService: BrightDataResidentialProxyService,
  ) {}

  private get userAgent(): string {
    return process.env.THEOFFICIALBOARD_USER_AGENT || DEFAULT_USER_AGENT;
  }

  private get requestTimeoutMs(): number {
    return Number(process.env.THEOFFICIALBOARD_REQUEST_TIMEOUT_MS ?? 60_000);
  }

  private get storagePrefix(): string {
    return String(
      process.env.THEOFFICIALBOARD_STORAGE_PREFIX ?? 'theofficialboard',
    ).replace(/(^\/+|\/+$)/g, '');
  }

  private get shouldPersist(): boolean {
    return process.env.THEOFFICIALBOARD_PERSIST_RESULTS !== 'false';
  }

  normalizeRequestedSections(
    include?: string | string[] | null,
  ): TheOfficialBoardResponseSection[] {
    const rawValues = Array.isArray(include) ? include : [include];
    const values = rawValues
      .flatMap((value) => String(value ?? '').split(','))
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    if (!values.length || values.includes('all')) {
      return ['all'];
    }

    const allowed = new Set<TheOfficialBoardResponseSection>([
      'company',
      'divisions',
      'subsidiaries',
      'candidates',
    ]);

    return [...new Set(values)].filter((value): value is TheOfficialBoardResponseSection =>
      allowed.has(value as TheOfficialBoardResponseSection),
    );
  }

  projectCompanyResponse(
    result: TheOfficialBoardCompanyResponse,
    sections: TheOfficialBoardResponseSection[],
  ): TheOfficialBoardCompanyProjection {
    const includeAll = sections.includes('all');
    const shouldInclude = (section: TheOfficialBoardResponseSection) =>
      includeAll || sections.includes(section);

    return {
      slug: result.slug,
      companyName: result.companyName,
      sections: includeAll
        ? ['company', 'divisions', 'subsidiaries', 'candidates']
        : sections,
      ...(shouldInclude('company')
        ? {
            company: {
              inputSlug: result.inputSlug,
              slug: result.slug,
              companyName: result.companyName,
              url: result.url,
              websiteUrl: result.websiteUrl,
              executivesCount: result.executivesCount,
              subsidiariesCount: result.subsidiariesCount,
              updatedLabel: result.updatedLabel,
              parentCompanyName: result.parentCompanyName,
              parentCompanySlug: result.parentCompanySlug,
              storage: result.storage,
              slugResolution: result.slugResolution,
            },
          }
        : {}),
      ...(shouldInclude('divisions') ? { divisions: result.divisions } : {}),
      ...(shouldInclude('subsidiaries')
        ? { subsidiaries: result.subsidiaries }
        : {}),
      ...(shouldInclude('candidates') ? { candidates: result.candidates } : {}),
    };
  }

  private sanitizeSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
  }

  private buildStorageLocation(
    slug: string,
    target?: TheOfficialBoardStorageTarget,
  ): TheOfficialBoardStorageLocation {
    const folderPath = [
      this.storagePrefix,
      'companies',
      this.sanitizeSegment(slug),
      ...(target?.folderSegments ?? []).map((segment) =>
        this.sanitizeSegment(segment),
      ),
    ].join('/');
    const filename =
      target?.filename && target.filename.endsWith('.json')
        ? target.filename
        : `${target?.filename || 'latest'}.json`;

    return {
      folderPath,
      filename,
      path: `${folderPath}/${filename}`,
    };
  }

  private async persistJson(
    location: TheOfficialBoardStorageLocation,
    payload: Record<string, unknown>,
  ): Promise<TheOfficialBoardStorageLocation> {
    await this.fileStorageService.write({
      file: JSON.stringify(payload, null, 2),
      name: location.filename,
      folder: location.folderPath,
      mimeType: 'application/json',
    });

    return location;
  }

  private async fetchText(url: string): Promise<string> {
    const headers = {
      'user-agent': this.userAgent,
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      dnt: '1',
      'upgrade-insecure-requests': '1',
    };

    if (this.brightDataUnlockerService.isConfigured()) {
      try {
        const response = await this.brightDataUnlockerService.requestRaw({
          url,
        });

        if (response.statusCode >= 400) {
          throw new Error(`HTTP ${response.statusCode} fetching ${url}`);
        }

        if (/Just a moment|cf-mitigated|Enable JavaScript and cookies to continue/i.test(response.body)) {
          this.logger.warn(
            `Bright Data Unlocker returned challenge content for ${url}; falling back.`,
          );
        } else {
          return response.body;
        }
      } catch (error) {
        this.logger.warn(
          `Bright Data Unlocker fetch failed for ${url}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    if (this.brightDataResidentialProxyService.isConfigured()) {
      const response = await this.brightDataResidentialProxyService.fetchText(url, {
        headers,
        timeoutMs: this.requestTimeoutMs,
        validateStatus: (status) => status >= 200 && status < 400,
      });

      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status} fetching ${url}`);
      }

      return response.data;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildCompanyUrl(slug: string): string {
    return `${BASE_URL}/org-chart/${slug}`;
  }

  private extractWebsiteUrl(document: Document): string | null {
    const websiteLink = Array.from(document.querySelectorAll('a')).find((link) => {
      const href = link.getAttribute('href')?.trim() ?? '';

      return /^https?:\/\//i.test(href) && !href.includes('theofficialboard.com');
    });

    return websiteLink?.getAttribute('href')?.trim() || null;
  }

  private extractCompanyName(document: Document): string {
    const h1 = document.querySelector('h1')?.textContent?.trim();

    if (h1) {
      return h1.replace(/\s+Org Chart$/i, '').trim();
    }

    const ogTitle =
      document
        .querySelector('meta[property="og:title"]')
        ?.getAttribute('content')
        ?.trim() || '';

    if (ogTitle) {
      return ogTitle.replace(/\s+Org Chart.*$/i, '').trim();
    }

    throw new Error('Could not extract company name from The Official Board page');
  }

  private extractCounts(bodyText: string): {
    executivesCount: number | null;
    subsidiariesCount: number | null;
  } {
    const match = bodyText.match(/has\s+([\d,]+)\s+executives?\s+and\s+([\d,]+)\s+subsidiaries/i);

    return {
      executivesCount: match?.[1] ? Number(match[1].replace(/,/g, '')) : null,
      subsidiariesCount: match?.[2] ? Number(match[2].replace(/,/g, '')) : null,
    };
  }

  private extractUpdatedLabel(bodyText: string): string | null {
    const match = bodyText.match(/Updated\s+([^\n]+?)\s+ago/i);

    return match?.[1]?.trim() || null;
  }

  private extractParentCompany(document: Document): {
    parentCompanyName: string | null;
    parentCompanySlug: string | null;
  } {
    const link = Array.from(document.querySelectorAll('a')).find((anchor) => {
      const href = anchor.getAttribute('href')?.trim() ?? '';
      const text = anchor.textContent?.trim() ?? '';

      return href.startsWith('/org-chart/') && /belongs to/i.test(text);
    });

    if (link) {
      return {
        parentCompanyName: link.textContent?.replace(/.*belongs to\s+/i, '').trim() || null,
        parentCompanySlug: this.extractCompanySlugFromHref(
          link.getAttribute('href'),
        ),
      };
    }

    const bodyText = document.body.textContent ?? '';
    const textMatch = bodyText.match(/belongs to\s+([A-Za-z0-9 .,&'/-]+)/i);

    return {
      parentCompanyName: textMatch?.[1]?.trim() || null,
      parentCompanySlug: null,
    };
  }

  private extractCompanySlugFromHref(href: string | null | undefined): string | null {
    if (!href?.trim()) {
      return null;
    }

    try {
      const url = new URL(href, BASE_URL);
      const parts = url.pathname.split('/').filter(Boolean);

      if (parts[0]?.toLowerCase() !== 'org-chart' || !parts[1]) {
        return null;
      }

      return normalizeTheOfficialBoardSlugInput(parts[1]);
    } catch {
      return null;
    }
  }

  private buildCandidateId(box: Element, index: number): string {
    const existingId = box.getAttribute('id')?.trim();

    return existingId || `candidate-${index}`;
  }

  private parseCandidate(
    box: Element,
    index: number,
    sourceSlug: string,
  ): TheOfficialBoardCandidate {
    const rawName = box.querySelector('.oc-name')?.textContent?.trim() || null;
    const displayTitle =
      box.querySelector('.oc-title h3')?.textContent?.replace(/\s+/g, ' ').trim() ||
      null;
    const fullTitle = box.getAttribute('title')?.replace(/\s+/g, ' ').trim() || null;
    const companyContextLink = box.querySelector('.oc-link a');
    const companyContextName = companyContextLink?.textContent?.includes('@')
      ? companyContextLink.textContent.split('@').pop()?.trim() || null
      : (companyContextLink?.textContent?.trim() || null);

    return {
      id: this.buildCandidateId(box, index),
      name: rawName,
      isMasked: Boolean(rawName && /\.\.\.?/.test(rawName)),
      title: fullTitle,
      displayTitle,
      companyContextName,
      companyContextSlug: this.extractCompanySlugFromHref(
        companyContextLink?.getAttribute('href'),
      ),
      parentCandidateId: null,
      topLevel: false,
      divisionKey: null,
      divisionName: null,
      sourceSlug,
    };
  }

  private uniqueStrings(values: Array<string | null | undefined>): string[] {
    return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
  }

  private parseCandidatesAndDivisions(
    document: Document,
    sourceSlug: string,
  ): {
    candidates: TheOfficialBoardCandidate[];
    divisions: TheOfficialBoardDivision[];
  } {
    const topBoardBoxes = Array.from(
      document.querySelectorAll('#orgchart > .board > .board-column .oc-box'),
    );
    const branchRows = Array.from(
      document.querySelectorAll('#orgchart .board-branch-row'),
    );
    const candidatesById = new Map<string, TheOfficialBoardCandidate>();
    const divisions: TheOfficialBoardDivision[] = [];

    topBoardBoxes.forEach((box, index) => {
      const candidate = this.parseCandidate(box, index, sourceSlug);

      candidate.topLevel = true;
      candidatesById.set(candidate.id, candidate);
    });

    branchRows.forEach((row, rowIndex) => {
      const columns = Array.from(row.children).filter((child) =>
        child.classList.contains('board-column'),
      );

      if (!columns.length) {
        return;
      }

      const rootBox = columns[0].querySelector('.oc-box');

      if (!rootBox) {
        return;
      }

      const rootCandidate = this.parseCandidate(
        rootBox,
        topBoardBoxes.length + rowIndex,
        sourceSlug,
      );

      rootCandidate.topLevel = true;
      const divisionName =
        rootCandidate.displayTitle || rootCandidate.title || rootCandidate.name || `Division ${rowIndex + 1}`;
      const divisionKey = normalizeTheOfficialBoardSlugInput(divisionName);

      rootCandidate.divisionKey = divisionKey;
      rootCandidate.divisionName = divisionName;
      candidatesById.set(rootCandidate.id, rootCandidate);

      const childCandidates: TheOfficialBoardCandidate[] = [];

      columns.slice(1).forEach((column, columnIndex) => {
        const nestedBoxes = Array.from(column.querySelectorAll('.oc-box'));

        nestedBoxes.forEach((box, nestedIndex) => {
          const candidate = this.parseCandidate(
            box,
            topBoardBoxes.length + rowIndex + columnIndex + nestedIndex + 1,
            sourceSlug,
          );

          candidate.parentCandidateId = rootCandidate.id;
          candidate.divisionKey = divisionKey;
          candidate.divisionName = divisionName;
          candidatesById.set(candidate.id, candidate);
          childCandidates.push(candidate);
        });
      });

      divisions.push({
        key: divisionKey,
        name: divisionName,
        headCandidateId: rootCandidate.id,
        headCandidateName: rootCandidate.name,
        childDepartmentNames: this.uniqueStrings(
          childCandidates.map((candidate) => candidate.displayTitle || candidate.title),
        ),
        childCandidateIds: childCandidates.map((candidate) => candidate.id),
      });
    });

    return {
      candidates: Array.from(candidatesById.values()),
      divisions,
    };
  }

  private parseSubsidiaryTree(
    list: Element | null,
    level: number,
    parentSlug: string | null,
  ): TheOfficialBoardSubsidiary[] {
    if (!list) {
      return [];
    }

    return Array.from(list.children)
      .filter((child) => child.tagName.toLowerCase() === 'li')
      .map((item) => {
        const anchor = item.querySelector(':scope > a, :scope > span > a');
        const childList = Array.from(item.children).find(
          (child) => child.tagName.toLowerCase() === 'ul',
        );
        const slug = this.extractCompanySlugFromHref(anchor?.getAttribute('href'));

        return {
          name: anchor?.textContent?.trim() || 'Unknown subsidiary',
          slug,
          level,
          parentSlug,
          children: this.parseSubsidiaryTree(childList ?? null, level + 1, slug),
        };
      });
  }

  private parseSubsidiaries(document: Document): TheOfficialBoardSubsidiary[] {
    const rootList =
      document.querySelector('#subsidiaries-bubble ul.obTree') ??
      document.querySelector('ul.obTree');

    return this.parseSubsidiaryTree(rootList, 0, null);
  }

  private parseCompanyPage(
    html: string,
    inputSlug: string,
    slug: string,
  ): TheOfficialBoardCompanyResponse {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const bodyText = document.body.textContent?.replace(/\s+/g, ' ').trim() || '';
    const companyName = this.extractCompanyName(document);
    const { executivesCount, subsidiariesCount } = this.extractCounts(bodyText);
    const { candidates, divisions } = this.parseCandidatesAndDivisions(
      document,
      slug,
    );
    const subsidiaries = this.parseSubsidiaries(document);
    const parentCompany = this.extractParentCompany(document);

    return {
      inputSlug,
      slug,
      companyName,
      url: this.buildCompanyUrl(slug),
      websiteUrl: this.extractWebsiteUrl(document),
      executivesCount,
      subsidiariesCount,
      updatedLabel: this.extractUpdatedLabel(bodyText),
      parentCompanyName: parentCompany.parentCompanyName,
      parentCompanySlug: parentCompany.parentCompanySlug,
      divisions,
      candidates,
      subsidiaries,
    };
  }

  async fetchCompanyDetails(
    slug: string,
    options: TheOfficialBoardFetchCompanyOptions = {},
  ): Promise<TheOfficialBoardCompanyResponse> {
    const normalizedSlug = normalizeTheOfficialBoardSlugInput(slug);
    const html = await this.fetchText(this.buildCompanyUrl(normalizedSlug));
    const result = this.parseCompanyPage(html, normalizedSlug, normalizedSlug);

    if (options.persist ?? this.shouldPersist) {
      const storage = await this.persistJson(
        this.buildStorageLocation(normalizedSlug, options.storageTarget),
        result as unknown as Record<string, unknown>,
      );

      return {
        ...result,
        storage,
      };
    }

    return result;
  }

  async fetchCompanyDetailsResolvingSlug(
    inputSlug: string,
    options: TheOfficialBoardFetchCompanyOptions = {},
  ): Promise<TheOfficialBoardCompanyResponse> {
    const normalizedInput = normalizeTheOfficialBoardSlugInput(inputSlug);
    const attemptedSlugs: string[] = [];
    const candidates = generateTheOfficialBoardSlugCandidates(normalizedInput);

    for (const candidate of candidates) {
      attemptedSlugs.push(candidate);

      try {
        const result = await this.fetchCompanyDetails(candidate, {
          ...options,
          persist: false,
        });

        return {
          ...(await this.persistResultIfNeeded(
            result,
            candidate,
            normalizedInput,
            options,
            {
              inputSlug: normalizedInput,
              attemptedSlugs,
              successfulCandidate: candidate,
            },
          )),
        };
      } catch (error) {
        this.logger.debug(
          `The Official Board slug candidate "${candidate}" failed: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    if (this.brightDataSerpService.isConfigured()) {
      const serp = await this.brightDataSerpService.requestSerpGoogleJson(
        buildGoogleTheOfficialBoardSiteSearchUrl(inputSlug.replace(/-/g, ' ')),
      );
      const discoveredSlug = extractTheOfficialBoardSlugFromSerpOrganic(
        serp.organic,
      );

      if (discoveredSlug && !attemptedSlugs.includes(discoveredSlug)) {
        attemptedSlugs.push(discoveredSlug);

        const result = await this.fetchCompanyDetails(discoveredSlug, {
          ...options,
          persist: false,
        });

        return await this.persistResultIfNeeded(
          result,
          discoveredSlug,
          normalizedInput,
          options,
          {
            inputSlug: normalizedInput,
            attemptedSlugs,
            successfulCandidate: discoveredSlug,
            discoveredViaBrightDataSerp: true,
          },
        );
      }
    }

    throw new Error(
      `Could not resolve The Official Board slug for "${inputSlug}". Attempted: ${attemptedSlugs.join(', ') || 'none'}`,
    );
  }

  private async persistResultIfNeeded(
    result: TheOfficialBoardCompanyResponse,
    slug: string,
    inputSlug: string,
    options: TheOfficialBoardFetchCompanyOptions,
    slugResolution: TheOfficialBoardSlugResolution,
  ): Promise<TheOfficialBoardCompanyResponse> {
    const response: TheOfficialBoardCompanyResponse = {
      ...result,
      inputSlug,
      slug,
      slugResolution,
    };

    if (!(options.persist ?? this.shouldPersist)) {
      return response;
    }

    const storage = await this.persistJson(
      this.buildStorageLocation(slug, options.storageTarget),
      response as unknown as Record<string, unknown>,
    );

    return {
      ...response,
      storage,
    };
  }
}
