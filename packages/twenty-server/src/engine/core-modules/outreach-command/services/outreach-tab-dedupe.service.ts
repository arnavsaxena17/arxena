import { Injectable } from '@nestjs/common';

import { In, type ObjectLiteral } from 'typeorm';

import {
  type OutreachEntity,
  type OutreachRow,
} from 'src/engine/core-modules/outreach-command/rows/outreach-rows.types';
import {
  normalizeDomain,
  normalizeLinkedinUrl,
} from 'src/engine/core-modules/outreach-command/rows/utils/outreach-rows-keys.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

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

const isNonEmptyString = (value: string): boolean => value.trim().length > 0;

// Flags (or removes) project-tab rows that already exist as CRM Company /
// Person records. The tab is the only result store now.
@Injectable()
export class OutreachTabDedupeService {
  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async findExistingCrmKeys({
    workspaceId,
    entity,
    rows,
  }: {
    workspaceId: string;
    entity: OutreachEntity;
    rows: OutreachRow[];
  }): Promise<Set<string>> {
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
