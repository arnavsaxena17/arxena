import {
  buildOutreachSplitPlan,
  isPreSendOutreachStage,
  pickLeastLoadedMember,
  pickRoundRobinMember,
  readOutreachMemberAssignmentConfig,
  resolveEligibleMemberIds,
} from 'src/engine/core-modules/outreach-command/utils/outreach-member-assignment.util';

describe('outreach member assignment util', () => {
  describe('readOutreachMemberAssignmentConfig', () => {
    it('should default to least loaded when no config is stored', () => {
      expect(readOutreachMemberAssignmentConfig(null)).toMatchObject({
        policy: 'least_loaded',
        participantMemberIds: [],
        referralInheritsOwner: true,
      });
    });

    it('should read a stored config and drop invalid weights', () => {
      const config = readOutreachMemberAssignmentConfig({
        memberAssignment: {
          policy: 'round_robin',
          participantMemberIds: ['a', '', 'b'],
          weights: { a: 2, b: -1, c: 'x' },
          warmMode: 'auto',
          referralInheritsOwner: false,
        },
      });

      expect(config).toEqual({
        policy: 'round_robin',
        participantMemberIds: ['a', 'b'],
        weights: { a: 2 },
        warmMode: 'auto',
        referralInheritsOwner: false,
      });
    });

    it('should fall back to the default policy for an unknown value', () => {
      expect(
        readOutreachMemberAssignmentConfig({
          memberAssignment: { policy: 'chaos' },
        }).policy,
      ).toBe('least_loaded');
    });
  });

  describe('pickLeastLoadedMember', () => {
    it('should pick the lightest member and break ties on the lowest id', () => {
      expect(
        pickLeastLoadedMember({
          memberIds: ['b', 'a', 'c'],
          loadByMemberId: { a: 3, b: 1, c: 1 },
        }),
      ).toBe('b');
    });

    it('should divide load by weight', () => {
      expect(
        pickLeastLoadedMember({
          memberIds: ['a', 'b'],
          loadByMemberId: { a: 4, b: 3 },
          weights: { a: 2 },
        }),
      ).toBe('a');
    });

    it('should return null when there are no members', () => {
      expect(
        pickLeastLoadedMember({ memberIds: [], loadByMemberId: {} }),
      ).toBeNull();
    });
  });

  describe('pickRoundRobinMember', () => {
    it('should alternate by how many are already assigned', () => {
      const memberIds = ['b', 'a'];

      expect(pickRoundRobinMember({ memberIds, assignedTotal: 0 })).toBe('a');
      expect(pickRoundRobinMember({ memberIds, assignedTotal: 1 })).toBe('b');
      expect(pickRoundRobinMember({ memberIds, assignedTotal: 2 })).toBe('a');
    });
  });

  describe('buildOutreachSplitPlan', () => {
    const candidateIds = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];

    it('should split evenly in round robin mode and be stable', () => {
      const plan = buildOutreachSplitPlan({
        candidateIds,
        memberIds: ['m2', 'm1', 'm3'],
        mode: 'round_robin',
      });
      const counts = plan.reduce<Record<string, number>>((acc, entry) => {
        acc[entry.memberId] = (acc[entry.memberId] ?? 0) + 1;

        return acc;
      }, {});

      expect(counts).toEqual({ m1: 2, m2: 2, m3: 2 });
      expect(
        buildOutreachSplitPlan({
          candidateIds: [...candidateIds].reverse(),
          memberIds: ['m3', 'm2', 'm1'],
          mode: 'round_robin',
        }),
      ).toEqual(plan);
    });

    it('should balance around members that already carry load', () => {
      const plan = buildOutreachSplitPlan({
        candidateIds: ['c1', 'c2', 'c3', 'c4'],
        memberIds: ['m1', 'm2'],
        mode: 'balanced',
        loadByMemberId: { m1: 2 },
      });

      expect(plan.filter((entry) => entry.memberId === 'm2')).toHaveLength(3);
      expect(plan.filter((entry) => entry.memberId === 'm1')).toHaveLength(1);
    });

    it('should honour weights in balanced mode', () => {
      const plan = buildOutreachSplitPlan({
        candidateIds: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'],
        memberIds: ['m1', 'm2'],
        mode: 'balanced',
        weights: { m1: 2 },
      });

      expect(plan.filter((entry) => entry.memberId === 'm1')).toHaveLength(4);
    });

    it('should return no assignments without members', () => {
      expect(
        buildOutreachSplitPlan({
          candidateIds,
          memberIds: [],
          mode: 'balanced',
        }),
      ).toEqual([]);
    });
  });

  describe('resolveEligibleMemberIds', () => {
    it('should use every seated member when no allow list is set', () => {
      expect(
        resolveEligibleMemberIds({
          seatedMemberIds: ['a', 'b'],
          participantMemberIds: [],
        }),
      ).toEqual(['a', 'b']);
    });

    it('should restrict to the allow list but never add an unseated member', () => {
      expect(
        resolveEligibleMemberIds({
          seatedMemberIds: ['a', 'b'],
          participantMemberIds: ['b', 'z'],
        }),
      ).toEqual(['b']);
    });
  });

  describe('isPreSendOutreachStage', () => {
    it('should treat queued and empty stages as not yet sent', () => {
      expect(isPreSendOutreachStage('QUEUED')).toBe(true);
      expect(isPreSendOutreachStage(null)).toBe(true);
      expect(isPreSendOutreachStage('CONNECTION_SENT')).toBe(false);
      expect(isPreSendOutreachStage('REPLIED')).toBe(false);
    });
  });
});
