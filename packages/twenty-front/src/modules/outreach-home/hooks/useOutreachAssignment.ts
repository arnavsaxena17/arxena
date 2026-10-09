import { useCallback, useEffect, useMemo, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';

import { tokenPairState } from '@/auth/states/tokenPairState';
import {
  assignOutreachCandidates,
  confirmOutreachAssignmentSuggestions,
  fetchOutreachAssignmentMembers,
  fetchOutreachAssignmentOwners,
  saveOutreachAssignmentConfig,
  splitOutreachCandidates,
  type OutreachAssignmentConfig,
  type OutreachAssignmentMembersResponse,
  type OutreachAssignmentOwner,
  type OutreachAssignResponse,
} from '@/outreach-home/utils/outreach-assignment-api';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

const describeResult = (result: OutreachAssignResponse): string => {
  const skippedStarted = result.skipped.filter(
    (entry) => entry.reason === 'already_started_use_force',
  ).length;
  const base = `Assigned ${result.assigned} ${result.assigned === 1 ? 'person' : 'people'}`;

  return skippedStarted > 0
    ? `${base}. ${skippedStarted} already started, left with their current owner.`
    : base;
};

export const useOutreachAssignment = (projectId: string | null | undefined) => {
  const tokenPair = useAtomStateValue(tokenPairState);
  const { enqueueErrorSnackBar, enqueueSuccessSnackBar } = useSnackBar();
  const accessToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token ?? '';
  const [membersResponse, setMembersResponse] =
    useState<OutreachAssignmentMembersResponse | null>(null);
  const [owners, setOwners] = useState<
    Record<string, OutreachAssignmentOwner>
  >({});
  const [isWorking, setIsWorking] = useState(false);

  const refetch = useCallback(async () => {
    if (!isDefined(projectId) || !accessToken) {
      setMembersResponse(null);
      setOwners({});

      return;
    }

    try {
      const [nextMembers, nextOwners] = await Promise.all([
        fetchOutreachAssignmentMembers({ projectId, accessToken }),
        fetchOutreachAssignmentOwners({ projectId, accessToken }),
      ]);

      setMembersResponse(nextMembers);
      setOwners(nextOwners);
    } catch {
      // Older servers or workspaces without the pin fields simply show no owners.
      setMembersResponse(null);
      setOwners({});
    }
  }, [accessToken, projectId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const ownerNameByCandidateId = useMemo(() => {
    const nameByMemberId = new Map(
      (membersResponse?.members ?? []).map((member) => [
        member.memberId,
        member.name,
      ]),
    );
    const names: Record<string, string> = {};

    for (const [candidateId, owner] of Object.entries(owners)) {
      if (owner.memberId) {
        names[candidateId] = nameByMemberId.get(owner.memberId) ?? 'Member';
      } else if (owner.suggestedMemberId) {
        names[candidateId] = `Suggested: ${nameByMemberId.get(owner.suggestedMemberId) ?? 'Member'}`;
      }
    }

    return names;
  }, [membersResponse, owners]);

  const run = useCallback(
    async (action: () => Promise<OutreachAssignResponse>) => {
      setIsWorking(true);

      try {
        const result = await action();

        enqueueSuccessSnackBar({ message: describeResult(result) });
        await refetch();

        return result;
      } catch (error) {
        enqueueErrorSnackBar({
          message:
            error instanceof Error ? error.message : 'Assignment failed',
        });

        return null;
      } finally {
        setIsWorking(false);
      }
    },
    [enqueueErrorSnackBar, enqueueSuccessSnackBar, refetch],
  );

  const assignToMember = useCallback(
    (candidateIds: string[], memberId: string, force = false) =>
      isDefined(projectId)
        ? run(() =>
            assignOutreachCandidates({
              projectId,
              accessToken,
              candidateIds,
              memberId,
              force,
            }),
          )
        : Promise.resolve(null),
    [accessToken, projectId, run],
  );

  const splitAcrossTeam = useCallback(
    (candidateIds: string[], mode: 'round_robin' | 'balanced' = 'balanced') =>
      isDefined(projectId)
        ? run(() =>
            splitOutreachCandidates({
              projectId,
              accessToken,
              candidateIds,
              mode,
            }),
          )
        : Promise.resolve(null),
    [accessToken, projectId, run],
  );

  const confirmSuggestions = useCallback(
    (candidateIds: string[]) =>
      isDefined(projectId)
        ? run(() =>
            confirmOutreachAssignmentSuggestions({
              projectId,
              accessToken,
              candidateIds,
            }),
          )
        : Promise.resolve(null),
    [accessToken, projectId, run],
  );

  const saveConfig = useCallback(
    async (config: Partial<OutreachAssignmentConfig>) => {
      if (!isDefined(projectId)) {
        return;
      }

      setIsWorking(true);

      try {
        await saveOutreachAssignmentConfig({
          projectId,
          accessToken,
          config,
        });
        enqueueSuccessSnackBar({ message: 'Sender assignment saved' });
        await refetch();
      } catch (error) {
        enqueueErrorSnackBar({
          message:
            error instanceof Error ? error.message : 'Failed to save settings',
        });
      } finally {
        setIsWorking(false);
      }
    },
    [accessToken, enqueueErrorSnackBar, enqueueSuccessSnackBar, projectId, refetch],
  );

  return {
    members: membersResponse?.members ?? [],
    config: membersResponse?.config ?? null,
    pinActive: membersResponse?.pinActive ?? false,
    pinInDraft: membersResponse?.pinInDraft ?? false,
    owners,
    ownerNameByCandidateId,
    isWorking,
    refetch,
    assignToMember,
    splitAcrossTeam,
    confirmSuggestions,
    saveConfig,
  };
};
