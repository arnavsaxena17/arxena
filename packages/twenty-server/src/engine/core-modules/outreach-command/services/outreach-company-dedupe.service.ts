import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { In } from 'typeorm';

import {
  decideCompanyDedupe,
  normalizeCompanyKey,
  type CompanyDedupeReason,
  type CompanyDedupeSibling,
} from 'src/engine/core-modules/outreach-command/utils/company-dedupe-decision.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';

// One project can hold thousands of candidates; the gate only needs siblings
// that could still compete for the same company. Past the cap the run is
// admitted and the truncation is reported instead of silently deferring.
export const OUTREACH_COMPANY_DEDUPE_MAX_SIBLINGS = 500;

type CandidateDedupeRecord = {
  id: string;
  projectId?: string | null;
  peopleId?: string | null;
  outreachSequenceStage?: string | null;
  createdAt?: string | null;
};

type PersonCompanyRecord = {
  id: string;
  jobCompanyName?: string | null;
};

export type OutreachCompanyDedupeInput = {
  candidateId?: string;
  companyName?: string;
};

export type OutreachCompanyDedupeResult = {
  deferred: boolean;
  reason: CompanyDedupeReason | 'no-candidate';
  matchedCandidateId: string;
  companyKey: string;
  consideredSiblings: number;
  truncated: boolean;
};

/**
 * Gate for the QUEUED branch of the candidate sequencer.
 *
 * One node replaces the old seven-step FIND/IF/UPDATE chain plus the parallel
 * "no company" connection thread it forced: it answers "has this company
 * already been worked, or is an earlier QUEUED sibling holding it?" and stamps
 * DEFERRED itself, so the graph keeps a single connection path.
 *
 * The old FIND filtered `candidate` by the person's jobCompanyName field
 * metadata id, which the candidate object does not have, so its company clause
 * never applied. This joins candidate -> person and compares a normalized
 * company key instead.
 */
@Injectable()
export class OutreachCompanyDedupeService {
  private readonly logger = new Logger(OutreachCompanyDedupeService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: OutreachCompanyDedupeInput;
  }): Promise<OutreachCompanyDedupeResult> {
    const candidateId = input.candidateId?.trim() ?? '';

    const admit = (
      reason: OutreachCompanyDedupeResult['reason'],
    ): OutreachCompanyDedupeResult => ({
      deferred: false,
      reason,
      matchedCandidateId: '',
      companyKey: '',
      consideredSiblings: 0,
      truncated: false,
    });

    if (!isNonEmptyString(candidateId)) {
      return admit('no-candidate');
    }

    const candidateRepository =
      await this.globalWorkspaceOrmManager.getRepository<CandidateDedupeRecord>(
        workspaceId,
        'candidate',
        { shouldBypassPermissionChecks: true },
      );

    const candidate = await candidateRepository.findOne({
      where: { id: candidateId },
      select: ['id', 'projectId', 'peopleId', 'createdAt'],
    });

    if (!isDefined(candidate)) {
      return admit('no-candidate');
    }

    const projectId = candidate.projectId?.trim() ?? '';
    const peopleId = candidate.peopleId?.trim() ?? '';
    const personRepository =
      await this.globalWorkspaceOrmManager.getRepository<PersonCompanyRecord>(
        workspaceId,
        'person',
        { shouldBypassPermissionChecks: true },
      );

    // The graph already loaded the person; only read it when the chip was empty
    // or the caller ran the node on its own.
    let companyName = input.companyName?.trim() ?? '';

    if (!isNonEmptyString(companyName) && isNonEmptyString(peopleId)) {
      const person = await personRepository.findOne({
        where: { id: peopleId },
        select: ['id', 'jobCompanyName'],
      });

      companyName = person?.jobCompanyName?.trim() ?? '';
    }

    const companyKey = normalizeCompanyKey(companyName);

    if (!isNonEmptyString(companyKey) || !isNonEmptyString(projectId)) {
      return { ...admit('no-company'), companyKey };
    }

    const siblingRecords = await candidateRepository.find({
      where: { projectId },
      select: ['id', 'peopleId', 'outreachSequenceStage', 'createdAt'],
      take: OUTREACH_COMPANY_DEDUPE_MAX_SIBLINGS + 1,
      order: { createdAt: 'ASC' },
    });

    const truncated = siblingRecords.length > OUTREACH_COMPANY_DEDUPE_MAX_SIBLINGS;
    const consideredRecords = truncated
      ? siblingRecords.slice(0, OUTREACH_COMPANY_DEDUPE_MAX_SIBLINGS)
      : siblingRecords;

    const siblingPeopleIds = [
      ...new Set(
        consideredRecords
          .map((record) => record.peopleId?.trim() ?? '')
          .filter(
            (id): id is string => isNonEmptyString(id) && id !== peopleId,
          ),
      ),
    ];

    const companyNameByPersonId = new Map<string, string>();

    if (siblingPeopleIds.length > 0) {
      const siblingPeople = await personRepository.find({
        where: { id: In(siblingPeopleIds) },
        select: ['id', 'jobCompanyName'],
      });

      for (const person of siblingPeople) {
        companyNameByPersonId.set(person.id, person.jobCompanyName ?? '');
      }
    }

    const siblings: CompanyDedupeSibling[] = consideredRecords.map((record) => ({
      candidateId: record.id,
      companyName:
        record.peopleId === peopleId
          ? companyName
          : companyNameByPersonId.get(record.peopleId ?? '') ?? '',
      stage: record.outreachSequenceStage ?? null,
      createdAt: record.createdAt ?? null,
    }));

    const decision = decideCompanyDedupe({
      selfCandidateId: candidateId,
      companyName,
      selfCreatedAt: candidate.createdAt ?? null,
      siblings,
    });

    const result: OutreachCompanyDedupeResult = {
      deferred: decision.deferred,
      reason: decision.reason,
      matchedCandidateId: decision.matchedCandidateId,
      companyKey: decision.companyKey,
      consideredSiblings: decision.consideredSiblings,
      truncated,
    };

    if (!decision.deferred) {
      return result;
    }

    // Stamped here rather than in an UPDATE_RECORD step: the run has to stop on
    // the gate's false branch, and a stage write would otherwise need a second
    // terminal node per reason.
    await candidateRepository.update(candidateId, {
      outreachSequenceStage: 'DEFERRED',
    });

    this.logger.log(
      `Deferred candidate ${candidateId} on company "${companyKey}" (${decision.reason}, matched ${decision.matchedCandidateId})`,
    );

    return result;
  }
}
