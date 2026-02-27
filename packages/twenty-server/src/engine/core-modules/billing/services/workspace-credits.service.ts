/* @license Enterprise */

import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { WorkspaceCredits } from 'src/engine/core-modules/billing/entities/workspace-credits.entity';

const DEFAULT_FREE_ORG_CHART_CREDITS = 1;
const DEFAULT_FREE_EMAIL_CREDITS = 0;
const DEFAULT_FREE_PHONE_CREDITS = 0;

@Injectable()
export class WorkspaceCreditsService {
  constructor(
    @InjectRepository(WorkspaceCredits, 'core')
    private readonly workspaceCreditsRepository: Repository<WorkspaceCredits>,
  ) {}

  private getFreeOrgChartCredits(): number {
    const val = process.env.FREE_SIGNUP_ORG_CHART_CREDITS;
    if (val !== undefined) {
      const parsed = parseInt(val, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
    }
    return DEFAULT_FREE_ORG_CHART_CREDITS;
  }

  private getFreeEmailCredits(): number {
    const val = process.env.FREE_SIGNUP_EMAIL_CREDITS;
    if (val !== undefined) {
      const parsed = parseInt(val, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
    }
    return DEFAULT_FREE_EMAIL_CREDITS;
  }

  private getFreePhoneCredits(): number {
    const val = process.env.FREE_SIGNUP_PHONE_CREDITS;
    if (val !== undefined) {
      const parsed = parseInt(val, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
    }
    return DEFAULT_FREE_PHONE_CREDITS;
  }

  async getOrCreate(workspaceId: string): Promise<WorkspaceCredits> {
    let row = await this.workspaceCreditsRepository.findOne({
      where: { workspaceId },
    });
    if (row) return row;

    row = this.workspaceCreditsRepository.create({
      workspaceId,
      orgChartCredits: this.getFreeOrgChartCredits(),
      emailContactCredits: this.getFreeEmailCredits(),
      phoneContactCredits: this.getFreePhoneCredits(),
    });
    return this.workspaceCreditsRepository.save(row);
  }

  computeOrgChartCreditsNeeded(employeeCount: number): number {
    return Math.max(1, Math.ceil(employeeCount / 100));
  }

  async hasSufficientOrgChartCredits(
    workspaceId: string,
    employeeCount: number,
  ): Promise<boolean> {
    const creditsNeeded = this.computeOrgChartCreditsNeeded(employeeCount);
    const row = await this.workspaceCreditsRepository.findOne({
      where: { workspaceId },
    });
    const available = row?.orgChartCredits ?? 0;
    return available >= creditsNeeded;
  }

  async debitOrgChartCredits(
    workspaceId: string,
    employeeCount: number,
  ): Promise<void> {
    const creditsNeeded = this.computeOrgChartCreditsNeeded(employeeCount);
    const hasSufficient = await this.hasSufficientOrgChartCredits(
      workspaceId,
      employeeCount,
    );
    if (!hasSufficient) {
      throw new HttpException(
        `Insufficient org chart credits. Need ${creditsNeeded} credits for ${employeeCount} employees.`,
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
  }

  async hasSufficientContactCredits(
    workspaceId: string,
    wantEmail: boolean,
    wantPhone: boolean,
  ): Promise<boolean> {
    return this.hasSufficientContactCreditsForCount(
      workspaceId,
      wantEmail ? 1 : 0,
      wantPhone ? 1 : 0,
    );
  }

  async hasSufficientContactCreditsForCount(
    workspaceId: string,
    emailCount: number,
    phoneCount: number,
  ): Promise<boolean> {
    const row = await this.workspaceCreditsRepository.findOne({
      where: { workspaceId },
    });
    const emailCredits = row?.emailContactCredits ?? 0;
    const phoneCredits = row?.phoneContactCredits ?? 0;
    return emailCredits >= emailCount && phoneCredits >= phoneCount;
  }

  async debitContactCredits(
    workspaceId: string,
    emailCount: number,
    phoneCount: number,
  ): Promise<void> {
    const row = await this.workspaceCreditsRepository.findOne({
      where: { workspaceId },
    });
    if (!row) {
      throw new HttpException(
        'Workspace credits not found',
        HttpStatus.FORBIDDEN,
      );
    }

    const newEmail = row.emailContactCredits - emailCount;
    const newPhone = row.phoneContactCredits - phoneCount;

    if (newEmail < 0 || newPhone < 0) {
      throw new HttpException(
        'Insufficient contact credits',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.workspaceCreditsRepository.update(
      { workspaceId },
      {
        emailContactCredits: newEmail,
        phoneContactCredits: newPhone,
      },
    );
  }

  async addOrgChartCredits(
    workspaceId: string,
    amount: number,
  ): Promise<void> {
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
        emailContactCredits: 0,
        phoneContactCredits: 0,
      });
    }
  }
}
