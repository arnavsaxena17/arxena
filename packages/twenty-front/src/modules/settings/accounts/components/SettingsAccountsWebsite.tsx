import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import {
  createWebsiteDomain,
  deleteWebsiteDomain,
  fetchWebsiteDomains,
  fetchWebsiteTrackerSnippet,
  fetchWebsiteVisitors,
  testWebsiteDomainConnection,
  type WebsiteDomainRecord,
  type WebsiteTrackerSnippet,
  type WebsiteVisitorRecord,
} from '@/settings/accounts/services/website-tracker-api.service';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { TextInput } from '@/ui/input/components/TextInput';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath, isDefined } from 'twenty-shared/utils';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { H2Title } from 'twenty-ui/typography';

const StyledPre = styled.pre`
  background: ${themeCssVariables.background.secondary};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  overflow-x: auto;
  padding: ${themeCssVariables.spacing[3]};
  white-space: pre-wrap;
  word-break: break-all;
`;

const StyledRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
  align-items: center;
  margin-bottom: ${themeCssVariables.spacing[3]};
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${themeCssVariables.font.size.sm};

  th,
  td {
    text-align: left;
    padding: ${themeCssVariables.spacing[2]};
    border-bottom: 1px solid ${themeCssVariables.border.color.light};
    vertical-align: top;
  }

  th {
    color: ${themeCssVariables.font.color.tertiary};
    font-weight: ${themeCssVariables.font.weight.medium};
  }
`;

const StyledError = styled.div`
  color: ${themeCssVariables.color.red};
  font-size: ${themeCssVariables.font.size.sm};
  margin-top: ${themeCssVariables.spacing[1]};
`;

const StyledMuted = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

export const SettingsAccountsWebsite = () => {
  const { t } = useLingui();
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const [snippet, setSnippet] = useState<WebsiteTrackerSnippet | null>(null);
  const [domains, setDomains] = useState<WebsiteDomainRecord[]>([]);
  const [visitors, setVisitors] = useState<WebsiteVisitorRecord[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingDomain, setIsSavingDomain] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [snippetResult, domainResults, visitorResults] = await Promise.all([
        fetchWebsiteTrackerSnippet(),
        fetchWebsiteDomains(),
        fetchWebsiteVisitors(),
      ]);
      setSnippet(snippetResult);
      setDomains(domainResults);
      setVisitors(visitorResults);
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : t`Failed to load website tracking settings`,
      });
    } finally {
      setIsLoading(false);
    }
  }, [enqueueErrorSnackBar, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCopySnippet = async () => {
    if (!snippet?.snippet) {
      return;
    }
    try {
      await navigator.clipboard.writeText(snippet.snippet);
      enqueueSuccessSnackBar({ message: t`Snippet copied to clipboard` });
    } catch {
      enqueueErrorSnackBar({ message: t`Failed to copy snippet` });
    }
  };

  const handleAddDomain = async () => {
    const trimmed = newDomain.trim();
    if (!trimmed) {
      return;
    }
    setIsSavingDomain(true);
    try {
      await createWebsiteDomain(trimmed);
      setNewDomain('');
      enqueueSuccessSnackBar({ message: t`Domain added` });
      await refresh();
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error ? error.message : t`Failed to add domain`,
      });
    } finally {
      setIsSavingDomain(false);
    }
  };

  const handleDeleteDomain = async (domainId: string) => {
    try {
      await deleteWebsiteDomain(domainId);
      enqueueSuccessSnackBar({ message: t`Domain removed` });
      await refresh();
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error ? error.message : t`Failed to delete domain`,
      });
    }
  };

  const handleTestConnection = async (domainId: string) => {
    try {
      const result = await testWebsiteDomainConnection(domainId);
      if (result.status === 'ACTIVE') {
        enqueueSuccessSnackBar({ message: t`Connection active` });
      } else {
        enqueueErrorSnackBar({
          message: result.lastError ?? t`Connection failed`,
        });
      }
      await refresh();
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error ? error.message : t`Failed to test connection`,
      });
    }
  };

  return (
    <SettingsPageLayout
      links={[
        {
          children: t`User`,
          href: getSettingsPath(SettingsPath.ProfilePage),
        },
        {
          children: t`Accounts`,
          href: getSettingsPath(SettingsPath.Accounts),
        },
        { children: t`Website` },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <H2Title
            title={t`Tracking script`}
            description={t`Install this script on your website to identify visiting companies. One script works for all registered domains.`}
          />
          {isLoading && !isDefined(snippet) ? (
            <StyledMuted>{t`Loading…`}</StyledMuted>
          ) : (
            <>
              <StyledPre>{snippet?.snippet ?? ''}</StyledPre>
              <StyledRow>
                <Button
                  title={t`Copy code`}
                  size="small"
                  variant="secondary"
                  onClick={handleCopySnippet}
                />
                {isDefined(snippet?.appId) && (
                  <StyledMuted>
                    {t`App ID`}: {snippet.appId}
                  </StyledMuted>
                )}
              </StyledRow>
            </>
          )}
        </Section>

        <Section>
          <H2Title
            title={t`Website domains`}
            description={t`Register domains that may send tracking events (up to 3).`}
          />
          <StyledMuted>
            {domains.length} / 3 {t`domains used`}
          </StyledMuted>
          <StyledRow>
            <TextInput
              value={newDomain}
              onChange={setNewDomain}
              placeholder="https://example.com"
            />
            <Button
              title={t`Add domain`}
              size="small"
              variant="primary"
              accent="blue"
              onClick={handleAddDomain}
              disabled={isSavingDomain || !newDomain.trim()}
            />
          </StyledRow>
          <StyledTable>
            <thead>
              <tr>
                <th>{t`Domain`}</th>
                <th>{t`Status`}</th>
                <th>{t`Tracking`}</th>
                <th>{t`Actions`}</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((domain) => (
                <tr key={domain.id}>
                  <td>
                    <div>{domain.domain ?? domain.name}</div>
                    {isDefined(domain.lastError) && domain.lastError !== '' && (
                      <StyledError>{domain.lastError}</StyledError>
                    )}
                  </td>
                  <td>{domain.status ?? 'PENDING'}</td>
                  <td>{domain.trackingLevel ?? 'COMPANY'}</td>
                  <td>
                    <StyledRow>
                      <Button
                        title={t`Test connection`}
                        size="small"
                        variant="secondary"
                        onClick={() => handleTestConnection(domain.id)}
                      />
                      <Button
                        title={t`Delete`}
                        size="small"
                        variant="secondary"
                        accent="danger"
                        onClick={() => handleDeleteDomain(domain.id)}
                      />
                    </StyledRow>
                  </td>
                </tr>
              ))}
              {domains.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <StyledMuted>
                      {t`No domains yet. Add your marketing site to start tracking.`}
                    </StyledMuted>
                  </td>
                </tr>
              )}
            </tbody>
          </StyledTable>
        </Section>

        <Section>
          <H2Title
            title={t`Website visitors`}
            description={t`Company-level visits identified from your tracking script.`}
          />
          <StyledTable>
            <thead>
              <tr>
                <th>{t`Company`}</th>
                <th>{t`Location`}</th>
                <th>{t`Last page`}</th>
                <th>{t`Confidence`}</th>
                <th>{t`Visits`}</th>
                <th>{t`Last seen`}</th>
              </tr>
            </thead>
            <tbody>
              {visitors.map((visitor) => (
                <tr key={visitor.id}>
                  <td>
                    {visitor.companyName ??
                      visitor.companyDomain ??
                      visitor.name ??
                      t`Unknown visitor`}
                    {isDefined(visitor.companyDomain) && (
                      <StyledMuted>{visitor.companyDomain}</StyledMuted>
                    )}
                  </td>
                  <td>
                    {[visitor.city, visitor.country]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </td>
                  <td>{visitor.pagePath ?? '—'}</td>
                  <td>{visitor.confidence ?? '—'}</td>
                  <td>{visitor.visitCount ?? 0}</td>
                  <td>
                    {visitor.lastSeenAt
                      ? new Date(visitor.lastSeenAt).toLocaleString()
                      : '—'}
                  </td>
                </tr>
              ))}
              {visitors.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <StyledMuted>
                      {t`No visitors yet. Install the script and open a page on a registered domain.`}
                    </StyledMuted>
                  </td>
                </tr>
              )}
            </tbody>
          </StyledTable>
        </Section>
      </SettingsPageContainer>
    </SettingsPageLayout>
  );
};
