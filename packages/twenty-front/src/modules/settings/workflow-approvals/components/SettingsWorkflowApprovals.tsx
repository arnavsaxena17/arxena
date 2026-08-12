import { useEffect, useState } from 'react';

import { getTokenPair } from '@/apollo/utils/getTokenPair';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { useLingui } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { Button } from 'twenty-ui/input';

type EnsureResult = {
  name: string;
  status: string;
  templateStatus?: string;
  error?: string;
};

export const SettingsWorkflowApprovals = () => {
  const { t } = useLingui();
  const [results, setResults] = useState<EnsureResult[]>([]);
  const [templates, setTemplates] = useState<
    Array<{ name?: string; status?: string }>
  >([]);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const getAuthHeaders = (): HeadersInit => {
    const tokenPair = getTokenPair();
    const accessToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

    return {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    };
  };

  const refreshTemplates = async () => {
    try {
      const response = await fetch('/workflow-form-whatsapp/message-templates', {
        headers: getAuthHeaders(),
      });
      const data = await response.json();

      setTemplates(data.templates ?? []);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Failed to list templates',
      );
    }
  };

  useEffect(() => {
    void refreshTemplates();
  }, []);

  const ensureTemplates = async () => {
    setLoading(true);
    setError(undefined);

    try {
      const response = await fetch(
        '/workflow-form-whatsapp/workflow-form-templates/ensure',
        {
          method: 'POST',
          headers: getAuthHeaders(),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? 'Ensure failed');
      }

      setResults(data.results ?? []);
      await refreshTemplates();
    } catch (ensureError) {
      setError(
        ensureError instanceof Error ? ensureError.message : 'Ensure failed',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SettingsPageContainer>
      <SettingsPageLayout
        title={t`Workflow Approvals`}
        links={[
          {
            children: t`Accounts`,
            href: getSettingsPath(SettingsPath.Accounts),
          },
          { children: t`Workflow Approvals` },
        ]}
      >
        <p>
          {t`Create or refresh Meta WhatsApp templates used when a Form step notifies approvers on pending.`}
        </p>
        <Button
          title={loading ? t`Ensuring…` : t`Ensure WhatsApp form templates`}
          onClick={() => {
            void ensureTemplates();
          }}
          disabled={loading}
        />
        {error ? <p>{error}</p> : null}
        {results.length > 0 ? (
          <ul>
            {results.map((result) => (
              <li key={result.name}>
                {result.name}: {result.status}
                {result.templateStatus ? ` (${result.templateStatus})` : ''}
                {result.error ? ` — ${result.error}` : ''}
              </li>
            ))}
          </ul>
        ) : null}
        {templates.length > 0 ? (
          <>
            <h3>{t`Current templates`}</h3>
            <ul>
              {templates.map((template) => (
                <li key={template.name ?? JSON.stringify(template)}>
                  {template.name ?? 'unknown'} — {template.status ?? 'unknown'}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </SettingsPageLayout>
    </SettingsPageContainer>
  );
};
