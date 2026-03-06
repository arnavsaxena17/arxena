/* @license Enterprise */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { LessThan, Repository } from 'typeorm';

import { CreditTransaction } from 'src/engine/core-modules/billing/entities/credit-transaction.entity';

export type RecordTransactionInput = {
  workspaceId: string;
  type: 'debit' | 'credit';
  creditType: 'org_chart' | 'email_contact' | 'phone_contact';
  amount: number;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class CreditTransactionService {
  constructor(
    @InjectRepository(CreditTransaction, 'core')
    private readonly creditTransactionRepository: Repository<CreditTransaction>,
  ) {}

  async recordTransaction(input: RecordTransactionInput): Promise<void> {
    const entity = this.creditTransactionRepository.create({
      workspaceId: input.workspaceId,
      type: input.type,
      creditType: input.creditType,
      amount: input.amount,
      metadata: input.metadata ?? null,
    });
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
}
