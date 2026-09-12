import { useCallback, useEffect, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useMutation } from '@apollo/client/react';
import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';

import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import { TextArea } from '@/ui/input/components/TextArea';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { UPDATE_WORKSPACE } from '@/workspace/graphql/mutations/updateWorkspace';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { logError } from '~/utils/logError';

const StyledFields = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;

type WorkspaceCompanyFormState = {
  companyName: string;
  companyDomain: string;
  linkedinUrl: string;
  industry: string;
  summary: string;
  employeeRange: string;
  hq: string;
  icpSpec: string;
};

const emptyForm = (): WorkspaceCompanyFormState => ({
  companyName: '',
  companyDomain: '',
  linkedinUrl: '',
  industry: '',
  summary: '',
  employeeRange: '',
  hq: '',
  icpSpec: '',
});

export const SettingsWorkspaceCompanyProfileFields = () => {
  const { t } = useLingui();
  const currentWorkspace = useAtomStateValue(currentWorkspaceState);
  const setCurrentWorkspace = useSetAtomState(currentWorkspaceState);
  const [updateWorkspace] = useMutation(UPDATE_WORKSPACE);

  const [form, setForm] = useState<WorkspaceCompanyFormState>(() => ({
    companyName: currentWorkspace?.companyName ?? '',
    companyDomain: currentWorkspace?.companyDomain ?? '',
    linkedinUrl: currentWorkspace?.linkedinUrl ?? '',
    industry: currentWorkspace?.industry ?? '',
    summary: currentWorkspace?.summary ?? '',
    employeeRange: currentWorkspace?.employeeRange ?? '',
    hq: currentWorkspace?.hq ?? '',
    icpSpec: currentWorkspace?.icpSpec ?? '',
  }));

  useEffect(() => {
    if (!isDefined(currentWorkspace)) {
      setForm(emptyForm());

      return;
    }

    setForm({
      companyName: currentWorkspace.companyName ?? '',
      companyDomain: currentWorkspace.companyDomain ?? '',
      linkedinUrl: currentWorkspace.linkedinUrl ?? '',
      industry: currentWorkspace.industry ?? '',
      summary: currentWorkspace.summary ?? '',
      employeeRange: currentWorkspace.employeeRange ?? '',
      hq: currentWorkspace.hq ?? '',
      icpSpec: currentWorkspace.icpSpec ?? '',
    });
  }, [currentWorkspace?.id]);

  const persist = useCallback(
    async (next: WorkspaceCompanyFormState) => {
      if (!isDefined(currentWorkspace?.id)) {
        return;
      }

      try {
        const result = await updateWorkspace({
          variables: {
            input: {
              companyName: next.companyName || null,
              companyDomain: next.companyDomain || null,
              linkedinUrl: next.linkedinUrl || null,
              industry: next.industry || null,
              summary: next.summary || null,
              employeeRange: next.employeeRange || null,
              hq: next.hq || null,
              icpSpec: next.icpSpec || null,
            },
          },
        });

        const updated = result.data?.updateWorkspace;

        if (!isDefined(updated)) {
          throw result.error ?? new Error('Workspace update failed');
        }

        setCurrentWorkspace((previous) => {
          if (!isDefined(previous)) {
            return previous;
          }

          return {
            ...previous,
            companyName: updated.companyName ?? next.companyName,
            companyDomain: updated.companyDomain ?? next.companyDomain,
            linkedinUrl: updated.linkedinUrl ?? next.linkedinUrl,
            industry: updated.industry ?? next.industry,
            summary: updated.summary ?? next.summary,
            employeeRange: updated.employeeRange ?? next.employeeRange,
            hq: updated.hq ?? next.hq,
            icpSpec: updated.icpSpec ?? next.icpSpec,
          };
        });
      } catch (error) {
        logError(error);
      }
    },
    [currentWorkspace?.id, setCurrentWorkspace, updateWorkspace],
  );

  const debouncedPersist = useDebouncedCallback(persist, 600);

  const updateField = <K extends keyof WorkspaceCompanyFormState>(
    key: K,
    value: WorkspaceCompanyFormState[K],
  ) => {
    setForm((previous) => {
      const next = { ...previous, [key]: value };
      void debouncedPersist(next);

      return next;
    });
  };

  if (!isDefined(currentWorkspace?.id)) {
    return null;
  }

  return (
    <StyledFields>
      <SettingsTextInput
        instanceId="workspace-company-name"
        label={t`Company name`}
        value={form.companyName}
        onChange={(value) => updateField('companyName', value)}
        fullWidth
      />
      <SettingsTextInput
        instanceId="workspace-company-domain"
        label={t`Company domain`}
        value={form.companyDomain}
        onChange={(value) => updateField('companyDomain', value)}
        placeholder="example.com"
        fullWidth
      />
      <SettingsTextInput
        instanceId="workspace-company-linkedin-url"
        label={t`Company LinkedIn URL`}
        value={form.linkedinUrl}
        onChange={(value) => updateField('linkedinUrl', value)}
        placeholder="https://www.linkedin.com/company/…"
        fullWidth
      />
      <SettingsTextInput
        instanceId="workspace-company-industry"
        label={t`Industry`}
        value={form.industry}
        onChange={(value) => updateField('industry', value)}
        fullWidth
      />
      <SettingsTextInput
        instanceId="workspace-company-employee-range"
        label={t`Employee range`}
        value={form.employeeRange}
        onChange={(value) => updateField('employeeRange', value)}
        placeholder="11-50"
        fullWidth
      />
      <SettingsTextInput
        instanceId="workspace-company-hq"
        label={t`HQ`}
        value={form.hq}
        onChange={(value) => updateField('hq', value)}
        fullWidth
      />
      <TextArea
        textAreaId="workspace-company-summary"
        label={t`Summary`}
        value={form.summary}
        onChange={(value) => updateField('summary', value)}
        minRows={3}
      />
      <TextArea
        textAreaId="workspace-company-icp-spec"
        label={t`Default ICP (JSON)`}
        value={form.icpSpec}
        onChange={(value) => updateField('icpSpec', value)}
        minRows={4}
        placeholder='{"targetTitles":[],"locations":[]}'
      />
    </StyledFields>
  );
};
