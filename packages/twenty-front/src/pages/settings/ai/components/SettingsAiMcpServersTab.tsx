import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TextArea } from '@/ui/input/components/TextArea';
import { useMutation, useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { H2Title } from 'twenty-ui/typography';

import {
  SettingsAiMcpServerCard,
  type WorkspaceMcpServer,
} from '~/pages/settings/ai/components/SettingsAiMcpServerCard';
import {
  CREATE_WORKSPACE_MCP_SERVER,
  DELETE_WORKSPACE_MCP_SERVER,
  SYNC_WORKSPACE_MCP_SERVER_TOOLS,
  UPDATE_WORKSPACE_MCP_SERVER,
  WORKSPACE_MCP_SERVERS,
} from '~/pages/settings/ai/graphql/workspaceMcpServers';
import { formatMcpServersConfig } from '~/pages/settings/ai/utils/formatMcpServersConfig';
import {
  MCP_SERVERS_CONFIG_PLACEHOLDER,
  parseMcpServersConfig,
} from '~/pages/settings/ai/utils/parseMcpServersConfig';

type SaveState = 'idle' | 'saving' | 'saved';

const StyledList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  margin-top: ${themeCssVariables.spacing[4]};
`;

const StyledForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[4]};
`;

const StyledErrorList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledError = styled.span`
  color: ${themeCssVariables.color.red};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledMeta = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledCodeArea = styled.div<{ hasError: boolean }>`
  font-family: ${themeCssVariables.code.font.family};
  width: 100%;

  textarea {
    font-family: ${themeCssVariables.code.font.family};
    font-size: ${themeCssVariables.font.size.sm};
    line-height: 1.5;
    min-height: 280px;
  }

  > * {
    border-color: ${({ hasError }) =>
      hasError ? themeCssVariables.color.red : 'inherit'};
  }
`;

const buildConfigFromServers = (servers: WorkspaceMcpServer[]): string => {
  if (servers.length === 0) {
    return MCP_SERVERS_CONFIG_PLACEHOLDER;
  }

  const mcpServers: Record<
    string,
    { url: string; headers?: Record<string, string> }
  > = {};

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
  const [editedConfigText, setEditedConfigText] = useState<string | null>(null);
  const [lastSavedConfigText, setLastSavedConfigText] = useState<
    string | null
  >(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  // Until the user edits, the editor mirrors what is stored on the server
  const serversConfigText = buildConfigFromServers(servers);
  const configText = editedConfigText ?? serversConfigText;

  const saveConfig = async (rawText: string) => {
    const formatResult = formatMcpServersConfig(rawText);

    if (!formatResult.isValid) {
      setValidationErrors([formatResult.errorMessage]);
      return;
    }

    setEditedConfigText(formatResult.formattedText);

    const { servers: parsedServers, errors } = parseMcpServersConfig(
      formatResult.formattedText,
    );

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    if (parsedServers.length === 0) {
      setValidationErrors([t`No MCP servers found in config`]);
      return;
    }

    setValidationErrors([]);
    setSaveState('saving');

    try {
      let createdCount = 0;
      let updatedCount = 0;

      for (const parsedServer of parsedServers) {
        const existing = servers.find(
          (server) => server.slug === parsedServer.slug,
        );
        const authToken = parsedServer.authToken?.includes('<configured')
          ? undefined
          : parsedServer.authToken;

        if (existing) {
          await updateServer({
            variables: {
              input: {
                id: existing.id,
                label: parsedServer.label,
                url: parsedServer.url,
                authHeaderName: parsedServer.authHeaderName,
                authToken,
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
                authToken,
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
      // Drop the local edit so the editor shows the stored (token-masked) config
      setEditedConfigText(null);
      setLastSavedConfigText(null);
      setSaveState('saved');
      await refetch();
    } catch (error) {
      setSaveState('idle');
      setValidationErrors([
        error instanceof Error ? error.message : t`Failed to save MCP servers`,
      ]);
    }
  };

  const handleBlur = () => {
    const baselineText = lastSavedConfigText ?? serversConfigText;

    if (
      editedConfigText === null ||
      editedConfigText.trim() === '' ||
      editedConfigText === MCP_SERVERS_CONFIG_PLACEHOLDER ||
      editedConfigText === baselineText
    ) {
      return;
    }

    void saveConfig(editedConfigText);
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
    setEditedConfigText(null);
    await refetch();
  };

  const statusText =
    saveState === 'saving'
      ? t`Saving…`
      : editedConfigText !== null
        ? t`Changes save automatically when you click outside the editor`
        : saveState === 'saved'
          ? t`Saved`
          : '';

  return (
    <Section>
      <H2Title
        title={t`MCP servers`}
        description={t`Paste a Cursor-style mcp.json. Remote HTTP servers sync into Ask AI as slug__tool via learn_tools / execute_tool.`}
      />

      <StyledForm>
        <StyledCodeArea hasError={validationErrors.length > 0}>
          <TextArea
            textAreaId="workspace-mcp-servers-config"
            value={configText}
            onChange={(value) => {
              setEditedConfigText(value);
              setSaveState('idle');
            }}
            onBlur={handleBlur}
            minRows={14}
            maxRows={40}
            placeholder={MCP_SERVERS_CONFIG_PLACEHOLDER}
          />
        </StyledCodeArea>
        {validationErrors.length > 0 ? (
          <StyledErrorList>
            {validationErrors.map((validationError) => (
              <StyledError key={validationError}>{validationError}</StyledError>
            ))}
          </StyledErrorList>
        ) : (
          <StyledMeta>{statusText}</StyledMeta>
        )}
      </StyledForm>

      <StyledList>
        {loading && <StyledMeta>{t`Loading…`}</StyledMeta>}
        {!loading && servers.length === 0 && (
          <StyledMeta>{t`No MCP servers configured yet`}</StyledMeta>
        )}
        {servers.map((server) => (
          <SettingsAiMcpServerCard
            key={server.id}
            server={server}
            onToggle={(enabled) => {
              void handleToggle(server, enabled);
            }}
            onSync={() => {
              void handleSync(server.id);
            }}
            onDelete={() => {
              void handleDelete(server.id);
            }}
          />
        ))}
      </StyledList>
    </Section>
  );
};
