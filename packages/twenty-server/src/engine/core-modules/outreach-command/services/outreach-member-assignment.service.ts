import { Injectable, Logger, Optional } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { In, IsNull } from 'typeorm';

import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { OutreachWarmOverlapService } from 'src/engine/core-modules/outreach-command/services/outreach-warm-overlap.service';
import { OUTREACH_SEQUENCER_STEP_IDS } from 'src/engine/workspace-manager/standard-objects-prefill-data/data/outreach-workflow-graphs';
import { type WarmMemberScore } from 'src/engine/core-modules/outreach-command/utils/outreach-warm-overlap.util';
import {
  buildOutreachSplitPlan,
  hasPinnedMember,
  isPreSendOutreachStage,
  pickLeastLoadedMember,
  pickRoundRobinMember,
  readOutreachMemberAssignmentConfig,
  resolveEligibleMemberIds,
  type OutreachAssignmentReason,
  type OutreachMemberAssignmentConfig,
  type OutreachSplitMode,
} from 'src/engine/core-modules/outreach-command/utils/outreach-member-assignment.util';
import { FeatureFlagKey } from 'twenty-shared/types';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

const TERMINAL_STAGES = ['FAILED_NO_REPLY', 'FAILED_ENRICH'];

type CandidateRecord = {
  id: string;
  projectId?: string | null;
  outreachSequenceStage?: string | null;
  outreachWorkspaceMemberId?: string | null;
  outreachAssignedAt?: string | null;
  outreachAssignmentReason?: string | null;
  outreachAssignedById?: string | null;
  outreachSuggestedMemberId?: string | null;
  outreachSuggestionReasons?: Record<string, unknown> | null;
  peopleId?: string | null;
};

type ProjectRecord = {
  id: string;
  recruiterId?: string | null;
  outreachWorkflowId?: string | null;
  outreachConfig?: Record<string, unknown> | null;
};

type WorkspaceMemberRecord = {
  id: string;
  name?: { firstName?: string | null; lastName?: string | null } | null;
  userEmail?: string | null;
  linkedinUnipileAccountId?: string | null;
};

export type OutreachSelectMemberResult = {
  success: boolean;
  workspaceMemberId: string;
  reason: string;
  alreadyPinned: boolean;
  error?: string;
};

export type OutreachMemberLoadRow = {
  memberId: string;
  name: string;
  userEmail: string;
  hasLinkedinSeat: boolean;
  eligible: boolean;
  activeCandidates: number;
  weight: number;
};

export type OutreachAssignResult = {
  assigned: number;
  skipped: Array<{ candidateId: string; reason: string }>;
};

@Injectable()
export class OutreachMemberAssignmentService {
  private readonly logger = new Logger(OutreachMemberAssignmentService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly featureFlagService: FeatureFlagService,
    @Optional()
    private readonly outreachWarmOverlapService?: OutreachWarmOverlapService,
  ) {}

  // Called by the sequencer step. Never re-scores a pinned candidate.
  async selectForCandidate({
    workspaceId,
    candidateId,
  }: {
    workspaceId: string;
    candidateId: string;
  }): Promise<OutreachSelectMemberResult> {
    if (!isNonEmptyString(candidateId)) {
      return {
        success: false,
        workspaceMemberId: '',
        reason: 'missing_candidate',
        alreadyPinned: false,
        error: 'candidateId is required',
      };
    }

    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const candidateRepository = await this.getCandidateRepository(
          workspaceId,
        );
        const candidate = await candidateRepository.findOne({
          where: { id: candidateId },
        });

        if (!isDefined(candidate)) {
          return {
            success: false,
            workspaceMemberId: '',
            reason: 'candidate_not_found',
            alreadyPinned: false,
            error: `Candidate ${candidateId} not found`,
          };
        }

        if (hasPinnedMember(candidate)) {
          return {
            success: true,
            workspaceMemberId: candidate.outreachWorkspaceMemberId as string,
            reason: candidate.outreachAssignmentReason ?? 'manual',
            alreadyPinned: true,
          };
        }

        const project = await this.loadProject(
          workspaceId,
          candidate.projectId,
        );
        const config = readOutreachMemberAssignmentConfig(
          project?.outreachConfig,
        );
        const members = await this.loadMembers(workspaceId);
        const eligibleMemberIds = await this.resolveEligibleMembers({
          workspaceId,
          members,
          config,
        });
        const decision = await this.decide({
          workspaceId,
          candidate,
          project,
          config,
          members,
          eligibleMemberIds,
        });

        if (decision.kind === 'suggestion') {
          // Suggest mode stores the winner but does not pin; send falls back
          // to the policy-free default until someone confirms.
          await candidateRepository.update(candidate.id, {
            outreachSuggestedMemberId: decision.memberId,
            outreachSuggestionReasons: { scores: decision.scores },
          });
        }

        const memberId =
          decision.kind === 'suggestion'
            ? decision.fallbackMemberId
            : decision.memberId;
        const reason: OutreachAssignmentReason =
          decision.kind === 'suggestion' ? 'fallback' : decision.reason;

        const pinWon = await this.pinIfEmpty({
          workspaceId,
          candidateId: candidate.id,
          memberId,
          reason,
          assignedById: null,
        });

        if (!pinWon) {
          const winner = await candidateRepository.findOne({
            where: { id: candidate.id },
          });

          return {
            success: true,
            workspaceMemberId:
              winner?.outreachWorkspaceMemberId ?? memberId,
            reason: winner?.outreachAssignmentReason ?? reason,
            alreadyPinned: true,
          };
        }

        return {
          success: true,
          workspaceMemberId: memberId,
          reason,
          alreadyPinned: false,
        };
      },
      authContext,
    );
  }

  async assign({
    workspaceId,
    candidateIds,
    memberId,
    assignedById,
    force = false,
    reason = 'bulk',
  }: {
    workspaceId: string;
    candidateIds: string[];
    memberId: string;
    assignedById?: string | null;
    force?: boolean;
    reason?: OutreachAssignmentReason;
  }): Promise<OutreachAssignResult> {
    return this.writeAssignments({
      workspaceId,
      assignments: [...new Set(candidateIds)].map((candidateId) => ({
        candidateId,
        memberId,
      })),
      assignedById,
      force,
      reason,
    });
  }

  async split({
    workspaceId,
    projectId,
    candidateIds,
    memberIds,
    mode,
    assignedById,
    force = false,
  }: {
    workspaceId: string;
    projectId?: string | null;
    candidateIds: string[];
    memberIds?: string[];
    mode: OutreachSplitMode;
    assignedById?: string | null;
    force?: boolean;
  }): Promise<OutreachAssignResult & { plan: Array<{ candidateId: string; memberId: string }> }> {
    const authContext = buildSystemAuthContext(workspaceId);

    const planInputs = await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const project = await this.loadProject(workspaceId, projectId);
        const config = readOutreachMemberAssignmentConfig(
          project?.outreachConfig,
        );
        const members = await this.loadMembers(workspaceId);
        const requested = (memberIds ?? []).filter(isNonEmptyString);
        const eligible =
          requested.length > 0
            ? requested
            : await this.resolveEligibleMembers({
                workspaceId,
                members,
                config,
              });
        const loadByMemberId = await this.loadActiveCandidateCounts({
          workspaceId,
          projectId,
        });

        return { eligible, weights: config.weights, loadByMemberId };
      },
      authContext,
    );

    const plan = buildOutreachSplitPlan({
      candidateIds,
      memberIds: planInputs.eligible,
      mode,
      weights: planInputs.weights,
      loadByMemberId: planInputs.loadByMemberId,
    });
    const result = await this.writeAssignments({
      workspaceId,
      assignments: plan,
      assignedById,
      force,
      reason: mode === 'round_robin' ? 'round_robin' : 'least_loaded',
    });

    return { ...result, plan };
  }

  async reassign({
    workspaceId,
    candidateId,
    memberId,
    assignedById,
    force,
  }: {
    workspaceId: string;
    candidateId: string;
    memberId: string;
    assignedById?: string | null;
    force?: boolean;
  }): Promise<OutreachAssignResult> {
    return this.assign({
      workspaceId,
      candidateIds: [candidateId],
      memberId,
      assignedById,
      force,
      reason: 'manual',
    });
  }

  async confirmSuggestions({
    workspaceId,
    candidateIds,
    assignedById,
  }: {
    workspaceId: string;
    candidateIds: string[];
    assignedById?: string | null;
  }): Promise<OutreachAssignResult> {
    const authContext = buildSystemAuthContext(workspaceId);
    const assignments = await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const candidateRepository = await this.getCandidateRepository(
          workspaceId,
        );
        const candidates = await candidateRepository.find({
          where: { id: In(candidateIds) },
        });

        return candidates
          .filter((candidate) =>
            isNonEmptyString(
              candidate.outreachSuggestedMemberId,
            ),
          )
          .map((candidate) => ({
            candidateId: candidate.id,
            memberId: candidate.outreachSuggestedMemberId as string,
          }));
      },
      authContext,
    );

    return this.writeAssignments({
      workspaceId,
      assignments,
      assignedById,
      force: true,
      reason: 'warm',
    });
  }

  async getMemberLoad({
    workspaceId,
    projectId,
  }: {
    workspaceId: string;
    projectId?: string | null;
  }): Promise<{
    members: OutreachMemberLoadRow[];
    policy: OutreachMemberAssignmentConfig['policy'];
    config: OutreachMemberAssignmentConfig;
    pinActive: boolean;
    pinInDraft: boolean;
  }> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const project = await this.loadProject(workspaceId, projectId);
        const config = readOutreachMemberAssignmentConfig(
          project?.outreachConfig,
        );
        const members = await this.loadMembers(workspaceId);
        const eligible = new Set(
          await this.resolveEligibleMembers({ workspaceId, members, config }),
        );
        const loadByMemberId = await this.loadActiveCandidateCounts({
          workspaceId,
          projectId,
        });

        const pinState = await this.readPinState({ workspaceId, projectId });

        return {
          policy: config.policy,
          config,
          ...pinState,
          members: members.map((member) => ({
            memberId: member.id,
            name: formatMemberName(member),
            userEmail: member.userEmail ?? '',
            hasLinkedinSeat: isNonEmptyString(
              member.linkedinUnipileAccountId?.trim(),
            ),
            eligible: eligible.has(member.id),
            activeCandidates: loadByMemberId[member.id] ?? 0,
            weight: config.weights[member.id] ?? 1,
          })),
        };
      },
      authContext,
    );
  }

  // The pin only takes effect when the sequencer version that runs contains the
  // select step; a draft that has it still needs activating.
  async readPinState({
    workspaceId,
    projectId,
  }: {
    workspaceId: string;
    projectId?: string | null;
  }): Promise<{ pinActive: boolean; pinInDraft: boolean }> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const project = await this.loadProject(workspaceId, projectId);
        const workflowId = project?.outreachWorkflowId?.trim();

        if (!isNonEmptyString(workflowId)) {
          return { pinActive: false, pinInDraft: false };
        }

        const versionRepository =
          await this.globalWorkspaceOrmManager.getRepository<{
            id: string;
            status: string;
            steps?: Array<{ id?: string }> | null;
          }>(workspaceId, 'workflowVersion', {
            shouldBypassPermissionChecks: true,
          });
        const versions = await versionRepository.find({
          where: { workflowId },
          order: { createdAt: 'DESC' } as never,
          take: 10,
        } as never);
        const hasSelectStep = (version: { steps?: Array<{ id?: string }> | null }) =>
          (version.steps ?? []).some(
            (step) => step.id === OUTREACH_SEQUENCER_STEP_IDS.selectMember,
          );

        return {
          pinActive: versions.some(
            (version) => version.status === 'ACTIVE' && hasSelectStep(version),
          ),
          pinInDraft: versions.some(
            (version) => version.status === 'DRAFT' && hasSelectStep(version),
          ),
        };
      },
      authContext,
    );
  }

  // Tolerant on purpose: workspaces that have not run the pin-fields upgrade
  // return no owners instead of failing the people list.
  async listOwners({
    workspaceId,
    projectId,
  }: {
    workspaceId: string;
    projectId: string;
  }): Promise<
    Record<
      string,
      { memberId: string; reason: string; suggestedMemberId: string | null }
    >
  > {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        try {
          const candidateRepository = await this.getCandidateRepository(
            workspaceId,
          );
          const candidates = await candidateRepository.find({
            where: { projectId },
          });
          const owners: Record<
            string,
            { memberId: string; reason: string; suggestedMemberId: string | null }
          > = {};

          for (const candidate of candidates) {
            const memberId = candidate.outreachWorkspaceMemberId?.trim() ?? '';
            const suggested = candidate.outreachSuggestedMemberId?.trim() ?? '';

            if (memberId || suggested) {
              owners[candidate.id] = {
                memberId,
                reason: candidate.outreachAssignmentReason ?? '',
                suggestedMemberId: suggested || null,
              };
            }
          }

          return owners;
        } catch (error) {
          this.logger.warn(
            `listOwners skipped: ${error instanceof Error ? error.message : String(error)}`,
          );

          return {};
        }
      },
      authContext,
    );
  }

  async saveProjectAssignmentConfig({
    workspaceId,
    projectId,
    patch,
  }: {
    workspaceId: string;
    projectId: string;
    patch: Partial<OutreachMemberAssignmentConfig>;
  }): Promise<OutreachMemberAssignmentConfig> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const projectRepository =
          await this.globalWorkspaceOrmManager.getRepository<ProjectRecord>(
            workspaceId,
            'project',
            { shouldBypassPermissionChecks: true },
          );
        const project = await projectRepository.findOne({
          where: { id: projectId },
        });

        if (!isDefined(project)) {
          throw new Error(`Project ${projectId} not found`);
        }

        const current = readOutreachMemberAssignmentConfig(
          project.outreachConfig,
        );
        const next: OutreachMemberAssignmentConfig = {
          ...current,
          ...Object.fromEntries(
            Object.entries(patch).filter(([, value]) => value !== undefined),
          ),
        };
        const existing =
          typeof project.outreachConfig === 'object' &&
          project.outreachConfig !== null
            ? (project.outreachConfig as Record<string, unknown>)
            : {};

        await projectRepository.update(project.id, {
          outreachConfig: { ...existing, memberAssignment: next },
        });

        return next;
      },
      authContext,
    );
  }

  private async decide({
    workspaceId,
    candidate,
    project,
    config,
    members,
    eligibleMemberIds,
  }: {
    workspaceId: string;
    candidate: CandidateRecord;
    project: ProjectRecord | null;
    config: OutreachMemberAssignmentConfig;
    members: WorkspaceMemberRecord[];
    eligibleMemberIds: string[];
  }): Promise<
    | { kind: 'pin'; memberId: string; reason: OutreachAssignmentReason }
    | {
        kind: 'suggestion';
        memberId: string;
        fallbackMemberId: string;
        scores: WarmMemberScore[];
      }
  > {
    const fallbackMemberId = this.pickFallback({
      project,
      members,
      eligibleMemberIds,
    });
    const loadByMemberId = await this.loadActiveCandidateCounts({
      workspaceId,
      projectId: candidate.projectId,
    });

    if (eligibleMemberIds.length === 0 || config.policy === 'manual_only') {
      return { kind: 'pin', memberId: fallbackMemberId, reason: 'fallback' };
    }

    if (config.policy === 'round_robin') {
      const assignedTotal = Object.values(loadByMemberId).reduce(
        (sum, count) => sum + count,
        0,
      );
      const memberId = pickRoundRobinMember({
        memberIds: eligibleMemberIds,
        assignedTotal,
      });

      return memberId
        ? { kind: 'pin', memberId, reason: 'round_robin' }
        : { kind: 'pin', memberId: fallbackMemberId, reason: 'fallback' };
    }

    if (
      config.policy === 'warm_suggest' &&
      isDefined(this.outreachWarmOverlapService) &&
      eligibleMemberIds.length > 1
    ) {
      const warm = await this.outreachWarmOverlapService.scoreCandidate({
        workspaceId,
        candidateId: candidate.id,
        memberIds: eligibleMemberIds,
        tieBreakLoad: loadByMemberId,
        recruiterId: project?.recruiterId ?? null,
      });

      if (isDefined(warm) && warm.winnerMemberId) {
        return config.warmMode === 'auto'
          ? { kind: 'pin', memberId: warm.winnerMemberId, reason: 'warm' }
          : {
              kind: 'suggestion',
              memberId: warm.winnerMemberId,
              fallbackMemberId:
                pickLeastLoadedMember({
                  memberIds: eligibleMemberIds,
                  loadByMemberId,
                  weights: config.weights,
                }) ?? fallbackMemberId,
              scores: warm.scores,
            };
      }
    }

    const memberId = pickLeastLoadedMember({
      memberIds: eligibleMemberIds,
      loadByMemberId,
      weights: config.weights,
    });

    return memberId
      ? { kind: 'pin', memberId, reason: 'least_loaded' }
      : { kind: 'pin', memberId: fallbackMemberId, reason: 'fallback' };
  }

  // project.recruiterId, then the lowest member id: today's behaviour.
  private pickFallback({
    project,
    members,
    eligibleMemberIds,
  }: {
    project: ProjectRecord | null;
    members: WorkspaceMemberRecord[];
    eligibleMemberIds: string[];
  }): string {
    const recruiterId = project?.recruiterId?.trim();

    if (
      isNonEmptyString(recruiterId) &&
      members.some((member) => member.id === recruiterId)
    ) {
      return recruiterId;
    }

    const sortedEligible = [...eligibleMemberIds].sort();

    if (sortedEligible.length > 0) {
      return sortedEligible[0];
    }

    return [...members.map((member) => member.id)].sort()[0] ?? '';
  }

  private async writeAssignments({
    workspaceId,
    assignments,
    assignedById,
    force,
    reason,
  }: {
    workspaceId: string;
    assignments: Array<{ candidateId: string; memberId: string }>;
    assignedById?: string | null;
    force: boolean;
    reason: OutreachAssignmentReason;
  }): Promise<OutreachAssignResult> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const candidateRepository = await this.getCandidateRepository(
          workspaceId,
        );
        const candidates = await candidateRepository.find({
          where: { id: In(assignments.map((entry) => entry.candidateId)) },
        });
        const candidateById = new Map(
          candidates.map((candidate) => [candidate.id, candidate]),
        );
        const memberIds = new Set(
          (await this.loadMembers(workspaceId)).map((member) => member.id),
        );
        const skipped: OutreachAssignResult['skipped'] = [];
        let assigned = 0;

        for (const { candidateId, memberId } of assignments) {
          const candidate = candidateById.get(candidateId);

          if (!isDefined(candidate)) {
            skipped.push({ candidateId, reason: 'candidate_not_found' });
            continue;
          }

          if (!memberIds.has(memberId)) {
            skipped.push({ candidateId, reason: 'member_not_found' });
            continue;
          }

          if (candidate.outreachWorkspaceMemberId === memberId) {
            continue;
          }

          // The LinkedIn thread stays on the account that sent the invite, so
          // moving a started candidate needs an explicit force.
          if (
            hasPinnedMember(candidate) &&
            !isPreSendOutreachStage(candidate.outreachSequenceStage) &&
            !force
          ) {
            skipped.push({
              candidateId,
              reason: 'already_started_use_force',
            });
            continue;
          }

          await candidateRepository.update(candidateId, {
            outreachWorkspaceMemberId: memberId,
            outreachAssignedAt: new Date().toISOString(),
            outreachAssignmentReason: reason,
            outreachAssignedById: assignedById ?? null,
            outreachSuggestedMemberId: null,
            outreachSuggestionReasons: null,
          });
          assigned += 1;
        }

        return { assigned, skipped };
      },
      authContext,
    );
  }

  // Only the first writer wins when two runs race on one candidate.
  private async pinIfEmpty({
    workspaceId,
    candidateId,
    memberId,
    reason,
    assignedById,
  }: {
    workspaceId: string;
    candidateId: string;
    memberId: string;
    reason: OutreachAssignmentReason;
    assignedById: string | null;
  }): Promise<boolean> {
    if (!isNonEmptyString(memberId)) {
      return false;
    }

    const candidateRepository = await this.getCandidateRepository(workspaceId);
    const result = await candidateRepository.update(
      { id: candidateId, outreachWorkspaceMemberId: IsNull() },
      {
        outreachWorkspaceMemberId: memberId,
        outreachAssignedAt: new Date().toISOString(),
        outreachAssignmentReason: reason,
        outreachAssignedById: assignedById,
      },
    );

    return (result?.affected ?? 0) > 0;
  }

  private async resolveEligibleMembers({
    workspaceId,
    members,
    config,
  }: {
    workspaceId: string;
    members: WorkspaceMemberRecord[];
    config: OutreachMemberAssignmentConfig;
  }): Promise<string[]> {
    const isMock = await this.featureFlagService.isFeatureEnabled(
      FeatureFlagKey.IS_OUTREACH_MOCK_UNIPILE_ENABLED,
      workspaceId,
    );
    // Mock workspaces send without a connected account, so every member counts.
    const seatedMemberIds = members
      .filter(
        (member) =>
          isMock || isNonEmptyString(member.linkedinUnipileAccountId?.trim()),
      )
      .map((member) => member.id);

    return resolveEligibleMemberIds({
      seatedMemberIds,
      participantMemberIds: config.participantMemberIds,
    });
  }

  private async loadActiveCandidateCounts({
    workspaceId,
    projectId,
  }: {
    workspaceId: string;
    projectId?: string | null;
  }): Promise<Record<string, number>> {
    const candidateRepository = await this.getCandidateRepository(workspaceId);
    const candidates = await candidateRepository.find({
      where: isNonEmptyString(projectId) ? { projectId } : {},
      select: {
        id: true,
        outreachWorkspaceMemberId: true,
        outreachSequenceStage: true,
      } as never,
    });
    const counts: Record<string, number> = {};

    for (const candidate of candidates) {
      const memberId = candidate.outreachWorkspaceMemberId?.trim();

      if (
        !isNonEmptyString(memberId) ||
        TERMINAL_STAGES.includes(candidate.outreachSequenceStage ?? '')
      ) {
        continue;
      }

      counts[memberId] = (counts[memberId] ?? 0) + 1;
    }

    return counts;
  }

  private async loadMembers(
    workspaceId: string,
  ): Promise<WorkspaceMemberRecord[]> {
    const memberRepository =
      await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberRecord>(
        workspaceId,
        'workspaceMember',
        { shouldBypassPermissionChecks: true },
      );

    return memberRepository.find({ order: { id: 'ASC' } as never });
  }

  private async loadProject(
    workspaceId: string,
    projectId?: string | null,
  ): Promise<ProjectRecord | null> {
    if (!isNonEmptyString(projectId)) {
      return null;
    }

    const projectRepository =
      await this.globalWorkspaceOrmManager.getRepository<ProjectRecord>(
        workspaceId,
        'project',
        { shouldBypassPermissionChecks: true },
      );

    return projectRepository.findOne({ where: { id: projectId } });
  }

  private getCandidateRepository(workspaceId: string) {
    return this.globalWorkspaceOrmManager.getRepository<CandidateRecord>(
      workspaceId,
      'candidate',
      { shouldBypassPermissionChecks: true },
    );
  }
}

const formatMemberName = (member: WorkspaceMemberRecord): string =>
  [member.name?.firstName, member.name?.lastName]
    .filter(isNonEmptyString)
    .join(' ') ||
  member.userEmail ||
  member.id;
