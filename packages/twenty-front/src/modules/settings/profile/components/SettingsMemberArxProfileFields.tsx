import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { useCallback, useEffect, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import {
  findWorkspaceMembersForArx,
  graphQLToUpdateOneWorkspaceMemberArx,
} from 'twenty-shared/graphql';
import {
  extractWorkspaceMemberFromApolloData,
  isDefined,
  parseBrowserExtensionCookieArray,
  parseWorkspaceMemberLinkedinProfile,
  workspaceMemberFilterById,
  type WorkspaceMembersApolloData,
} from 'twenty-shared/utils';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import { TextArea } from '@/ui/input/components/TextArea';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { logError } from '~/utils/logError';

const StyledFields = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledHint = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
`;

const FIND_MEMBER_ARX = gql`
  ${findWorkspaceMembersForArx}
`;

const UPDATE_MEMBER_ARX = gql`
  ${graphQLToUpdateOneWorkspaceMemberArx}
`;

type MemberArxFormState = {
  jobTitle: string;
  phoneNumber: string;
  linkedinUrl: string;
  linkedinUnipileAccountId: string;
  whatsappUnipileAccountId: string;
  chromeExtensionId: string;
};

type SettingsMemberArxProfileFieldsProps = {
  workspaceMemberId?: string;
};

const emptyForm = (): MemberArxFormState => ({
  jobTitle: '',
  phoneNumber: '',
  linkedinUrl: '',
  linkedinUnipileAccountId: '',
  whatsappUnipileAccountId: '',
  chromeExtensionId: '',
});

const formatCrunchbaseCookiesJson = (value: unknown): string => {
  if (!isDefined(value)) {
    return '';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
};

const linkedinProfileIdFromMember = (linkedinProfile: unknown): string => {
  const stored = parseWorkspaceMemberLinkedinProfile(linkedinProfile);

  if (!isDefined(stored)) {
    return '';
  }

  const fromPublicIdentifier = stored.publicIdentifier?.trim();

  if (isDefined(fromPublicIdentifier) && fromPublicIdentifier.length > 0) {
    return fromPublicIdentifier;
  }

  const fromMe = stored.me?.public_identifier?.trim();

  return fromMe ?? '';
};

export const SettingsMemberArxProfileFields = ({
  workspaceMemberId: workspaceMemberIdProp,
}: SettingsMemberArxProfileFieldsProps = {}) => {
  const { t } = useLingui();
  const apolloCoreClient = useApolloCoreClient();
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const workspaceMemberId = workspaceMemberIdProp ?? currentWorkspaceMember?.id;

  const { data, loading } = useQuery<WorkspaceMembersApolloData>(
    FIND_MEMBER_ARX,
    {
      client: apolloCoreClient,
      variables: workspaceMemberId
        ? workspaceMemberFilterById(workspaceMemberId)
        : undefined,
      skip: !isDefined(workspaceMemberId),
      fetchPolicy: 'cache-and-network',
    },
  );

  const [updateMemberArx] = useMutation(UPDATE_MEMBER_ARX, {
    client: apolloCoreClient,
  });

  const member = extractWorkspaceMemberFromApolloData(data);

  const [form, setForm] = useState<MemberArxFormState>(emptyForm);
  const [linkedinProfileId, setLinkedinProfileId] = useState('');
  const [crunchbaseCookiesJson, setCrunchbaseCookiesJson] = useState('');
  const [crunchbaseCookiesLastSyncedAt, setCrunchbaseCookiesLastSyncedAt] =
    useState<string | null>(null);
  const [crunchbaseCookiesError, setCrunchbaseCookiesError] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!isDefined(member)) {
      return;
    }

    setForm({
      jobTitle: member.jobTitle ?? '',
      phoneNumber: member.phoneNumber ?? '',
      linkedinUrl: member.linkedinUrl ?? '',
      linkedinUnipileAccountId: member.linkedinUnipileAccountId ?? '',
      whatsappUnipileAccountId: member.whatsappUnipileAccountId ?? '',
      chromeExtensionId: member.chromeExtensionId ?? '',
    });
    setLinkedinProfileId(linkedinProfileIdFromMember(member.linkedinProfile));
    setCrunchbaseCookiesJson(
      formatCrunchbaseCookiesJson(member.crunchbaseCookies),
    );
    setCrunchbaseCookiesLastSyncedAt(
      member.crunchbaseCookiesLastSyncedAt != null
        ? String(member.crunchbaseCookiesLastSyncedAt)
        : null,
    );
    setCrunchbaseCookiesError(null);
  }, [member?.id, data]);

  const persist = useCallback(
    async (next: MemberArxFormState) => {
      if (!isDefined(workspaceMemberId)) {
        return;
      }

      try {
        await updateMemberArx({
          variables: {
            idToUpdate: workspaceMemberId,
            input: {
              jobTitle: next.jobTitle || null,
              phoneNumber: next.phoneNumber || null,
              linkedinUrl: next.linkedinUrl || null,
              linkedinUnipileAccountId: next.linkedinUnipileAccountId || null,
              whatsappUnipileAccountId: next.whatsappUnipileAccountId || null,
              chromeExtensionId: next.chromeExtensionId || null,
            },
          },
        });
      } catch (error) {
        logError(error);
      }
    },
    [updateMemberArx, workspaceMemberId],
  );

  const persistCrunchbaseCookies = useCallback(
    async (rawJson: string) => {
      if (!isDefined(workspaceMemberId)) {
        return;
      }

      const trimmed = rawJson.trim();

      if (trimmed.length === 0) {
        setCrunchbaseCookiesError(null);
        try {
          await updateMemberArx({
            variables: {
              idToUpdate: workspaceMemberId,
              input: {
                crunchbaseCookies: null,
              },
            },
          });
        } catch (error) {
          logError(error);
        }

        return;
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(trimmed);
      } catch {
        setCrunchbaseCookiesError(t`Invalid JSON`);

        return;
      }

      const cookies = parseBrowserExtensionCookieArray(parsed);

      if (cookies === null) {
        setCrunchbaseCookiesError(
          t`Must be a JSON array of Crunchbase cookie objects`,
        );

        return;
      }

      setCrunchbaseCookiesError(null);

      try {
        await updateMemberArx({
          variables: {
            idToUpdate: workspaceMemberId,
            input: {
              crunchbaseCookies: cookies,
            },
          },
        });
      } catch (error) {
        logError(error);
      }
    },
    [t, updateMemberArx, workspaceMemberId],
  );

  const debouncedPersist = useDebouncedCallback(persist, 600);
  const debouncedPersistCrunchbaseCookies = useDebouncedCallback(
    persistCrunchbaseCookies,
    600,
  );

  const updateField = <K extends keyof MemberArxFormState>(
    key: K,
    value: MemberArxFormState[K],
  ) => {
    setForm((previous) => {
      const next = { ...previous, [key]: value };
      void debouncedPersist(next);

      return next;
    });
  };

  const updateCrunchbaseCookiesJson = (value: string) => {
    setCrunchbaseCookiesJson(value);
    void debouncedPersistCrunchbaseCookies(value);
  };

  if (!isDefined(workspaceMemberId)) {
    return null;
  }

  if (loading && !isDefined(member)) {
    return null;
  }

  return (
    <StyledFields>
      <SettingsTextInput
        instanceId="member-arx-job-title"
        label={t`Job title`}
        value={form.jobTitle}
        onChange={(value) => updateField('jobTitle', value)}
        fullWidth
      />
      <SettingsTextInput
        instanceId="member-arx-phone"
        label={t`Phone number`}
        value={form.phoneNumber}
        onChange={(value) => updateField('phoneNumber', value)}
        fullWidth
      />
      <SettingsTextInput
        instanceId="member-arx-linkedin-url"
        label={t`LinkedIn Profile URL`}
        value={form.linkedinUrl}
        onChange={(value) => updateField('linkedinUrl', value)}
        fullWidth
      />
      <SettingsTextInput
        instanceId="member-arx-linkedin-profile-id"
        label={t`LinkedIn Profile ID`}
        value={linkedinProfileId}
        onChange={() => undefined}
        disabled
        fullWidth
        placeholder={t`Synced from LinkedIn / Unipile`}
      />
      <SettingsTextInput
        instanceId="member-arx-linkedin-unipile-account-id"
        label={t`LinkedIn Unipile Account ID`}
        value={form.linkedinUnipileAccountId}
        onChange={(value) => updateField('linkedinUnipileAccountId', value)}
        fullWidth
      />
      <SettingsTextInput
        instanceId="member-arx-whatsapp-unipile-account-id"
        label={t`WhatsApp Unipile Account ID`}
        value={form.whatsappUnipileAccountId}
        onChange={(value) => updateField('whatsappUnipileAccountId', value)}
        fullWidth
      />
      <SettingsTextInput
        instanceId="member-arx-chrome-extension-id"
        label={t`Chrome Extension ID`}
        value={form.chromeExtensionId}
        onChange={(value) => updateField('chromeExtensionId', value)}
        fullWidth
      />
      <TextArea
        textAreaId="member-arx-crunchbase-cookies"
        label={t`Crunchbase cookies (JSON)`}
        value={crunchbaseCookiesJson}
        onChange={updateCrunchbaseCookiesJson}
        minRows={6}
        maxRows={16}
        placeholder={t`Paste Chrome cookie export JSON array`}
      />
      {isDefined(crunchbaseCookiesError) && (
        <StyledHint>{crunchbaseCookiesError}</StyledHint>
      )}
      {isDefined(crunchbaseCookiesLastSyncedAt) && (
        <StyledHint>
          {t`Last synced from extension:`} {crunchbaseCookiesLastSyncedAt}
        </StyledHint>
      )}
    </StyledFields>
  );
};
