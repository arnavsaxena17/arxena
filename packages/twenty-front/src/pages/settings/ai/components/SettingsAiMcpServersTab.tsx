import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { TextArea } from '@/ui/input/components/TextArea';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useMutation, useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useEffect, useState } from 'react';
import { IconDeviceFloppy, IconRefresh, IconTrash } from 'twenty-ui/icon';
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
import {
  MCP_SERVERS_CONFIG_PLACEHOLDER,
  parseMcpServersConfig,
} from '~/pages/settings/ai/utils/parseMcpServersConfig';

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

const StyledCodeArea = styled.div`
  font-family: ${themeCssVariables.code.font.family};
  width: 100%;

  textarea {
    font-family: ${themeCssVariables.code.font.family};
    font-size: ${themeCssVariables.font.size.sm};
    line-height: 1.5;
    min-height: 280px;
  }
`;

const buildConfigFromServers = (servers: WorkspaceMcpServer[]): string => {
  if (servers.length === 0) {
    return MCP_SERVERS_CONFIG_PLACEHOLDER;
  }

  const mcpServers: Record<string, { url: string; headers?: Record<string, string> }> =
    {};

  for (const server of servers) {
    const entry: { url: string; headers?: Record<string, string> } = {
      url: server.url,
    };

    if (server.hasAuthToken) {
      entry.headers = {
        [server.authHeaderName || 'Authorization']:
          '<configured — paste to rotate>',
      };
    }

    mcpServers[server.label] = entry;
  }

  return JSON.stringify({ mcpServers }, null, 2);
};

export const SettingsAiMcpServersTab = () => {
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  // MCP federation resolvers live on core (/graphql), not /metadata
  const apolloCoreClient = useApolloCoreClient();
  const { data, loading, refetch } = useQuery<{
    workspaceMcpServers: WorkspaceMcpServer[];
  }>(WORKSPACE_MCP_SERVERS, { client: apolloCoreClient });

  const [createServer] = useMutation(CREATE_WORKSPACE_MCP_SERVER, {
    client: apolloCoreClient,
  });
  const [updateServer] = useMutation(UPDATE_WORKSPACE_MCP_SERVER, {
    client: apolloCoreClient,
  });
  const [deleteServer] = useMutation(DELETE_WORKSPACE_MCP_SERVER, {
    client: apolloCoreClient,
  });
  const [syncServer] = useMutation(SYNC_WORKSPACE_MCP_SERVER_TOOLS, {
    client: apolloCoreClient,
  });

  const servers = data?.workspaceMcpServers ?? [];
  const [configText, setConfigText] = useState(MCP_SERVERS_CONFIG_PLACEHOLDER);
  const [isSaving, setIsSaving] = useState(false);
  const [hasHydratedConfig, setHasHydratedConfig] = useState(false);

  useEffect(() => {
    if (loading || hasHydratedConfig) {
      return;
    }

    setConfigText(buildConfigFromServers(servers));
    setHasHydratedConfig(true);
  }, [loading, servers, hasHydratedConfig]);

  const handleSaveConfig = async () => {
    const { servers: parsedServers, errors } =
      parseMcpServersConfig(configText);

    if (errors.length > 0) {
      enqueueErrorSnackBar({ message: errors[0] });
      return;
    }

    if (parsedServers.length === 0) {
      enqueueErrorSnackBar({ message: t`No MCP servers found in config` });
      return;
    }

    setIsSaving(true);

    try {
      let createdCount = 0;
      let updatedCount = 0;

      for (const parsedServer of parsedServers) {
        const existing = servers.find(
          (server) => server.slug === parsedServer.slug,
        );
        const isPlaceholderToken =
          parsedServer.authToken?.includes('<configured') === true;

        if (existing) {
          await updateServer({
            variables: {
              input: {
                id: existing.id,
                label: parsedServer.label,
                url: parsedServer.url,
                authHeaderName: parsedServer.authHeaderName,
                authToken: isPlaceholderToken
                  ? undefined
                  : parsedServer.authToken,
                enabled: true,
              },
            },
          });
          updatedCount += 1;
        } else {
          await createServer({
            variables: {
              input: {
                label: parsedServer.label,
                slug: parsedServer.slug,
                url: parsedServer.url,
                authHeaderName: parsedServer.authHeaderName,
                authToken: isPlaceholderToken
                  ? undefined
                  : parsedServer.authToken,
                enabled: true,
              },
            },
          });
          createdCount += 1;
        }
      }

      enqueueSuccessSnackBar({
        message: t`Saved MCP servers (${createdCount} added, ${updatedCount} updated)`,
      });
      setHasHydratedConfig(false);
      await refetch();
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : t`Failed to save MCP servers`,
      });
    } finally {
      setIsSaving(false);
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
    setHasHydratedConfig(false);
    await refetch();
  };

  return (
    <Section>
      <H2Title
        title={t`MCP servers`}
        description={t`Paste a Cursor-style mcp.json. Remote HTTP and mcp-remote servers sync into Ask AI as slug__tool via learn_tools / execute_tool.`}
      />

      <StyledForm>
        <H2Title
          title={t`mcp.json`}
          description={t`Use url + headers, or command/args with mcp-remote. Save creates or updates by server name.`}
        />
        <StyledCodeArea>
          <TextArea
            textAreaId="workspace-mcp-servers-config"
            value={configText}
            onChange={setConfigText}
            minRows={14}
            maxRows={40}
            placeholder={MCP_SERVERS_CONFIG_PLACEHOLDER}
          />
        </StyledCodeArea>
        <Button
          Icon={IconDeviceFloppy}
          title={t`Save MCP servers`}
          accent="blue"
          disabled={isSaving || configText.trim() === ''}
          onClick={() => {
            void handleSaveConfig();
          }}
        />
      </StyledForm>

      <StyledList>
        {loading && <StyledMeta>{t`Loading…`}</StyledMeta>}
        {!loading && servers.length === 0 && (
          <StyledMeta>{t`No MCP servers configured yet`}</StyledMeta>
        )}
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
    </Section>
  );
};
