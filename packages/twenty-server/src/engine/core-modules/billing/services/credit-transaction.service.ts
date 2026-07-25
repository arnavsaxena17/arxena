/* @license Enterprise */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Brackets, LessThan, Repository } from 'typeorm';

import { CreditTransaction } from 'src/engine/core-modules/billing/entities/credit-transaction.entity';

/**
 * Tag used in the `creditType` audit column. Active values for the two-pool
 * model are `'org_chart' | 'email_reveal' | 'phone_reveal' | 'reveal_top_up'`.
 * Historical rows tagged `'email_contact'` / `'phone_contact'` from the
 * pre-unification era remain valid for read paths.
 */
export type CreditTransactionTag =
  | 'org_chart'
  | 'email_reveal'
  | 'phone_reveal'
  | 'reveal_top_up'
  | 'email_contact'
  | 'phone_contact';

export type RecordTransactionInput = {
  workspaceId: string;
  type: 'debit' | 'credit';
  creditType: CreditTransactionTag;
  amount: number;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class CreditTransactionService {
  constructor(
    @InjectRepository(CreditTransaction)
    private readonly creditTransactionRepository: Repository<CreditTransaction>,
  ) {}

  async recordTransaction(input: RecordTransactionInput): Promise<void> {
    const entity = this.creditTransactionRepository.create({
      workspaceId: input.workspaceId,
      type: input.type,
      creditType: input.creditType,
      amount: input.amount,
      metadata: input.metadata ?? null,
    } as Partial<CreditTransaction>);

    await this.creditTransactionRepository.save(entity);
  }

  async findByWorkspace(
    workspaceId: string,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ items: CreditTransaction[]; nextCursor?: string }> {
    const limit = Math.min(options.limit ?? 50, 100);
    const qb = this.creditTransactionRepository
      .createQueryBuilder('t')
      .where('t.workspaceId = :workspaceId', { workspaceId })
      .orderBy('t.createdAt', 'DESC')
      .take(limit + 1);

    if (options.cursor) {
      qb.andWhere({ createdAt: LessThan(new Date(options.cursor)) });
    }

    const items = await qb.getMany();
    const hasMore = items.length > limit;
    const resultItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore
      ? resultItems[resultItems.length - 1].createdAt.toISOString()
      : undefined;

    return { items: resultItems, nextCursor };
  }

  /**
   * True if this workspace member has an org_chart debit (or access grant) tied to the same
   * S3 folder path as `orgChartS3RelativePath` (e.g. org-charts/acme_corp).
   * When `legacyCompanyIdMatch` is set, also matches older rows that only stored companyId in metadata.
   */
  async hasOrgChartS3AccessForMember(
    workspaceId: string,
    workspaceMemberId: string,
    orgChartS3RelativePath: string,
    legacyCompanyIdMatch?: string,
  ): Promise<boolean> {
    const qb = this.creditTransactionRepository
      .createQueryBuilder('t')
      .where('t.workspaceId = :workspaceId', { workspaceId })
      .andWhere('t.creditType = :ct', { ct: 'org_chart' })
      .andWhere('t.type = :type', { type: 'debit' })
      .andWhere(`t.metadata->>'workspaceMemberId' = :wmId`, {
        wmId: workspaceMemberId,
      })
      .andWhere(
        new Brackets((sub) => {
          sub.where(`t.metadata->>'orgChartS3RelativePath' = :path`, {
            path: orgChartS3RelativePath,
          });
          if (legacyCompanyIdMatch?.trim()) {
            const legacy = legacyCompanyIdMatch.trim().toLowerCase();

            sub.orWhere(
              new Brackets((inner) => {
                inner
                  .where(
                    `(COALESCE(t.metadata->>'orgChartS3RelativePath', '') = '')`,
                  )
                  .andWhere(
                    `LOWER(TRIM(COALESCE(t.metadata->>'companyId',''))) = :legacy`,
                    { legacy },
                  );
              }),
            );
          }
        }),
      );

    const found = await qb.getOne();

    return !!found;
  }

  /**
   * True if the workspace has any org_chart debit/access grant tied to the same
   * S3 folder path as `orgChartS3RelativePath` (or matching legacy companyId metadata).
   *
   * Use this for workspace-shared org chart access where all members in the
   * same workspace may read a chart created by one member.
   */
  async hasOrgChartS3AccessForWorkspace(
    workspaceId: string,
    orgChartS3RelativePath: string,
    legacyCompanyIdMatch?: string,
  ): Promise<boolean> {
    const qb = this.creditTransactionRepository
      .createQueryBuilder('t')
      .where('t.workspaceId = :workspaceId', { workspaceId })
      .andWhere('t.creditType = :ct', { ct: 'org_chart' })
      .andWhere('t.type = :type', { type: 'debit' })
      .andWhere(
        new Brackets((sub) => {
          sub.where(`t.metadata->>'orgChartS3RelativePath' = :path`, {
            path: orgChartS3RelativePath,
          });
          if (legacyCompanyIdMatch?.trim()) {
            const legacy = legacyCompanyIdMatch.trim().toLowerCase();

            sub.orWhere(
              new Brackets((inner) => {
                inner
                  .where(
                    `(COALESCE(t.metadata->>'orgChartS3RelativePath', '') = '')`,
                  )
                  .andWhere(
                    `LOWER(TRIM(COALESCE(t.metadata->>'companyId',''))) = :legacy`,
                    { legacy },
                  );
              }),
            );
          }
        }),
      );

    const found = await qb.getOne();

    return !!found;
  }

  /**
   * True when the workspace has org-chart access for any of the given S3 paths / legacy IDs.
   * Used for company alias groups (e.g. stay-vista ↔ vista-rooms).
   */
  async hasOrgChartS3AccessForWorkspaceAmong(
    workspaceId: string,
    candidates: Array<{
      orgChartS3RelativePath: string;
      legacyCompanyId?: string;
    }>,
  ): Promise<boolean> {
    for (const candidate of candidates) {
      const hasAccess = await this.hasOrgChartS3AccessForWorkspace(
        workspaceId,
        candidate.orgChartS3RelativePath,
        candidate.legacyCompanyId,
      );
      if (hasAccess) {
        return true;
      }
    }
    return false;
  }

  /**
   * Records org chart S3 access when billing is off (no credit debit). Same row shape as debit
   * metadata so hasOrgChartS3AccessForMember can authorize loads from shared S3 paths.
   */
  async recordOrgChartAccessGrant(input: {
    workspaceId: string;
    workspaceMemberId: string;
    orgChartS3RelativePath: string;
    companyName?: string;
    companyId?: string;
    employeeCount: number;
  }): Promise<void> {
    await this.recordTransaction({
      workspaceId: input.workspaceId,
      type: 'debit',
      creditType: 'org_chart',
      amount: 0,
      metadata: {
        workspaceMemberId: input.workspaceMemberId,
        orgChartS3RelativePath: input.orgChartS3RelativePath,
        companyName: input.companyName,
        companyId: input.companyId,
        employeeCount: input.employeeCount,
        accessGrantWithoutBilling: true,
      },
    });
  }
}
