/* @license Enterprise */

import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';
import { computeRevealCreditCost, getRevealCost } from 'twenty-shared';

import { WorkspaceCredits } from 'src/engine/core-modules/billing/entities/workspace-credits.entity';
import { CreditTransactionService } from 'src/engine/core-modules/billing/services/credit-transaction.service';

const DEFAULT_FREE_ORG_CHART_CREDITS = 3;
const DEFAULT_FREE_REVEAL_CREDITS = 0;

export type AdminCreditPool = 'org_chart' | 'reveal';

@Injectable()
export class WorkspaceCreditsService {
  constructor(
    @InjectRepository(WorkspaceCredits, 'core')
    private readonly workspaceCreditsRepository: Repository<WorkspaceCredits>,
    private readonly creditTransactionService: CreditTransactionService,
  ) {}

  private readEnvCount(envKey: string, defaultValue: number): number {
    const val = process.env[envKey];
    if (val !== undefined) {
      const parsed = parseInt(val, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
    }
    return defaultValue;
  }

  private getFreeOrgChartCredits(): number {
    return this.readEnvCount(
      'FREE_SIGNUP_ORG_CHART_CREDITS',
      DEFAULT_FREE_ORG_CHART_CREDITS,
    );
  }

  private getFreeRevealCredits(): number {
    return this.readEnvCount(
      'FREE_SIGNUP_REVEAL_CREDITS',
      DEFAULT_FREE_REVEAL_CREDITS,
    );
  }

  async getOrCreate(workspaceId: string): Promise<WorkspaceCredits> {
    let row = await this.workspaceCreditsRepository.findOne({
      where: { workspaceId },
    });
    if (row) return row;

    row = this.workspaceCreditsRepository.create({
      workspaceId,
      orgChartCredits: this.getFreeOrgChartCredits(),
      revealCredits: this.getFreeRevealCredits(),
    });
    return this.workspaceCreditsRepository.save(row);
  }

  // ---------------------------------------------------------------------------
  // Org chart credits — flat 1 credit per org chart (no employee-count scaling).
  // ---------------------------------------------------------------------------

  computeOrgChartCreditsNeeded(_employeeCount?: number): number {
    return 1;
  }

  async hasSufficientOrgChartCredits(
    workspaceId: string,
    _employeeCount?: number,
  ): Promise<boolean> {
    const creditsNeeded = this.computeOrgChartCreditsNeeded();
    const row = await this.workspaceCreditsRepository.findOne({
      where: { workspaceId },
    });
    const available = row?.orgChartCredits ?? 0;
    return available >= creditsNeeded;
  }

  async getOrgChartCreditsAvailable(workspaceId: string): Promise<number> {
    const row = await this.workspaceCreditsRepository.findOne({
      where: { workspaceId },
    });

    return row?.orgChartCredits ?? 0;
  }

  async debitOrgChartCredits(
    workspaceId: string,
    employeeCount?: number,
    metadata?: {
      companyName?: string;
      companyId?: string;
      /** Who triggered the debit (maps to creditTransactions.metadata). */
      workspaceMemberId?: string;
      /** e.g. org-charts/{wm}/{company}/ under file storage. */
      orgChartS3RelativePath?: string;
    },
  ): Promise<void> {
    const creditsNeeded = this.computeOrgChartCreditsNeeded();
    const hasSufficient = await this.hasSufficientOrgChartCredits(workspaceId);
    if (!hasSufficient) {
      const creditsAvailable =
        await this.getOrgChartCreditsAvailable(workspaceId);

      throw new HttpException(
        {
          message: `Insufficient org chart credits. Need ${creditsNeeded} credit per org chart.`,
          creditsNeeded,
          creditsAvailable,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const row = await this.workspaceCreditsRepository.findOne({
      where: { workspaceId },
    });
    if (!row) {
      throw new HttpException(
        'Workspace credits not found',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.workspaceCreditsRepository.update(
      { workspaceId },
      { orgChartCredits: row.orgChartCredits - creditsNeeded },
    );

    await this.creditTransactionService.recordTransaction({
      workspaceId,
      type: 'debit',
      creditType: 'org_chart',
      amount: creditsNeeded,
      metadata:
        metadata !== undefined || employeeCount !== undefined
          ? { ...(metadata ?? {}), employeeCount }
          : undefined,
    });
  }

  async addOrgChartCredits(workspaceId: string, amount: number): Promise<void> {
    const row = await this.workspaceCreditsRepository.findOne({
      where: { workspaceId },
    });
    if (row) {
      await this.workspaceCreditsRepository.update(
        { workspaceId },
        { orgChartCredits: row.orgChartCredits + amount },
      );
    } else {
      await this.workspaceCreditsRepository.insert({
        workspaceId,
        orgChartCredits: amount,
        revealCredits: 0,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Reveal credits — unified pool. Cost per email/phone is runtime-configurable
  // via getRevealCost(kind) which reads CREDIT_COST_EMAIL_REVEAL /
  // CREDIT_COST_PHONE_REVEAL env vars.
  // ---------------------------------------------------------------------------

  async getRevealCreditsAvailable(workspaceId: string): Promise<number> {
    const row = await this.workspaceCreditsRepository.findOne({
      where: { workspaceId },
    });
    return row?.revealCredits ?? 0;
  }

  async hasSufficientRevealCredits(
    workspaceId: string,
    input: { emails?: number; phones?: number },
  ): Promise<boolean> {
    const required = computeRevealCreditCost(input);
    const available = await this.getRevealCreditsAvailable(workspaceId);
    return available >= required;
  }

  async debitRevealCredits(
    workspaceId: string,
    input: { emails?: number; phones?: number },
    metadata?: { linkedinUrl?: string; source?: string },
  ): Promise<void> {
    const emails = Math.max(0, input.emails ?? 0);
    const phones = Math.max(0, input.phones ?? 0);
    const required = computeRevealCreditCost({ emails, phones });

    if (required <= 0) {
      return;
    }

    const row = await this.workspaceCreditsRepository.findOne({
      where: { workspaceId },
    });
    if (!row) {
      throw new HttpException(
        'Workspace credits not found',
        HttpStatus.FORBIDDEN,
      );
    }

    const newReveal = row.revealCredits - required;
    if (newReveal < 0) {
      throw new HttpException(
        {
          message: 'Insufficient reveal credits',
          creditsNeeded: required,
          creditsAvailable: row.revealCredits,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    await this.workspaceCreditsRepository.update(
      { workspaceId },
      { revealCredits: newReveal },
    );

    const txMetadata = metadata ? { ...metadata } : {};
    if (emails > 0) {
      await this.creditTransactionService.recordTransaction({
        workspaceId,
        type: 'debit',
        creditType: 'email_reveal',
        amount: emails * getRevealCost('email'),
        metadata:
          Object.keys(txMetadata).length > 0
            ? { ...txMetadata, emails }
            : { emails },
      });
    }
    if (phones > 0) {
      await this.creditTransactionService.recordTransaction({
        workspaceId,
        type: 'debit',
        creditType: 'phone_reveal',
        amount: phones * getRevealCost('phone'),
        metadata:
          Object.keys(txMetadata).length > 0
            ? { ...txMetadata, phones }
            : { phones },
      });
    }
  }

  async addRevealCredits(workspaceId: string, amount: number): Promise<void> {
    const row = await this.workspaceCreditsRepository.findOne({
      where: { workspaceId },
    });
    if (row) {
      await this.workspaceCreditsRepository.update(
        { workspaceId },
        { revealCredits: row.revealCredits + amount },
      );
    } else {
      await this.workspaceCreditsRepository.insert({
        workspaceId,
        orgChartCredits: 0,
        revealCredits: amount,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Admin: bulk adjust either pool by an arbitrary delta (positive or negative).
  // ---------------------------------------------------------------------------

  async adjustCredits(
    workspaceId: string,
    creditType: AdminCreditPool,
    delta: number,
  ): Promise<void> {
    if (delta === 0) {
      return;
    }

    if (delta > 0) {
      if (creditType === 'org_chart') {
        await this.addOrgChartCredits(workspaceId, delta);
      } else {
        await this.addRevealCredits(workspaceId, delta);
      }
      return;
    }

    const row = await this.workspaceCreditsRepository.findOne({
      where: { workspaceId },
    });
    if (!row) {
      return;
    }

    const field = creditType === 'org_chart' ? 'orgChartCredits' : 'revealCredits';
    const current = row[field];
    const newValue = Math.max(0, current + delta);
    await this.workspaceCreditsRepository.update(
      { workspaceId },
      { [field]: newValue },
    );
  }
}
