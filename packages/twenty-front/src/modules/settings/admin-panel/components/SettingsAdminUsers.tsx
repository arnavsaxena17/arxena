import { useApolloAdminClient } from '@/settings/admin-panel/apollo/hooks/useApolloAdminClient';
import { ADMIN_CONNECT_MEMBER_LINKEDIN_UNIPILE } from '@/settings/admin-panel/graphql/mutations/adminConnectMemberLinkedinUnipile';
import { ADMIN_VALIDATE_MEMBER_LINKEDIN_STORED_COOKIES } from '@/settings/admin-panel/graphql/mutations/adminValidateMemberLinkedinStoredCookies';
import { GET_ADMIN_PANEL_ALL_WORKSPACE_MEMBERS } from '@/settings/admin-panel/graphql/queries/getAdminPanelAllWorkspaceMembers';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TextInput } from '@/ui/input/components/TextInput';
import { Table } from '@/ui/layout/table/components/Table';
import { TableCell } from '@/ui/layout/table/components/TableCell';
import { TableHeader } from '@/ui/layout/table/components/TableHeader';
import { TableRow } from '@/ui/layout/table/components/TableRow';
import { useMutation, useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useContext, useMemo, useState } from 'react';
import { IconCopy } from 'twenty-ui/icon';
import { Button, LightIconButton } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { ThemeContext, themeCssVariables } from 'twenty-ui/theme-constants';
import { H2Title } from 'twenty-ui/typography';

type RecruiterProfileRow = {
  workspaceMemberId?: string | null;
  profileId?: string | null;
  phoneNumber?: string | null;
  linkedinUrl?: string | null;
  linkedinUnipileAccountId?: string | null;
  whatsappUnipileAccountId?: string | null;
  keepLinkedinConnected?: boolean | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  jobTitle?: string | null;
  companyName?: string | null;
  companyDescription?: string | null;
  typeWorkspaceMember?: string | null;
  chromeExtensionId?: string | null;
  extensionInstalled?: boolean | null;
  linkedinCookiesStored?: boolean | null;
  linkedinLiAStored?: boolean | null;
  linkedinCookiesLastSyncedAt?: string | null;
  linkedinCookiesValidatedAt?: string | null;
  linkedinIp?: string | null;
  linkedinCountry?: string | null;
  linkedinUserAgentStored?: boolean | null;
};

export type AdminPanelWorkspaceMemberTableRow = {
  workspaceId: string;
  workspaceName: string;
  workspaceSubdomain: string;
  workspaceCreatedAt: string;
  userId: string;
  userEmail: string;
  userFirstName?: string | null;
  userLastName?: string | null;
  userCreatedAt: string;
  membershipCreatedAt: string;
  recruiterProfile?: RecruiterProfileRow | null;
};

type AdminPanelAllWorkspaceMembersData = {
  adminPanelAllWorkspaceMembers: AdminPanelWorkspaceMemberTableRow[];
};

type ValidateLinkedinCookiesResult = {
  adminValidateMemberLinkedinStoredCookies: {
    attempted: boolean;
    connected: boolean;
    disconnectedAfterValidation: boolean;
    keepConnected: boolean;
    hasLiAt: boolean;
    hasLiA: boolean;
    lastSyncedAt?: string | null;
    lastValidatedAt?: string | null;
    message?: string | null;
    errorCode?: string | null;
    reconnectAttempted: boolean;
    reconnectSucceeded: boolean;
    accountId?: string | null;
    accountStatus?: string | null;
  };
};

type ConnectLinkedinUnipileResult = {
  adminConnectMemberLinkedinUnipile: {
    attempted: boolean;
    connected: boolean;
    keepConnected: boolean;
    hasLiAt: boolean;
    hasLiA: boolean;
    lastSyncedAt?: string | null;
    lastValidatedAt?: string | null;
    message?: string | null;
    errorCode?: string | null;
    reconnectAttempted: boolean;
    reconnectSucceeded: boolean;
    accountId?: string | null;
    accountStatus?: string | null;
  };
};

const StyledTableScroll = styled.div`
  margin-top: ${themeCssVariables.spacing[3]};
  overflow-x: auto;
  width: 100%;
`;

const StyledTable = styled(Table)`
  min-width: 2860px;
  width: max-content;
`;

const StyledTableRow = styled(TableRow)`
  width: max-content;
`;

const StyledTableHeader = styled(TableHeader)`
  box-sizing: border-box;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledTableCell = styled(TableCell)`
  align-items: flex-start;
  box-sizing: border-box;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[0.5]};
  height: auto;
  justify-content: center;
  max-width: 100%;
  min-height: ${themeCssVariables.spacing[10]};
  min-width: 0;
  overflow: hidden;
  padding-bottom: ${themeCssVariables.spacing[2]};
  padding-top: ${themeCssVariables.spacing[2]};
`;

const StyledCellPrimary = styled.span`
  color: ${themeCssVariables.font.color.primary};
  display: block;
  font-size: ${themeCssVariables.font.size.sm};
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
`;

const StyledCellSecondary = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  display: block;
  font-size: ${themeCssVariables.font.size.xs};
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
`;

const StyledCopyRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[0.5]};
  max-width: 100%;
  min-width: 0;
  width: 100%;
`;

const StyledCopyTextButton = styled.button<{ $muted?: boolean }>`
  background: none;
  border: none;
  color: ${({ $muted }) =>
    $muted ? themeCssVariables.font.color.tertiary : themeCssVariables.font.color.primary};
  cursor: pointer;
  flex: 1 1 auto;
  font-family: inherit;
  font-size: ${({ $muted }) =>
    $muted ? themeCssVariables.font.size.xs : themeCssVariables.font.size.sm};
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  padding: 0;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    color: ${themeCssVariables.font.color.secondary};
    text-decoration: underline;
  }
`;

const StyledMuted = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledToolbar = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[3]};
  max-width: 560px;
  width: 100%;
`;

const StyledFilterInputWrap = styled.div`
  flex: 1 1 280px;
  min-width: 0;
`;

const StyledMatchCount = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  white-space: nowrap;
`;

const StyledActionCell = styled(StyledTableCell)`
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledCellStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[0.5]};
  max-width: 100%;
  min-width: 0;
  width: 100%;
`;

/** Fixed track sizes so columns never compress into each other; scroll horizontally instead. */
const TABLE_GRID = [
  '160px', // Workspace
  '110px', // Subdomain
  '130px', // Workspace created
  '200px', // User email
  '140px', // Name
  '130px', // User created
  '130px', // Member since
  '200px', // Profile
  '120px', // Phone
  '160px', // LinkedIn
  '160px', // Job / company
  '180px', // Type / Unipile
  '120px', // Extension
  '100px', // Cookies
  '130px', // Last synced
  '130px', // Last validated
  '100px', // Test cookies
  '140px', // Connect Unipile
].join(' ');

const formatDt = (iso: string | null | undefined) => {
  if (!iso?.trim()) {
    return '—';
  }

  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDate = (iso: string | null | undefined) => {
  if (!iso?.trim()) {
    return '—';
  }

  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const dash = (value: string | null | undefined) =>
  value && String(value).trim().length > 0 ? String(value) : '—';

const yesNo = (value: boolean | null | undefined) => {
  if (value === true) {
    return 'Yes';
  }
  if (value === false) {
    return 'No';
  }

  return '—';
};

const shortId = (id: string | null | undefined) => {
  if (!id?.trim()) {
    return '—';
  }

  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
};

type CopyHandler = (value: string, label: string) => void;

type CopyableLineProps = {
  value: string | null | undefined;
  label: string;
  display?: string;
  muted?: boolean;
  onCopy: CopyHandler;
};

const CopyableLine = ({
  value,
  label,
  display,
  muted = false,
  onCopy,
}: CopyableLineProps) => {
  const trimmed = value?.trim() ?? '';

  if (!trimmed) {
    return muted ? (
      <StyledCellSecondary>—</StyledCellSecondary>
    ) : (
      <StyledCellPrimary>—</StyledCellPrimary>
    );
  }

  const shown = display ?? trimmed;

  return (
    <StyledCopyRow>
      <StyledCopyTextButton
        type="button"
        $muted={muted}
        title={`${label}: ${trimmed} (click to copy)`}
        onClick={() => onCopy(trimmed, label)}
      >
        {shown}
      </StyledCopyTextButton>
      <LightIconButton
        Icon={IconCopy}
        size="small"
        accent="tertiary"
        title={`Copy ${label}`}
        aria-label={`Copy ${label}`}
        onClick={(event) => {
          event.stopPropagation();
          onCopy(trimmed, label);
        }}
      />
    </StyledCopyRow>
  );
};

type PlainLineProps = {
  primary: string;
  secondary?: string | null;
  title?: string;
};

const PlainLine = ({ primary, secondary, title }: PlainLineProps) => (
  <StyledCellStack>
    <StyledCellPrimary title={title ?? primary}>{primary}</StyledCellPrimary>
    {secondary ? (
      <StyledCellSecondary title={secondary}>{secondary}</StyledCellSecondary>
    ) : null}
  </StyledCellStack>
);

const rowMatchesFilter = (
  row: AdminPanelWorkspaceMemberTableRow,
  normalizedFilter: string,
) => {
  const rp = row.recruiterProfile;
  const haystack = [
    row.workspaceId,
    row.workspaceName,
    row.workspaceSubdomain,
    row.userId,
    row.userEmail,
    row.userFirstName,
    row.userLastName,
    rp?.workspaceMemberId,
    rp?.profileId,
    rp?.phoneNumber,
    rp?.linkedinUrl,
    rp?.linkedinUnipileAccountId,
    rp?.whatsappUnipileAccountId,
    rp?.email,
    rp?.firstName,
    rp?.lastName,
    rp?.name,
    rp?.jobTitle,
    rp?.companyName,
    rp?.typeWorkspaceMember,
    rp?.chromeExtensionId,
    rp?.linkedinIp,
    rp?.linkedinCountry,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalizedFilter);
};

export const SettingsAdminUsers = () => {
  const { t } = useLingui();
  const { theme } = useContext(ThemeContext);
  const apolloAdminClient = useApolloAdminClient();
  const {
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
    enqueueWarningSnackBar,
  } = useSnackBar();
  const [filterText, setFilterText] = useState('');
  const [validatingKey, setValidatingKey] = useState<string | null>(null);
  const [connectingKey, setConnectingKey] = useState<string | null>(null);

  const { data, loading, error, refetch } =
    useQuery<AdminPanelAllWorkspaceMembersData>(
      GET_ADMIN_PANEL_ALL_WORKSPACE_MEMBERS,
      {
        client: apolloAdminClient,
        fetchPolicy: 'cache-and-network',
      },
    );

  const [validateLinkedinCookies] = useMutation<ValidateLinkedinCookiesResult>(
    ADMIN_VALIDATE_MEMBER_LINKEDIN_STORED_COOKIES,
    { client: apolloAdminClient },
  );

  const [connectLinkedinUnipile] = useMutation<ConnectLinkedinUnipileResult>(
    ADMIN_CONNECT_MEMBER_LINKEDIN_UNIPILE,
    { client: apolloAdminClient },
  );

  const rows = data?.adminPanelAllWorkspaceMembers ?? [];

  const filteredRows = useMemo(() => {
    const normalizedFilter = filterText.trim().toLowerCase();
    if (!normalizedFilter) {
      return rows;
    }

    return rows.filter((row) => rowMatchesFilter(row, normalizedFilter));
  }, [filterText, rows]);

  const handleCopy = useCallback(
    (value: string, label: string) => {
      void navigator.clipboard.writeText(value);
      enqueueSuccessSnackBar({
        message: t`${label} copied to clipboard`,
        options: {
          icon: <IconCopy size={theme.icon.size.md} />,
          duration: 2000,
        },
      });
    },
    [enqueueSuccessSnackBar, t, theme.icon.size.md],
  );

  const handleValidateCookies = async (
    workspaceId: string,
    workspaceMemberId: string,
  ) => {
    const rowKey = `${workspaceId}-${workspaceMemberId}`;
    setValidatingKey(rowKey);

    try {
      const { data: resultData } = await validateLinkedinCookies({
        variables: { workspaceId, workspaceMemberId },
      });
      const result = resultData?.adminValidateMemberLinkedinStoredCookies;

      if (!result) {
        enqueueErrorSnackBar({
          message: t`No response from cookie validation`,
        });
        return;
      }

      const summary = result.connected
        ? result.disconnectedAfterValidation
          ? t`LinkedIn connected with stored cookies; idle disconnect scheduled (validate-then-disconnect).`
          : t`LinkedIn connected with stored cookies.`
        : t`LinkedIn connection failed with stored cookies.`;

      const snackMessage = `${summary} ${result.message ?? ''}`.trim();
      if (result.connected) {
        enqueueSuccessSnackBar({
          message: snackMessage,
          options: { duration: 8000 },
        });
      } else {
        enqueueWarningSnackBar({
          message: snackMessage,
          options: { duration: 8000 },
        });
      }
      await refetch();
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : t`Cookie validation failed`;
      enqueueErrorSnackBar({
        message,
        options: { duration: 8000 },
      });
    } finally {
      setValidatingKey(null);
    }
  };

  const handleConnectUnipile = async (
    workspaceId: string,
    workspaceMemberId: string,
  ) => {
    const rowKey = `${workspaceId}-${workspaceMemberId}`;
    setConnectingKey(rowKey);

    try {
      const { data: resultData } = await connectLinkedinUnipile({
        variables: { workspaceId, workspaceMemberId },
      });
      const result = resultData?.adminConnectMemberLinkedinUnipile;

      if (!result) {
        enqueueErrorSnackBar({
          message: t`No response from Unipile connect`,
        });
        return;
      }

      const summary = result.connected
        ? t`LinkedIn Unipile connected with stored cookies, IP, and user agent.`
        : t`LinkedIn Unipile connect failed with stored cookies.`;

      const snackMessage = `${summary} ${result.message ?? ''}`.trim();
      if (result.connected) {
        enqueueSuccessSnackBar({
          message: snackMessage,
          options: { duration: 8000 },
        });
      } else {
        enqueueWarningSnackBar({
          message: snackMessage,
          options: { duration: 8000 },
        });
      }
      await refetch();
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : t`Unipile connect failed`;
      enqueueErrorSnackBar({
        message,
        options: { duration: 8000 },
      });
    } finally {
      setConnectingKey(null);
    }
  };

  return (
    <Section>
      <H2Title
        title={t`Workspaces and members`}
        description={t`Every workspace with its users, account and membership dates, and workspace member profile (recruiter profile) fields. Scroll horizontally to see all columns.`}
      />

      {loading && rows.length === 0 ? (
        <StyledMuted>
          <Trans>Loading…</Trans>
        </StyledMuted>
      ) : null}

      {error ? <StyledMuted>{error.message}</StyledMuted> : null}

      {!loading && !error && rows.length === 0 ? (
        <StyledMuted>
          <Trans>No workspace members found.</Trans>
        </StyledMuted>
      ) : null}

      {rows.length > 0 ? (
        <>
          <StyledToolbar>
            <StyledFilterInputWrap>
              <TextInput
                value={filterText}
                onChange={setFilterText}
                placeholder={t`Filter by workspace, email, name, phone, LinkedIn, company…`}
                fullWidth
              />
            </StyledFilterInputWrap>
            <StyledMatchCount>
              {filterText.trim()
                ? `${filteredRows.length} of ${rows.length}`
                : `${rows.length} members`}
            </StyledMatchCount>
          </StyledToolbar>

          {filteredRows.length === 0 ? (
            <StyledMuted>
              <Trans>No members match the current filter.</Trans>
            </StyledMuted>
          ) : (
            <StyledTableScroll>
              <StyledTable>
                <StyledTableRow gridAutoColumns={TABLE_GRID}>
                  <StyledTableHeader>
                    <Trans>Workspace</Trans>
                  </StyledTableHeader>
                  <StyledTableHeader>
                    <Trans>Subdomain</Trans>
                  </StyledTableHeader>
                  <StyledTableHeader>
                    <Trans>Workspace created</Trans>
                  </StyledTableHeader>
                  <StyledTableHeader>
                    <Trans>User email</Trans>
                  </StyledTableHeader>
                  <StyledTableHeader>
                    <Trans>Name</Trans>
                  </StyledTableHeader>
                  <StyledTableHeader>
                    <Trans>User created</Trans>
                  </StyledTableHeader>
                  <StyledTableHeader>
                    <Trans>Member since</Trans>
                  </StyledTableHeader>
                  <StyledTableHeader>
                    <Trans>Profile</Trans>
                  </StyledTableHeader>
                  <StyledTableHeader>
                    <Trans>Phone</Trans>
                  </StyledTableHeader>
                  <StyledTableHeader>
                    <Trans>LinkedIn</Trans>
                  </StyledTableHeader>
                  <StyledTableHeader>
                    <Trans>Job / company</Trans>
                  </StyledTableHeader>
                  <StyledTableHeader>
                    <Trans>Type / Unipile</Trans>
                  </StyledTableHeader>
                  <StyledTableHeader>
                    <Trans>Extension</Trans>
                  </StyledTableHeader>
                  <StyledTableHeader>
                    <Trans>Cookies</Trans>
                  </StyledTableHeader>
                  <StyledTableHeader>
                    <Trans>Last synced</Trans>
                  </StyledTableHeader>
                  <StyledTableHeader>
                    <Trans>Last validated</Trans>
                  </StyledTableHeader>
                  <StyledTableHeader>
                    <Trans>Test cookies</Trans>
                  </StyledTableHeader>
                  <StyledTableHeader>
                    <Trans>Connect Unipile</Trans>
                  </StyledTableHeader>
                </StyledTableRow>

                {filteredRows.map((row) => {
                  const rp = row.recruiterProfile;
                  const displayName = [row.userFirstName, row.userLastName]
                    .filter(Boolean)
                    .join(' ')
                    .trim();

                  let keepLinkedinLabel: string | null = null;

                  if (rp?.keepLinkedinConnected === true) {
                    keepLinkedinLabel = 'keepLI: true';
                  }
                  if (rp?.keepLinkedinConnected === false) {
                    keepLinkedinLabel = 'keepLI: false';
                  }

                  const cookieSummary = rp
                    ? [
                        rp.linkedinCookiesStored ? 'li_at' : null,
                        rp.linkedinLiAStored ? 'li_a' : null,
                      ]
                        .filter(Boolean)
                        .join(', ') || null
                    : null;

                  const validateKey =
                    rp?.workspaceMemberId != null
                      ? `${row.workspaceId}-${rp.workspaceMemberId}`
                      : null;
                  const canValidate = Boolean(
                    rp?.workspaceMemberId && rp.linkedinCookiesStored,
                  );
                  const isValidating =
                    validateKey != null && validatingKey === validateKey;
                  const canConnect = Boolean(
                    rp?.workspaceMemberId && rp.linkedinCookiesStored,
                  );
                  const isConnecting =
                    validateKey != null && connectingKey === validateKey;

                  const recruiterProfileJson = rp
                    ? JSON.stringify(rp, null, 2)
                    : null;

                  return (
                    <StyledTableRow
                      key={`${row.workspaceId}-${row.userId}`}
                      gridAutoColumns={TABLE_GRID}
                    >
                      <StyledTableCell>
                        <StyledCellStack>
                          <CopyableLine
                            value={row.workspaceName}
                            label={t`Workspace name`}
                            onCopy={handleCopy}
                          />
                          <CopyableLine
                            value={row.workspaceId}
                            label={t`Workspace ID`}
                            display={shortId(row.workspaceId)}
                            muted
                            onCopy={handleCopy}
                          />
                        </StyledCellStack>
                      </StyledTableCell>
                      <StyledTableCell>
                        <CopyableLine
                          value={row.workspaceSubdomain}
                          label={t`Subdomain`}
                          onCopy={handleCopy}
                        />
                      </StyledTableCell>
                      <StyledTableCell>
                        <PlainLine
                          primary={formatDate(row.workspaceCreatedAt)}
                          title={formatDt(row.workspaceCreatedAt)}
                        />
                      </StyledTableCell>
                      <StyledTableCell>
                        <StyledCellStack>
                          <CopyableLine
                            value={row.userEmail}
                            label={t`User email`}
                            onCopy={handleCopy}
                          />
                          <CopyableLine
                            value={row.userId}
                            label={t`User ID`}
                            display={shortId(row.userId)}
                            muted
                            onCopy={handleCopy}
                          />
                        </StyledCellStack>
                      </StyledTableCell>
                      <StyledTableCell>
                        <CopyableLine
                          value={displayName || null}
                          label={t`Name`}
                          display={displayName || '—'}
                          onCopy={handleCopy}
                        />
                      </StyledTableCell>
                      <StyledTableCell>
                        <PlainLine
                          primary={formatDate(row.userCreatedAt)}
                          title={formatDt(row.userCreatedAt)}
                        />
                      </StyledTableCell>
                      <StyledTableCell>
                        <PlainLine
                          primary={formatDate(row.membershipCreatedAt)}
                          title={formatDt(row.membershipCreatedAt)}
                        />
                      </StyledTableCell>
                      <StyledTableCell>
                        <StyledCellStack>
                          <CopyableLine
                            value={rp?.workspaceMemberId}
                            label={t`Workspace member ID`}
                            display={
                              rp?.workspaceMemberId
                                ? shortId(rp.workspaceMemberId)
                                : '—'
                            }
                            onCopy={handleCopy}
                          />
                          <CopyableLine
                            value={rp?.profileId}
                            label={t`Profile ID`}
                            display={
                              rp?.profileId ? shortId(rp.profileId) : '—'
                            }
                            muted
                            onCopy={handleCopy}
                          />
                          {keepLinkedinLabel ? (
                            <StyledCellSecondary>
                              {keepLinkedinLabel}
                            </StyledCellSecondary>
                          ) : null}
                          {recruiterProfileJson ? (
                            <CopyableLine
                              value={recruiterProfileJson}
                              label={t`Recruiter profile JSON`}
                              display={t`Copy profile JSON`}
                              muted
                              onCopy={handleCopy}
                            />
                          ) : null}
                        </StyledCellStack>
                      </StyledTableCell>
                      <StyledTableCell>
                        <CopyableLine
                          value={rp?.phoneNumber}
                          label={t`Phone`}
                          onCopy={handleCopy}
                        />
                      </StyledTableCell>
                      <StyledTableCell>
                        <CopyableLine
                          value={rp?.linkedinUrl}
                          label={t`LinkedIn URL`}
                          onCopy={handleCopy}
                        />
                      </StyledTableCell>
                      <StyledTableCell>
                        <StyledCellStack>
                          <CopyableLine
                            value={rp?.jobTitle}
                            label={t`Job title`}
                            onCopy={handleCopy}
                          />
                          <CopyableLine
                            value={rp?.companyName}
                            label={t`Company`}
                            muted
                            onCopy={handleCopy}
                          />
                        </StyledCellStack>
                      </StyledTableCell>
                      <StyledTableCell>
                        <StyledCellStack>
                          <PlainLine
                            primary={dash(rp?.typeWorkspaceMember)}
                          />
                          {rp?.linkedinUnipileAccountId ? (
                            <CopyableLine
                              value={rp.linkedinUnipileAccountId}
                              label={t`LinkedIn Unipile ID`}
                              display={`LI: ${shortId(rp.linkedinUnipileAccountId)}`}
                              muted
                              onCopy={handleCopy}
                            />
                          ) : null}
                          {rp?.whatsappUnipileAccountId ? (
                            <CopyableLine
                              value={rp.whatsappUnipileAccountId}
                              label={t`WhatsApp Unipile ID`}
                              display={`WA: ${shortId(rp.whatsappUnipileAccountId)}`}
                              muted
                              onCopy={handleCopy}
                            />
                          ) : null}
                        </StyledCellStack>
                      </StyledTableCell>
                      <StyledTableCell>
                        <StyledCellStack>
                          <PlainLine
                            primary={yesNo(rp?.extensionInstalled)}
                          />
                          {rp?.chromeExtensionId ? (
                            <CopyableLine
                              value={rp.chromeExtensionId}
                              label={t`Extension ID`}
                              display={shortId(rp.chromeExtensionId)}
                              muted
                              onCopy={handleCopy}
                            />
                          ) : null}
                        </StyledCellStack>
                      </StyledTableCell>
                      <StyledTableCell>
                        <PlainLine
                          primary={yesNo(rp?.linkedinCookiesStored)}
                          secondary={cookieSummary}
                          title={cookieSummary ?? undefined}
                        />
                      </StyledTableCell>
                      <StyledTableCell>
                        <PlainLine
                          primary={formatDate(
                            rp?.linkedinCookiesLastSyncedAt,
                          )}
                          title={formatDt(rp?.linkedinCookiesLastSyncedAt)}
                        />
                      </StyledTableCell>
                      <StyledTableCell>
                        <PlainLine
                          primary={formatDate(
                            rp?.linkedinCookiesValidatedAt,
                          )}
                          title={formatDt(rp?.linkedinCookiesValidatedAt)}
                        />
                      </StyledTableCell>
                      <StyledActionCell>
                        <Button
                          variant="secondary"
                          size="small"
                          title={isValidating ? t`Testing…` : t`Test`}
                          ariaLabel={t`Test cookie connection.`}
                          disabled={
                            !canValidate || isValidating || isConnecting
                          }
                          onClick={() => {
                            if (!rp?.workspaceMemberId) {
                              return;
                            }
                            void handleValidateCookies(
                              row.workspaceId,
                              rp.workspaceMemberId,
                            );
                          }}
                        />
                      </StyledActionCell>
                      <StyledActionCell>
                        <Button
                          variant="secondary"
                          size="small"
                          title={isConnecting ? t`Connecting…` : t`Connect`}
                          ariaLabel={t`Connect to LinkedIn Unipile using stored cookies, IP, and user agent.`}
                          disabled={
                            !canConnect || isConnecting || isValidating
                          }
                          onClick={() => {
                            if (!rp?.workspaceMemberId) {
                              return;
                            }
                            void handleConnectUnipile(
                              row.workspaceId,
                              rp.workspaceMemberId,
                            );
                          }}
                        />
                        <StyledCellStack>
                          {rp?.linkedinIp ? (
                            <CopyableLine
                              value={rp.linkedinIp}
                              label={t`LinkedIn IP`}
                              display={`IP: ${rp.linkedinIp}`}
                              muted
                              onCopy={handleCopy}
                            />
                          ) : null}
                          {rp?.linkedinCountry ? (
                            <CopyableLine
                              value={rp.linkedinCountry}
                              label={t`LinkedIn country`}
                              muted
                              onCopy={handleCopy}
                            />
                          ) : null}
                        </StyledCellStack>
                      </StyledActionCell>
                    </StyledTableRow>
                  );
                })}
              </StyledTable>
            </StyledTableScroll>
          )}
        </>
      ) : null}
    </Section>
  );
};
