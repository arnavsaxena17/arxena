import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { In, type ObjectLiteral } from 'typeorm';

import {
  decisionKindFromFormStepName,
  formatOutreachPersonName,
  outreachDecisionRecommendation,
  outreachDecisionSourceKey,
  type OutreachDecisionKind,
  type OutreachDecisionUrgency,
} from 'src/engine/core-modules/outreach-command/utils/outreach-decision-kind.util';
import { buildCreatedByFromSystem } from 'src/engine/core-modules/actor/utils/build-created-by-from-system.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

export type OutreachDecisionResolution = 'APPROVED' | 'EDITED' | 'REJECTED';

export type OutreachDecisionListItem = {
  id: string;
  kind: OutreachDecisionKind;
  urgency: OutreachDecisionUrgency;
  status: string;
  title: string;
  recommendation: string;
  reason: string;
  draftBody: string;
  stepId: string;
  projectId: string | null;
  candidateId: string | null;
  personId: string | null;
  companyId: string | null;
  workflowRunId: string | null;
  personName: string;
  personTitle: string;
  companyName: string;
  projectName: string;
  // Member who owns the candidate when sender pinning is in use.
  ownerMemberId: string | null;
  ownerName: string;
};

type DecisionRecord = ObjectLiteral & {
  id: string;
  title?: string | null;
  recommendation?: string | null;
  reason?: string | null;
  kind?: string | null;
  urgency?: string | null;
  status?: string | null;
  resolution?: string | null;
  sourceKey?: string | null;
  stepId?: string | null;
  draftBody?: string | null;
  editedBody?: string | null;
  projectId?: string | null;
  candidateId?: string | null;
  personId?: string | null;
  companyId?: string | null;
  workflowRunId?: string | null;
};

type CandidateLinkRecord = ObjectLiteral & {
  id: string;
  projectId?: string | null;
  peopleId?: string | null;
};

type PersonLinkRecord = ObjectLiteral & {
  id: string;
  name?: unknown;
  jobTitle?: string | null;
  companyId?: string | null;
};

type NamedRecord = ObjectLiteral & {
  id: string;
  name?: string | null;
};

const asText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

@Injectable()
export class OutreachDecisionService {
  private readonly logger = new Logger(OutreachDecisionService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async upsertFromPendingForm({
    workspaceId,
    workflowRunId,
    stepId,
    stepName,
    candidateId,
    draftBody,
  }: {
    workspaceId: string;
    workflowRunId: string;
    stepId: string;
    stepName: string;
    candidateId: string;
    draftBody: string;
  }): Promise<void> {
    if (
      !isNonEmptyString(workflowRunId) ||
      !isNonEmptyString(stepId) ||
      !isNonEmptyString(candidateId)
    ) {
      return;
    }

    const authContext = buildSystemAuthContext(workspaceId);
    const sourceKey = outreachDecisionSourceKey(workflowRunId, stepId);
    const { kind, urgency } = decisionKindFromFormStepName(stepName);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const candidateRepository =
        await this.globalWorkspaceOrmManager.getRepository<CandidateLinkRecord>(
          workspaceId,
          'candidate',
          { shouldBypassPermissionChecks: true },
        );
      const candidate = await candidateRepository.findOne({
        where: { id: candidateId },
      });

      if (!isDefined(candidate)) {
        this.logger.warn(
          `Skipping decision upsert; candidate ${candidateId} was not found`,
        );

        return;
      }

      const person = isNonEmptyString(candidate.peopleId)
        ? await this.findPerson(workspaceId, candidate.peopleId)
        : null;
      const personName = formatOutreachPersonName(person?.name);
      const title = personName ? `${stepName} · ${personName}` : stepName;
      const recommendation = outreachDecisionRecommendation(kind);
      const decisionRepository = await this.decisionRepository(workspaceId);
      const existing = await decisionRepository.findOne({
        where: { sourceKey },
      });
      const fields = {
        name: title,
        title,
        recommendation,
        reason: stepName,
        kind,
        urgency,
        status: 'OPEN',
        resolution: null,
        sourceKey,
        stepId,
        draftBody,
        editedBody: null,
        projectId: candidate.projectId ?? null,
        candidateId,
        personId: candidate.peopleId ?? null,
        companyId: person?.companyId ?? null,
        workflowRunId,
      };

      if (isDefined(existing)) {
        await decisionRepository.update(existing.id, fields);

        return;
      }

      const createdBy = buildCreatedByFromSystem();

      await decisionRepository.save({
        ...fields,
        createdBy,
        updatedBy: createdBy,
      });
    }, authContext);
  }

  async closeFromFormSubmission({
    workspaceId,
    workflowRunId,
    stepId,
    response,
  }: {
    workspaceId: string;
    workflowRunId: string;
    stepId: string;
    response: object;
  }): Promise<void> {
    const sourceKey = outreachDecisionSourceKey(workflowRunId, stepId);
    const authContext = buildSystemAuthContext(workspaceId);
    const responseRecord = response as Record<string, unknown>;
    const approveValue = responseRecord.approve;
    const isRejected = approveValue === false || approveValue === 'false';
    const submittedBody =
      typeof responseRecord.editedBody === 'string'
        ? responseRecord.editedBody.trim()
        : '';

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const decisionRepository = await this.decisionRepository(workspaceId);
      const existing = await decisionRepository.findOne({
        where: { sourceKey },
      });

      if (!isDefined(existing) || existing.status !== 'OPEN') {
        return;
      }

      const draftBody = asText(existing.draftBody);
      const resolution: OutreachDecisionResolution = isRejected
        ? 'REJECTED'
        : submittedBody.length > 0 && submittedBody !== draftBody
          ? 'EDITED'
          : 'APPROVED';

      await decisionRepository.update(existing.id, {
        status: 'DONE',
        resolution,
        editedBody: submittedBody || null,
      });
    }, authContext);
  }

  async listOpen({
    workspaceId,
    candidateId,
    ownerMemberId,
  }: {
    workspaceId: string;
    candidateId?: string;
    ownerMemberId?: string | null;
  }): Promise<OutreachDecisionListItem[]> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const decisionRepository = await this.decisionRepository(workspaceId);
        const decisions = await decisionRepository.find({
          where: {
            status: 'OPEN',
            ...(isNonEmptyString(candidateId) ? { candidateId } : {}),
          },
          order: { createdAt: 'ASC' },
          take: 500,
        });

        const items = await this.toListItems(workspaceId, decisions);

        // Unowned candidates stay visible to everyone so nothing is orphaned.
        return isNonEmptyString(ownerMemberId)
          ? items.filter(
              (item) =>
                item.ownerMemberId === null ||
                item.ownerMemberId === ownerMemberId,
            )
          : items;
      },
      authContext,
    );
  }

  async findOpenById({
    workspaceId,
    decisionId,
  }: {
    workspaceId: string;
    decisionId: string;
  }): Promise<DecisionRecord | null> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const decisionRepository = await this.decisionRepository(workspaceId);
        const decision = await decisionRepository.findOne({
          where: { id: decisionId },
        });

        if (!isDefined(decision) || decision.status !== 'OPEN') {
          return null;
        }

        return decision;
      },
      authContext,
    );
  }

  private async decisionRepository(workspaceId: string) {
    return this.globalWorkspaceOrmManager.getRepository<DecisionRecord>(
      workspaceId,
      'decision',
      { shouldBypassPermissionChecks: true },
    );
  }

  private async findPerson(
    workspaceId: string,
    personId: string,
  ): Promise<PersonLinkRecord | null> {
    const personRepository =
      await this.globalWorkspaceOrmManager.getRepository<PersonLinkRecord>(
        workspaceId,
        'person',
        { shouldBypassPermissionChecks: true },
      );

    return personRepository.findOne({ where: { id: personId } });
  }

  private async toListItems(
    workspaceId: string,
    decisions: DecisionRecord[],
  ): Promise<OutreachDecisionListItem[]> {
    const personIds = uniqueIds(decisions.map((decision) => decision.personId));
    const companyIds = uniqueIds(
      decisions.map((decision) => decision.companyId),
    );
    const projectIds = uniqueIds(
      decisions.map((decision) => decision.projectId),
    );
    const [people, companies, projects, ownerByCandidateId] =
      await Promise.all([
        this.findNamedRecords(workspaceId, 'person', personIds),
        this.findNamedRecords(workspaceId, 'company', companyIds),
        this.findNamedRecords(workspaceId, 'project', projectIds),
        this.findCandidateOwners(
          workspaceId,
          uniqueIds(decisions.map((decision) => decision.candidateId)),
        ),
      ]);
    const personById = new Map(people.map((person) => [person.id, person]));
    const companyById = new Map(
      companies.map((company) => [company.id, company]),
    );
    const projectById = new Map(
      projects.map((project) => [project.id, project]),
    );

    return decisions.map((decision) => {
      const person = isNonEmptyString(decision.personId)
        ? personById.get(decision.personId)
        : undefined;
      const company = isNonEmptyString(decision.companyId)
        ? companyById.get(decision.companyId)
        : undefined;
      const project = isNonEmptyString(decision.projectId)
        ? projectById.get(decision.projectId)
        : undefined;
      const kind = (decision.kind ?? 'MESSAGE_DRAFT') as OutreachDecisionKind;
      const urgency = (decision.urgency ??
        'APPROVE') as OutreachDecisionUrgency;

      return {
        id: decision.id,
        kind,
        urgency,
        status: decision.status ?? 'OPEN',
        title: asText(decision.title) || asText(decision.name),
        recommendation: asText(decision.recommendation),
        reason: asText(decision.reason),
        draftBody: asText(decision.draftBody),
        stepId: asText(decision.stepId),
        projectId: decision.projectId ?? null,
        candidateId: decision.candidateId ?? null,
        personId: decision.personId ?? null,
        companyId: decision.companyId ?? null,
        workflowRunId: decision.workflowRunId ?? null,
        personName: formatOutreachPersonName(person?.name),
        personTitle: asText(
          (person as { jobTitle?: unknown } | undefined)?.jobTitle,
        ),
        companyName: asText(company?.name),
        projectName: asText(project?.name),
        ownerMemberId:
          ownerByCandidateId.get(decision.candidateId ?? '')?.id ?? null,
        ownerName: ownerByCandidateId.get(decision.candidateId ?? '')?.name ?? '',
      };
    });
  }

  private async findCandidateOwners(
    workspaceId: string,
    candidateIds: string[],
  ): Promise<Map<string, { id: string; name: string }>> {
    const owners = new Map<string, { id: string; name: string }>();

    if (candidateIds.length === 0) {
      return owners;
    }

    const candidateRepository = await this.globalWorkspaceOrmManager.getRepository<{
      id: string;
      outreachWorkspaceMemberId?: string | null;
    }>(workspaceId, 'candidate', { shouldBypassPermissionChecks: true });
    const memberRepository = await this.globalWorkspaceOrmManager.getRepository<{
      id: string;
      name?: { firstName?: string | null; lastName?: string | null } | null;
      userEmail?: string | null;
    }>(workspaceId, 'workspaceMember', { shouldBypassPermissionChecks: true });
    const candidates = await candidateRepository.find({
      where: { id: In(candidateIds) },
    });
    const memberIds = uniqueIds(
      candidates.map((candidate) => candidate.outreachWorkspaceMemberId),
    );

    if (memberIds.length === 0) {
      return owners;
    }

    const members = await memberRepository.find({
      where: { id: In(memberIds) },
    });
    const memberById = new Map(members.map((member) => [member.id, member]));

    for (const candidate of candidates) {
      const member = memberById.get(candidate.outreachWorkspaceMemberId ?? '');

      if (isDefined(member)) {
        owners.set(candidate.id, {
          id: member.id,
          name:
            [member.name?.firstName, member.name?.lastName]
              .filter(isNonEmptyString)
              .join(' ') ||
            member.userEmail ||
            member.id,
        });
      }
    }

    return owners;
  }

  private async findNamedRecords(
    workspaceId: string,
    objectName: 'person' | 'company' | 'project',
    ids: string[],
  ): Promise<Array<NamedRecord & PersonLinkRecord>> {
    if (ids.length === 0) {
      return [];
    }

    const repository = await this.globalWorkspaceOrmManager.getRepository<
      NamedRecord & PersonLinkRecord
    >(workspaceId, objectName, { shouldBypassPermissionChecks: true });

    return repository.find({
      where: { id: In(ids) },
    });
  }
}

const uniqueIds = (ids: Array<string | null | undefined>): string[] => [
  ...new Set(ids.filter((id): id is string => isNonEmptyString(id))),
];
