import { OutreachMemberAssignmentService } from 'src/engine/core-modules/outreach-command/services/outreach-member-assignment.service';

type Row = Record<string, unknown> & { id: string };

const buildHarness = ({
  candidates,
  members,
  project = { id: 'p1', recruiterId: null, outreachConfig: null },
  isMock = true,
}: {
  candidates: Row[];
  members: Row[];
  project?: Row;
  isMock?: boolean;
}) => {
  const candidateUpdate = jest.fn(
    async (criteria: unknown, patch: Record<string, unknown>) => {
      const id =
        typeof criteria === 'string'
          ? criteria
          : (criteria as { id: string }).id;
      const target = candidates.find((candidate) => candidate.id === id);
      const isConditional = typeof criteria !== 'string';

      if (
        !target ||
        (isConditional &&
          typeof target.outreachWorkspaceMemberId === 'string' &&
          target.outreachWorkspaceMemberId.length > 0)
      ) {
        return { affected: 0 };
      }

      Object.assign(target, patch);

      return { affected: 1 };
    },
  );
  const repositories: Record<string, unknown> = {
    candidate: {
      findOne: async ({ where }: { where: { id: string } }) =>
        candidates.find((candidate) => candidate.id === where.id) ?? null,
      find: async () => candidates,
      update: candidateUpdate,
    },
    workspaceMember: { find: async () => members },
    project: { findOne: async () => project },
  };
  const ormManager = {
    executeInWorkspaceContext: async (callback: () => Promise<unknown>) =>
      callback(),
    getRepository: async (_workspaceId: string, objectName: string) =>
      repositories[objectName],
  };
  const featureFlagService = { isFeatureEnabled: async () => isMock };
  const service = new OutreachMemberAssignmentService(
    ormManager as never,
    featureFlagService as never,
  );

  return { service, candidates, candidateUpdate };
};

const members = [
  { id: 'm1', linkedinUnipileAccountId: 'acc1' },
  { id: 'm2', linkedinUnipileAccountId: 'acc2' },
];

describe('OutreachMemberAssignmentService', () => {
  describe('selectForCandidate', () => {
    it('should return the stored pin without writing', async () => {
      const { service, candidateUpdate } = buildHarness({
        candidates: [
          {
            id: 'c1',
            projectId: 'p1',
            outreachWorkspaceMemberId: 'm2',
            outreachAssignmentReason: 'manual',
          },
        ],
        members,
      });

      await expect(
        service.selectForCandidate({ workspaceId: 'w', candidateId: 'c1' }),
      ).resolves.toMatchObject({
        success: true,
        workspaceMemberId: 'm2',
        alreadyPinned: true,
        reason: 'manual',
      });
      expect(candidateUpdate).not.toHaveBeenCalled();
    });

    it('should pin the least loaded member for an unassigned candidate', async () => {
      const { service, candidates } = buildHarness({
        candidates: [
          { id: 'c1', projectId: 'p1', outreachSequenceStage: 'QUEUED' },
          {
            id: 'c2',
            projectId: 'p1',
            outreachWorkspaceMemberId: 'm1',
            outreachSequenceStage: 'CONNECTION_SENT',
          },
        ],
        members,
      });

      const result = await service.selectForCandidate({
        workspaceId: 'w',
        candidateId: 'c1',
      });

      expect(result).toMatchObject({
        workspaceMemberId: 'm2',
        reason: 'least_loaded',
        alreadyPinned: false,
      });
      expect(candidates[0].outreachWorkspaceMemberId).toBe('m2');
    });

    it('should alternate members under round robin', async () => {
      const { service } = buildHarness({
        candidates: [
          { id: 'c1', projectId: 'p1' },
          { id: 'c2', projectId: 'p1' },
          { id: 'c3', projectId: 'p1' },
        ],
        members,
        project: {
          id: 'p1',
          outreachConfig: { memberAssignment: { policy: 'round_robin' } },
        },
      });
      const picked: string[] = [];

      for (const candidateId of ['c1', 'c2', 'c3']) {
        const result = await service.selectForCandidate({
          workspaceId: 'w',
          candidateId,
        });

        picked.push(result.workspaceMemberId);
      }

      expect(picked).toEqual(['m1', 'm2', 'm1']);
    });

    it('should keep the first writer when two runs race', async () => {
      const candidates: Row[] = [{ id: 'c1', projectId: 'p1' }];
      const { service } = buildHarness({ candidates, members });

      const [first, second] = await Promise.all([
        service.selectForCandidate({ workspaceId: 'w', candidateId: 'c1' }),
        service.selectForCandidate({ workspaceId: 'w', candidateId: 'c1' }),
      ]);

      expect(first.workspaceMemberId).toBe(second.workspaceMemberId);
      expect(candidates[0].outreachWorkspaceMemberId).toBe(
        first.workspaceMemberId,
      );
    });

    it('should honour the participant allow list', async () => {
      const { service } = buildHarness({
        candidates: [{ id: 'c1', projectId: 'p1' }],
        members,
        project: {
          id: 'p1',
          outreachConfig: {
            memberAssignment: {
              policy: 'least_loaded',
              participantMemberIds: ['m1'],
            },
          },
        },
      });

      await expect(
        service.selectForCandidate({ workspaceId: 'w', candidateId: 'c1' }),
      ).resolves.toMatchObject({ workspaceMemberId: 'm1' });
    });

    it('should fall back to the project recruiter under manual only', async () => {
      const { service } = buildHarness({
        candidates: [{ id: 'c1', projectId: 'p1' }],
        members,
        project: {
          id: 'p1',
          recruiterId: 'm2',
          outreachConfig: { memberAssignment: { policy: 'manual_only' } },
        },
      });

      await expect(
        service.selectForCandidate({ workspaceId: 'w', candidateId: 'c1' }),
      ).resolves.toMatchObject({
        workspaceMemberId: 'm2',
        reason: 'fallback',
      });
    });

    it('should skip members without a LinkedIn seat outside mock mode', async () => {
      const { service } = buildHarness({
        candidates: [{ id: 'c1', projectId: 'p1' }],
        members: [{ id: 'm1' }, { id: 'm2', linkedinUnipileAccountId: 'acc2' }],
        isMock: false,
      });

      await expect(
        service.selectForCandidate({ workspaceId: 'w', candidateId: 'c1' }),
      ).resolves.toMatchObject({ workspaceMemberId: 'm2' });
    });

    it('should report a missing candidate', async () => {
      const { service } = buildHarness({ candidates: [], members });

      await expect(
        service.selectForCandidate({ workspaceId: 'w', candidateId: 'nope' }),
      ).resolves.toMatchObject({ success: false });
    });
  });

  describe('assign', () => {
    it('should leave a started candidate with its owner unless forced', async () => {
      const { service, candidates } = buildHarness({
        candidates: [
          {
            id: 'c1',
            projectId: 'p1',
            outreachWorkspaceMemberId: 'm1',
            outreachSequenceStage: 'CONNECTION_SENT',
          },
          {
            id: 'c2',
            projectId: 'p1',
            outreachWorkspaceMemberId: 'm1',
            outreachSequenceStage: 'QUEUED',
          },
        ],
        members,
      });

      const result = await service.assign({
        workspaceId: 'w',
        candidateIds: ['c1', 'c2'],
        memberId: 'm2',
      });

      expect(result.assigned).toBe(1);
      expect(result.skipped).toEqual([
        { candidateId: 'c1', reason: 'already_started_use_force' },
      ]);
      expect(candidates[0].outreachWorkspaceMemberId).toBe('m1');
      expect(candidates[1].outreachWorkspaceMemberId).toBe('m2');

      const forced = await service.assign({
        workspaceId: 'w',
        candidateIds: ['c1'],
        memberId: 'm2',
        force: true,
      });

      expect(forced.assigned).toBe(1);
      expect(candidates[0].outreachWorkspaceMemberId).toBe('m2');
    });

    it('should reject an unknown member', async () => {
      const { service } = buildHarness({
        candidates: [{ id: 'c1', projectId: 'p1' }],
        members,
      });

      const result = await service.assign({
        workspaceId: 'w',
        candidateIds: ['c1'],
        memberId: 'ghost',
      });

      expect(result.assigned).toBe(0);
      expect(result.skipped[0].reason).toBe('member_not_found');
    });
  });

  describe('split', () => {
    it('should spread candidates evenly across the eligible members', async () => {
      const { service, candidates } = buildHarness({
        candidates: ['c1', 'c2', 'c3', 'c4'].map((id) => ({
          id,
          projectId: 'p1',
        })),
        members,
      });

      const result = await service.split({
        workspaceId: 'w',
        projectId: 'p1',
        candidateIds: ['c1', 'c2', 'c3', 'c4'],
        mode: 'round_robin',
      });
      const counts = candidates.reduce<Record<string, number>>((acc, row) => {
        const owner = row.outreachWorkspaceMemberId as string;

        acc[owner] = (acc[owner] ?? 0) + 1;

        return acc;
      }, {});

      expect(result.assigned).toBe(4);
      expect(counts).toEqual({ m1: 2, m2: 2 });
    });
  });
});
