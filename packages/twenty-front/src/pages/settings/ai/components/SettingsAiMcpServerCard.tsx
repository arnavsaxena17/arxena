import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { IconRefresh, IconTrash } from 'twenty-ui/icon';
import { Button, Toggle } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

export type WorkspaceMcpServer = {
  id: string;
  label: string;
  slug: string;
  url: string;
  authHeaderName?: string | null;
  enabled: boolean;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
  hasAuthToken: boolean;
  toolCount: number;
};

type SettingsAiMcpServerCardProps = {
  server: WorkspaceMcpServer;
  onToggle: (enabled: boolean) => void;
  onSync: () => void;
  onDelete: () => void;
};

type ServerStatus = 'connected' | 'error' | 'disabled' | 'pending';

const STATUS_COLOR_BY_STATUS: Record<ServerStatus, string> = {
  connected: themeCssVariables.color.green,
  error: themeCssVariables.color.red,
  disabled: themeCssVariables.font.color.tertiary,
  pending: themeCssVariables.color.orange,
};

const StyledCard = styled.div`
  background: ${themeCssVariables.background.secondary};
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

const StyledTitleGroup = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  min-width: 0;
`;

const StyledStatusDot = styled.span<{ statusColor: string }>`
  background: ${({ statusColor }) => statusColor};
  border-radius: 50%;
  flex-shrink: 0;
  height: 8px;
  width: 8px;
`;

const StyledLabel = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledMeta = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledUrl = styled(StyledMeta)`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledError = styled.span`
  color: ${themeCssVariables.color.red};
  font-size: ${themeCssVariables.font.size.sm};
  word-break: break-word;
`;

const StyledActions = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const getServerStatus = (server: WorkspaceMcpServer): ServerStatus => {
  if (!server.enabled) {
    return 'disabled';
  }

  if (server.lastSyncError) {
    return 'error';
  }

  return server.lastSyncAt ? 'connected' : 'pending';
};

// Tokens can ride in the query string (e.g. Bright Data hosted MCP), so only
// show origin + path in the card.
const getDisplayUrl = (url: string): string => {
  try {
    const parsedUrl = new URL(url);

    return `${parsedUrl.origin}${parsedUrl.pathname}`;
  } catch {
    return url;
  }
};

export const SettingsAiMcpServerCard = ({
  server,
  onToggle,
  onSync,
  onDelete,
}: SettingsAiMcpServerCardProps) => {
  const status = getServerStatus(server);

  return (
    <StyledCard>
      <StyledRow>
        <StyledTitleGroup>
          <StyledStatusDot statusColor={STATUS_COLOR_BY_STATUS[status]} />
          <StyledLabel>{server.label}</StyledLabel>
          <StyledMeta>
            {status === 'error'
              ? t`Sync failed`
              : status === 'pending'
                ? t`Not synced yet`
                : t`${server.toolCount} tools enabled`}
          </StyledMeta>
        </StyledTitleGroup>
        <Toggle value={server.enabled} onChange={onToggle} />
      </StyledRow>
      <StyledUrl>{getDisplayUrl(server.url)}</StyledUrl>
      {server.lastSyncError ? (
        <StyledError>{server.lastSyncError}</StyledError>
      ) : (
        <StyledMeta>
          {server.lastSyncAt
            ? t`Last sync: ${new Date(server.lastSyncAt).toLocaleString()}`
            : ''}
          {server.hasAuthToken ? t` · Auth configured` : ''}
        </StyledMeta>
      )}
      <StyledActions>
        <Button
          Icon={IconRefresh}
          title={t`Sync tools`}
          size="small"
          onClick={onSync}
        />
        <Button
          Icon={IconTrash}
          title={t`Delete`}
          size="small"
          variant="secondary"
          accent="danger"
          onClick={onDelete}
        />
      </StyledActions>
    </StyledCard>
  );
};
