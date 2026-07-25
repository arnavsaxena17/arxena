import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useMutation, useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { IconPlus, IconRefresh, IconTrash } from 'twenty-ui/icon';
import { Button, Toggle } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { H2Title } from 'twenty-ui/typography';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import {
  CREATE_WORKSPACE_MCP_SERVER,
  DELETE_WORKSPACE_MCP_SERVER,
  SYNC_WORKSPACE_MCP_SERVER_TOOLS,
  UPDATE_WORKSPACE_MCP_SERVER,
  WORKSPACE_MCP_SERVERS,
} from '~/pages/settings/ai/graphql/workspaceMcpServers';

type WorkspaceMcpServer = {
  id: string;
  label: string;
  slug: string;
  url: string;
  authHeaderName?: string | null;
  enabled: boolean;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
  hasAuthToken: boolean;
};

const StyledList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledCard = styled.div`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
`;

const StyledForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[4]};
`;

const StyledError = styled.span`
  color: ${themeCssVariables.color.red};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledMeta = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

export const SettingsAiMcpServersTab = () => {
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const { data, loading, refetch } = useQuery<{
    workspaceMcpServers: WorkspaceMcpServer[];
  }>(WORKSPACE_MCP_SERVERS);

  const [createServer, { loading: creating }] = useMutation(
    CREATE_WORKSPACE_MCP_SERVER,
  );
  const [updateServer] = useMutation(UPDATE_WORKSPACE_MCP_SERVER);
  const [deleteServer] = useMutation(DELETE_WORKSPACE_MCP_SERVER);
  const [syncServer] = useMutation(SYNC_WORKSPACE_MCP_SERVER_TOOLS);

  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [authHeaderName, setAuthHeaderName] = useState('Authorization');

  const servers = data?.workspaceMcpServers ?? [];

  const handleCreate = async () => {
    try {
      await createServer({
        variables: {
          input: {
            label,
            url,
            authToken: authToken || undefined,
            authHeaderName: authHeaderName || undefined,
            enabled: true,
          },
        },
      });
      setLabel('');
      setUrl('');
      setAuthToken('');
      enqueueSuccessSnackBar({ message: t`MCP server added and synced` });
      await refetch();
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error ? error.message : t`Failed to add MCP server`,
      });
    }
  };

  const handleToggle = async (server: WorkspaceMcpServer, enabled: boolean) => {
    await updateServer({
      variables: { input: { id: server.id, enabled } },
    });
    await refetch();
  };

  const handleSync = async (id: string) => {
    try {
      await syncServer({ variables: { id } });
      enqueueSuccessSnackBar({ message: t`Tools synced` });
      await refetch();
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error ? error.message : t`Failed to sync tools`,
      });
    }
  };

  const handleDelete = async (id: string) => {
    await deleteServer({ variables: { id } });
    enqueueSuccessSnackBar({ message: t`MCP server removed` });
    await refetch();
  };

  return (
    <Section>
      <H2Title
        title={t`MCP servers`}
        description={t`Connect remote MCP servers. Their tools appear in Ask AI via learn_tools / execute_tool (namespaced as slug__tool).`}
      />
      <StyledList>
        {loading && <StyledMeta>{t`Loading…`}</StyledMeta>}
        {servers.map((server) => (
          <StyledCard key={server.id}>
            <StyledRow>
              <div>
                <strong>{server.label}</strong> ({server.slug})
                <div>
                  <StyledMeta>{server.url}</StyledMeta>
                </div>
              </div>
              <Toggle
                value={server.enabled}
                onChange={(enabled) => {
                  void handleToggle(server, enabled);
                }}
              />
            </StyledRow>
            <StyledMeta>
              {server.lastSyncAt
                ? t`Last sync: ${new Date(server.lastSyncAt).toLocaleString()}`
                : t`Not synced yet`}
              {server.hasAuthToken ? t` · Auth configured` : ''}
            </StyledMeta>
            {server.lastSyncError ? (
              <StyledError>{server.lastSyncError}</StyledError>
            ) : null}
            <StyledRow>
              <Button
                Icon={IconRefresh}
                title={t`Sync tools`}
                size="small"
                onClick={() => {
                  void handleSync(server.id);
                }}
              />
              <Button
                Icon={IconTrash}
                title={t`Delete`}
                size="small"
                variant="secondary"
                accent="danger"
                onClick={() => {
                  void handleDelete(server.id);
                }}
              />
            </StyledRow>
          </StyledCard>
        ))}
      </StyledList>

      <StyledForm>
        <H2Title title={t`Add MCP server`} description={t`HTTP Streamable MCP URL`} />
        <SettingsTextInput
          instanceId="mcp-server-label"
          value={label}
          onChange={setLabel}
          placeholder={t`Label (e.g. Apollo)`}
          fullWidth
        />
        <SettingsTextInput
          instanceId="mcp-server-url"
          value={url}
          onChange={setUrl}
          placeholder="https://mcp.example.com/mcp"
          fullWidth
        />
        <SettingsTextInput
          instanceId="mcp-server-auth-header"
          value={authHeaderName}
          onChange={setAuthHeaderName}
          placeholder="Authorization"
          fullWidth
        />
        <SettingsTextInput
          instanceId="mcp-server-auth-token"
          value={authToken}
          onChange={setAuthToken}
          type="password"
          placeholder={t`API token (optional)`}
          fullWidth
        />
        <Button
          Icon={IconPlus}
          title={t`Add server`}
          accent="blue"
          disabled={!label || !url || creating}
          onClick={() => {
            void handleCreate();
          }}
        />
      </StyledForm>
    </Section>
  );
};
