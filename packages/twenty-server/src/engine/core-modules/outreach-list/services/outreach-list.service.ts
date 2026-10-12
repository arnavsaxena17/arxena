import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { FileFolder } from 'twenty-shared/types';
import { v4 } from 'uuid';
import { In, type ObjectLiteral } from 'typeorm';

import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { FileStorageService } from 'src/engine/core-modules/file-storage/services/file-storage.service';
import { FileUrlService } from 'src/engine/core-modules/file/file-url/file-url.service';
import {
  OUTREACH_LIST_MAX_ROWS,
  OUTREACH_LIST_PAID_SOURCES,
  OUTREACH_LIST_PEEK_MAX_ROWS,
} from 'src/engine/core-modules/outreach-list/outreach-list.constants';
import {
  type OutreachListDocument,
  type OutreachListEntity,
  type OutreachListIngestResult,
  type OutreachListMeta,
  type OutreachListRow,
  type OutreachListSource,
} from 'src/engine/core-modules/outreach-list/outreach-list.types';
import { OutreachListStoreService } from 'src/engine/core-modules/outreach-list/services/outreach-list-store.service';
import { buildOutreachListCsv } from 'src/engine/core-modules/outreach-list/utils/outreach-list-csv.util';
import {
  normalizeDomain,
  normalizeLinkedinUrl,
} from 'src/engine/core-modules/outreach-list/utils/outreach-list-keys.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

export type OutreachListAggregate = {
  total: number;
  withWebsite: number;
  withLinkedin: number;
  withEmail: number;
  inCrm: number;
  topIndustries: Array<{ name: string; count: number }>;
  topCountries: Array<{ name: string; count: number }>;
};

const topCounts = (
  values: string[],
  limit: number,
): Array<{ name: string; count: number }> => {
  const counts = new Map<string, number>();

  for (const value of values) {
    if (value) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
};

// What the model may see about a list: counts only, never the rows
export const aggregateOutreachListRows = (
  rows: OutreachListRow[],
): OutreachListAggregate => ({
  total: rows.length,
  withWebsite: rows.filter((row) => row.website || row.domain).length,
  withLinkedin: rows.filter((row) => row.linkedinUrl).length,
  withEmail: rows.filter((row) => row.email).length,
  inCrm: rows.filter((row) => row.inCrm === true).length,
  topIndustries: topCounts(
    rows.map((row) => row.industry),
    5,
  ),
  topCountries: topCounts(
    rows.map((row) => row.country),
    5,
  ),
});

const PEEK_FIELDS: Record<OutreachListEntity, Array<keyof OutreachListRow>> = {
  company: ['name', 'website', 'industry', 'country', 'size'],
  people: ['name', 'title', 'companyName', 'location'],
};

type RecordWithLinks = ObjectLiteral & {
  domainName?: { primaryLinkUrl?: string | null } | null;
  linkedinLink?: { primaryLinkUrl?: string | null } | null;
};

const httpVariants = (host: string): string[] => [
  `https://${host}`,
  `https://www.${host}`,
  `http://${host}`,
  `http://www.${host}`,
  `https://${host}/`,
  `https://www.${host}/`,
];

@Injectable()
export class OutreachListService {
  // Appends to one list at a time, so two pages of one search never overwrite
  // each other's rows
  private readonly writeQueues = new Map<string, Promise<unknown>>();

  constructor(
    private readonly store: OutreachListStoreService,
    private readonly fileStorageService: FileStorageService,
    private readonly fileUrlService: FileUrlService,
    private readonly applicationService: ApplicationService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  private enqueue<TValue>(
    workspaceId: string,
    listId: string,
    task: () => Promise<TValue>,
  ): Promise<TValue> {
    const key = `${workspaceId}:${listId}`;
    const previous = this.writeQueues.get(key) ?? Promise.resolve();
    const next = previous.then(task, task);

    this.writeQueues.set(
      key,
      next.catch(() => undefined),
    );

    return next;
  }

  async ingest({
    workspaceId,
    listId,
    name,
    entity,
    source,
    rows,
    query,
    spentUsd = 0,
  }: {
    workspaceId: string;
    listId: string;
    name: string;
    entity: OutreachListEntity;
    source: OutreachListSource;
    rows: OutreachListRow[];
    query?: string;
    spentUsd?: number;
  }): Promise<OutreachListIngestResult> {
    return this.enqueue(workspaceId, listId, async () => {
      const existing = await this.store.load(workspaceId, listId);
      const now = new Date().toISOString();
      const document: OutreachListDocument = existing ?? {
        meta: {
          id: listId,
          workspaceId,
          name,
          entity,
          sources: [],
          rowCount: 0,
          projectIds: [],
          query,
          spentUsd: 0,
          paid: false,
          expiresAt: now,
          createdAt: now,
          updatedAt: now,
        },
        rows: [],
      };
      const seen = new Set(document.rows.map((row) => row.key));
      let added = 0;
      let duplicates = 0;

      for (const row of rows) {
        if (document.rows.length >= OUTREACH_LIST_MAX_ROWS) {
          break;
        }

        if (seen.has(row.key)) {
          duplicates += 1;
          continue;
        }

        seen.add(row.key);
        document.rows.push(row);
        added += 1;
      }

      document.meta.sources = [...new Set([...document.meta.sources, source])];
      document.meta.paid =
        document.meta.paid || OUTREACH_LIST_PAID_SOURCES.includes(source);
      document.meta.spentUsd += spentUsd;
      document.meta.query = document.meta.query ?? query;

      const saved = await this.store.save(document);

      return {
        listId,
        name: saved.meta.name,
        entity: saved.meta.entity,
        added,
        duplicates,
        total: saved.rows.length,
      };
    });
  }

  list(workspaceId: string): Promise<OutreachListMeta[]> {
    return this.store.list(workspaceId);
  }

  // Reading a list keeps it alive, so lists in use do not expire mid-work
  async get(
    workspaceId: string,
    listId: string,
  ): Promise<OutreachListDocument | undefined> {
    const document = await this.store.load(workspaceId, listId);

    return document ? this.store.save(document) : undefined;
  }

  async update(
    workspaceId: string,
    listId: string,
    change: (document: OutreachListDocument) => void,
  ): Promise<OutreachListDocument | undefined> {
    return this.enqueue(workspaceId, listId, async () => {
      const document = await this.store.load(workspaceId, listId);

      if (!document) {
        return undefined;
      }

      change(document);

      return this.store.save(document);
    });
  }

  remove(workspaceId: string, listId: string): Promise<void> {
    return this.store.remove(workspaceId, listId);
  }

  peek(document: OutreachListDocument, offset: number, limit: number) {
    const fields = PEEK_FIELDS[document.meta.entity];
    const size = Math.min(limit, OUTREACH_LIST_PEEK_MAX_ROWS);

    return document.rows
      .slice(offset, offset + size)
      .map((row) =>
        Object.fromEntries(
          fields.map((field) => [field, String(row[field] ?? '').slice(0, 80)]),
        ),
      );
  }

  async exportCsv(
    document: OutreachListDocument,
  ): Promise<{ fileId: string; filename: string; url: string }> {
    const { meta } = document;
    const { workspaceCustomFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId: meta.workspaceId },
      );
    const fileId = v4();
    const filename = `${meta.entity === 'company' ? 'companies' : 'people'}-${meta.id.slice(0, 8)}.csv`;
    const savedFile = await this.fileStorageService.writeFile({
      sourceFile: Buffer.from(
        buildOutreachListCsv(meta.entity, document.rows),
        'utf-8',
      ),
      fileFolder: FileFolder.AgentChat,
      applicationUniversalIdentifier:
        workspaceCustomFlatApplication.universalIdentifier,
      workspaceId: meta.workspaceId,
      resourcePath: `outreach-list-exports/${meta.id}/${fileId}-${filename}`,
      fileId,
      settings: { isTemporaryFile: false, toDelete: false },
    });
    const url = await this.fileUrlService.signFileByIdUrl({
      fileId: savedFile.id,
      workspaceId: meta.workspaceId,
      fileFolder: FileFolder.AgentChat,
    });

    return { fileId: savedFile.id, filename, url };
  }

  // Flags (or removes) rows that already exist as CRM Company / Person records
  async dedupeAgainstCrm(
    workspaceId: string,
    listId: string,
    { remove }: { remove: boolean },
  ): Promise<{ matched: number; removed: number; total: number } | undefined> {
    const current = await this.store.load(workspaceId, listId);

    if (!current) {
      return undefined;
    }

    const entity = current.meta.entity;
    const known = await this.findExistingCrmKeys(
      workspaceId,
      entity,
      current.rows,
    );
    let matched = 0;
    let removed = 0;

    const updated = await this.update(workspaceId, listId, (document) => {
      for (const row of document.rows) {
        row.inCrm = known.has(row.key);

        if (row.inCrm) {
          matched += 1;
        }
      }

      if (remove) {
        const before = document.rows.length;

        document.rows = document.rows.filter((row) => row.inCrm !== true);
        removed = before - document.rows.length;
      }
    });

    return { matched, removed, total: updated?.rows.length ?? 0 };
  }

  // Flags (or removes) rows that already sit in another list of the workspace
  async dedupeAgainstOtherLists(
    workspaceId: string,
    listId: string,
    { remove }: { remove: boolean },
  ): Promise<{ matched: number; removed: number; total: number } | undefined> {
    const current = await this.store.load(workspaceId, listId);

    if (!current) {
      return undefined;
    }

    const others = (await this.store.list(workspaceId)).filter(
      (meta) => meta.id !== listId && meta.entity === current.meta.entity,
    );
    const otherKeys = new Set<string>();

    for (const meta of others) {
      const other = await this.store.load(workspaceId, meta.id);

      other?.rows.forEach((row) => otherKeys.add(row.key));
    }

    let matched = 0;
    let removed = 0;
    const updated = await this.update(workspaceId, listId, (document) => {
      for (const row of document.rows) {
        row.inOtherList = otherKeys.has(row.key);

        if (row.inOtherList) {
          matched += 1;
        }
      }

      if (remove) {
        const before = document.rows.length;

        document.rows = document.rows.filter((row) => row.inOtherList !== true);
        removed = before - document.rows.length;
      }
    });

    return { matched, removed, total: updated?.rows.length ?? 0 };
  }

  private async findExistingCrmKeys(
    workspaceId: string,
    entity: OutreachListEntity,
    rows: OutreachListRow[],
  ): Promise<Set<string>> {
    const known = new Set<string>();
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      if (entity === 'company') {
        const repository =
          await this.globalWorkspaceOrmManager.getRepository<RecordWithLinks>(
            workspaceId,
            'company',
            { shouldBypassPermissionChecks: true },
          );
        const domains = [
          ...new Set(
            rows
              .map((row) => normalizeDomain(row.domain || row.website))
              .filter(isNonEmptyString),
          ),
        ];

        for (let start = 0; start < domains.length; start += 200) {
          const batch = domains.slice(start, start + 200);
          const found = await repository.find({
            where: {
              domainName: {
                primaryLinkUrl: In(batch.flatMap((host) => httpVariants(host))),
              },
            },
          });

          for (const record of found) {
            const host = normalizeDomain(
              record.domainName?.primaryLinkUrl ?? '',
            );

            if (host) {
              known.add(`d:${host}`);
            }
          }
        }

        return;
      }

      const repository =
        await this.globalWorkspaceOrmManager.getRepository<RecordWithLinks>(
          workspaceId,
          'person',
          { shouldBypassPermissionChecks: true },
        );
      const urls = [
        ...new Set(
          rows
            .map((row) => normalizeLinkedinUrl(row.linkedinUrl))
            .filter(isNonEmptyString),
        ),
      ];

      for (let start = 0; start < urls.length; start += 200) {
        const batch = urls.slice(start, start + 200);
        const found = await repository.find({
          where: {
            linkedinLink: {
              primaryLinkUrl: In(batch.flatMap((url) => httpVariants(url))),
            },
          },
        });

        for (const record of found) {
          const url = normalizeLinkedinUrl(
            record.linkedinLink?.primaryLinkUrl ?? '',
          );

          if (url) {
            known.add(`l:${url}`);
          }
        }
      }
    }, authContext);

    return known;
  }
}
