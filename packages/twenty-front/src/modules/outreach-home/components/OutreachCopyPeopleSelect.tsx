import { isNonEmptyString } from '@sniptt/guards';
import { useCallback, useMemo, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { Select } from '@/ui/input/components/Select';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

type OutreachCopyProjectRecord = ObjectRecord & {
  id: string;
  name?: string | null;
  outreachWorkflowId?: string | null;
};

type CopyCandidatesResponse = {
  copied?: number;
  skippedAlreadyInProject?: number;
  skippedDoNotContact?: number;
  skippedEngaged?: number;
  skippedMissingPerson?: number;
  message?: string;
};

const describeCopyResult = (result: CopyCandidatesResponse): string => {
  const copied = result.copied ?? 0;
  const skipped = [
    (result.skippedAlreadyInProject ?? 0) > 0
      ? `${result.skippedAlreadyInProject} already here`
      : '',
    (result.skippedEngaged ?? 0) > 0
      ? `${result.skippedEngaged} already replied`
      : '',
    (result.skippedDoNotContact ?? 0) > 0
      ? `${result.skippedDoNotContact} do not contact`
      : '',
  ].filter((part) => part.length > 0);
  const base = `Copied ${copied} ${copied === 1 ? 'person' : 'people'}`;

  return skipped.length > 0 ? `${base} · ${skipped.join(' · ')}` : base;
};

type OutreachCopyPeopleSelectProps = {
  projectId: string | null | undefined;
  onCopied?: () => void | Promise<void>;
};

// Manual rounds: bring the non-responders of another project into this one as
// fresh Candidates at QUEUED. Nothing is sent until the operator clicks Start.
export const OutreachCopyPeopleSelect = ({
  projectId,
  onCopied,
}: OutreachCopyPeopleSelectProps) => {
  const tokenPair = useAtomStateValue(tokenPairState);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const [isWorking, setIsWorking] = useState(false);

  const { records: projects } = useFindManyRecords<OutreachCopyProjectRecord>({
    objectNameSingular: 'project',
    limit: 100,
    recordGqlFields: {
      id: true,
      name: true,
      outreachWorkflowId: true,
    },
  });

  const options = useMemo(
    () =>
      projects
        .filter(
          (project) =>
            isNonEmptyString(project.id) && project.id !== (projectId ?? ''),
        )
        .map((project) => ({
          value: project.id,
          label: project.name?.trim() || 'Untitled project',
          ...(isNonEmptyString(project.outreachWorkflowId)
            ? {}
            : { contextualText: 'no sequencer' }),
        })),
    [projectId, projects],
  );

  const copyFromProject = useCallback(
    async (sourceProjectId: string) => {
      const accessToken =
        tokenPair?.accessOrWorkspaceAgnosticToken?.token ?? '';

      if (!isDefined(projectId) || !isNonEmptyString(accessToken)) {
        enqueueErrorSnackBar({ message: 'Sign in again to copy people' });

        return;
      }

      setIsWorking(true);

      try {
        const response = await fetch(
          `${REACT_APP_SERVER_BASE_URL}/outreach-command/projects/${projectId}/candidates/copy`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ sourceProjectId }),
          },
        );
        const result = (await response.json()) as CopyCandidatesResponse;

        if (!response.ok) {
          enqueueErrorSnackBar({
            message:
              typeof result?.message === 'string'
                ? result.message
                : 'Copy failed',
          });

          return;
        }

        enqueueSuccessSnackBar({ message: describeCopyResult(result) });
        await onCopied?.();
      } catch (error) {
        enqueueErrorSnackBar({
          message: error instanceof Error ? error.message : 'Copy failed',
        });
      } finally {
        setIsWorking(false);
      }
    },
    [
      enqueueErrorSnackBar,
      enqueueSuccessSnackBar,
      onCopied,
      projectId,
      tokenPair,
    ],
  );

  if (!isDefined(projectId) || options.length === 0) {
    return null;
  }

  return (
    <Select<string>
      dropdownId="outreach-copy-people-select"
      disabled={isWorking}
      emptyOption={{
        value: '',
        label: isWorking ? 'Copying…' : 'Copy people from…',
      }}
      value=""
      onChange={(value) => {
        if (!isNonEmptyString(value)) {
          return;
        }

        void copyFromProject(value);
      }}
      options={options}
      selectSizeVariant="small"
      dropdownWidthAuto
      needIconCheck={false}
    />
  );
};
