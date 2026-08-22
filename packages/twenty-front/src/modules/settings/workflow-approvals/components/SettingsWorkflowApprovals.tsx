import { useCallback, useEffect, useMemo, useState } from 'react';

import { getTokenPair } from '@/apollo/utils/getTokenPair';
import { SettingsEmptyPlaceholder } from '@/settings/components/SettingsEmptyPlaceholder';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsTableListSection } from '@/settings/components/SettingsTableListSection';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { Status } from 'twenty-ui/data-display';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { type ThemeColor } from 'twenty-ui/theme';
import { H2Title } from 'twenty-ui/typography';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

type EnsureResult = {
  name: string;
  status: string;
  templateStatus?: string;
  error?: string;
};

type TemplateRow = {
  id: string;
  name: string;
  status: string;
};

const StyledError = styled.p`
  color: ${themeCssVariables.color.red};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
`;

const StyledName = styled.span`
  word-break: break-word;
`;

const getStatusColor = (status: string): ThemeColor => {
  const normalized = status.toUpperCase();

  if (normalized === 'APPROVED' || normalized === 'CREATED') {
    return 'green';
  }

  if (normalized === 'REJECTED' || normalized === 'ERROR' || normalized === 'FAILED') {
    return 'red';
  }

  if (normalized === 'PENDING' || normalized === 'PAUSED') {
    return 'orange';
  }

  return 'gray';
};

export const SettingsWorkflowApprovals = () => {
  const { t } = useLingui();
  const [results, setResults] = useState<EnsureResult[]>([]);
  const [templates, setTemplates] = useState<
    Array<{ name?: string; status?: string }>
  >([]);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [listing, setListing] = useState(true);

  const getAuthHeaders = (): HeadersInit => {
    const tokenPair = getTokenPair();
    const accessToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

    return {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    };
  };

  const parseJson = async (response: Response) => {
    const text = await response.text();

    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(
        response.ok
          ? 'Invalid JSON from workflow-form-whatsapp'
          : `Request failed (${response.status})`,
      );
    }
  };

  const refreshTemplates = useCallback(async () => {
    const response = await fetch(
      `${REACT_APP_SERVER_BASE_URL}/workflow-form-whatsapp/message-templates`,
      {
        headers: getAuthHeaders(),
      },
    );
    const data = await parseJson(response);

    setTemplates(
      (data.templates as Array<{ name?: string; status?: string }>) ?? [],
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setListing(true);
      try {
        await refreshTemplates();
        if (!cancelled) {
          setError(undefined);
        }
      } catch (refreshError) {
        if (!cancelled) {
          setError(
            refreshError instanceof Error
              ? refreshError.message
              : 'Failed to list templates',
          );
        }
      } finally {
        if (!cancelled) {
          setListing(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [refreshTemplates]);

  const ensureTemplates = async () => {
    setLoading(true);
    setError(undefined);

    try {
      const response = await fetch(
        `${REACT_APP_SERVER_BASE_URL}/workflow-form-whatsapp/workflow-form-templates/ensure`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
        },
      );
      const data = await parseJson(response);

      if (!response.ok) {
        throw new Error(
          typeof data.message === 'string' ? data.message : 'Ensure failed',
        );
      }

      setResults((data.results as EnsureResult[] | undefined) ?? []);
      await refreshTemplates();
    } catch (ensureError) {
      setError(
        ensureError instanceof Error ? ensureError.message : 'Ensure failed',
      );
    } finally {
      setLoading(false);
    }
  };

  const templateRows = useMemo<TemplateRow[]>(
    () =>
      templates.map((template, index) => ({
        id: template.name ?? String(index),
        name: template.name ?? t`unknown`,
        status: template.status ?? t`unknown`,
      })),
    [t, templates],
  );

  const resultRows = useMemo(
    () =>
      results.map((result, index) => ({
        id: result.name || String(index),
        name: result.name,
        status: result.templateStatus ?? result.status,
        error: result.error,
      })),
    [results],
  );

  return (
    <SettingsPageLayout
      title={t`Workflow Approvals`}
      links={[
        {
          children: t`User`,
          href: getSettingsPath(SettingsPath.ProfilePage),
        },
        {
          children: t`Accounts`,
          href: getSettingsPath(SettingsPath.Accounts),
        },
        { children: t`Workflow Approvals` },
      ]}
      actionButton={
        <Button
          title={loading ? t`Ensuring…` : t`Ensure templates`}
          variant="primary"
          accent="blue"
          onClick={() => {
            void ensureTemplates();
          }}
          disabled={loading}
        />
      }
    >
      <SettingsPageContainer>
        <Section>
          <H2Title
            title={t`WhatsApp form templates`}
            description={t`Create or refresh Meta WhatsApp templates used when a Form step notifies approvers on pending.`}
          />
          {error ? <StyledError>{error}</StyledError> : null}
        </Section>

        {resultRows.length > 0 ? (
          <SettingsTableListSection
            title={t`Last ensure run`}
            description={t`Status of the templates created or refreshed just now.`}
            items={resultRows}
            gridAutoColumns="minmax(0, 2fr) minmax(0, 1fr) minmax(0, 2fr)"
            columns={[
              {
                label: t`Template`,
                Cell: ({ item }) => <StyledName>{item.name}</StyledName>,
              },
              {
                label: t`Status`,
                Cell: ({ item }) => (
                  <Status
                    color={getStatusColor(item.status)}
                    text={item.status}
                    weight="medium"
                  />
                ),
              },
              {
                label: t`Details`,
                Cell: ({ item }) => (
                  <StyledName>{item.error ?? '—'}</StyledName>
                ),
              },
            ]}
          />
        ) : null}

        <SettingsTableListSection<TemplateRow>
          title={t`Current templates`}
          description={t`Approved templates can be sent to approvers from Form steps.`}
          items={templateRows}
          gridAutoColumns="minmax(0, 3fr) minmax(0, 1fr)"
          columns={[
            {
              label: t`Name`,
              Cell: ({ item }) => <StyledName>{item.name}</StyledName>,
            },
            {
              label: t`Status`,
              align: 'right',
              Cell: ({ item }) => (
                <Status
                  color={getStatusColor(item.status)}
                  text={item.status}
                  weight="medium"
                />
              ),
            },
          ]}
        />

        {!listing && templateRows.length === 0 && !error ? (
          <SettingsEmptyPlaceholder>
            {t`No templates yet. Use Ensure templates to create them in Meta.`}
          </SettingsEmptyPlaceholder>
        ) : null}
      </SettingsPageContainer>
    </SettingsPageLayout>
  );
};
