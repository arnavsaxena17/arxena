import { ADMIN_VALIDATE_MEMBER_LINKEDIN_STORED_COOKIES } from '@/settings/admin-panel/graphql/mutations/adminValidateMemberLinkedinStoredCookies';
import { GET_ADMIN_PANEL_ALL_WORKSPACE_MEMBERS } from '@/settings/admin-panel/graphql/queries/getAdminPanelAllWorkspaceMembers';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { Table } from '@/ui/layout/table/components/Table';
import { TableCell } from '@/ui/layout/table/components/TableCell';
import { TableHeader } from '@/ui/layout/table/components/TableHeader';
import { TableRow } from '@/ui/layout/table/components/TableRow';
import { useMutation, useQuery } from '@apollo/client';
import styled from '@emotion/styled';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { Button, H2Title, Section } from 'twenty-ui';

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

const StyledTableScroll = styled.div`
  margin-top: ${({ theme }) => theme.spacing(3)};
  overflow-x: auto;
  width: 100%;
`;

const StyledTable = styled(Table)`
  min-width: 1800px;
  width: 100%;
`;

const StyledTableCell = styled(TableCell)`
  align-items: flex-start;
  height: auto;
  min-height: ${({ theme }) => theme.spacing(8)};
  padding-bottom: ${({ theme }) => theme.spacing(2)};
  padding-top: ${({ theme }) => theme.spacing(2)};
  vertical-align: top;
`;

const StyledMuted = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledEllipsis = styled.span`
  display: inline-block;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledValidateCell = styled(StyledTableCell)`
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const TABLE_GRID =
  'minmax(120px, 1.1fr) minmax(88px, 0.7fr) minmax(100px, 0.85fr) minmax(160px, 1.2fr) minmax(120px, 0.95fr) minmax(100px, 0.85fr) minmax(100px, 0.85fr) minmax(200px, 1.4fr) minmax(88px, 0.65fr) minmax(140px, 1fr) minmax(100px, 0.85fr) minmax(120px, 0.95fr) minmax(72px, 0.55fr) minmax(88px, 0.65fr) minmax(140px, 1fr) minmax(140px, 1fr) minmax(120px, 0.9fr)';

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

export const SettingsAdminUsers = () => {
  const { t } = useLingui();
  const { enqueueSnackBar } = useSnackBar();
  const [validatingKey, setValidatingKey] = useState<string | null>(null);

  const { data, loading, error, refetch } = useQuery<AdminPanelAllWorkspaceMembersData>(
    GET_ADMIN_PANEL_ALL_WORKSPACE_MEMBERS,
    { fetchPolicy: 'cache-and-network' },
  );

  const [validateLinkedinCookies] = useMutation<ValidateLinkedinCookiesResult>(
    ADMIN_VALIDATE_MEMBER_LINKEDIN_STORED_COOKIES,
  );

  const rows = data?.adminPanelAllWorkspaceMembers ?? [];

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
        enqueueSnackBar(t`No response from cookie validation`, {
          variant: SnackBarVariant.Error,
        });
        return;
      }

      const summary = result.connected
        ? result.disconnectedAfterValidation
          ? t`LinkedIn connected with stored cookies; idle disconnect scheduled (validate-then-disconnect).`
          : t`LinkedIn connected with stored cookies.`
        : t`LinkedIn connection failed with stored cookies.`;

      enqueueSnackBar(
        `${summary} ${result.message ?? ''}`.trim(),
        {
          variant: result.connected
            ? SnackBarVariant.Success
            : SnackBarVariant.Warning,
          duration: 8000,
        },
      );
      await refetch();
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : t`Cookie validation failed`;
      enqueueSnackBar(message, { variant: SnackBarVariant.Error, duration: 8000 });
    } finally {
      setValidatingKey(null);
    }
  };

  return (
    <Section>
      <H2Title
        title={t`Workspaces and members`}
        description={t`Every workspace with its users, account and membership dates, and workspace member profile (recruiter profile) fields.`}
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
        <StyledTableScroll>
          <StyledTable>
            <TableRow gridAutoColumns={TABLE_GRID}>
              <TableHeader>
                <Trans>Workspace</Trans>
              </TableHeader>
              <TableHeader>
                <Trans>Subdomain</Trans>
              </TableHeader>
              <TableHeader>
                <Trans>Workspace created</Trans>
              </TableHeader>
              <TableHeader>
                <Trans>User email</Trans>
              </TableHeader>
              <TableHeader>
                <Trans>Name</Trans>
              </TableHeader>
              <TableHeader>
                <Trans>User created</Trans>
              </TableHeader>
              <TableHeader>
                <Trans>Member since</Trans>
              </TableHeader>
              <TableHeader>
                <Trans>Profile</Trans>
              </TableHeader>
              <TableHeader>
                <Trans>Phone</Trans>
              </TableHeader>
              <TableHeader>
                <Trans>LinkedIn</Trans>
              </TableHeader>
              <TableHeader>
                <Trans>Job / company</Trans>
              </TableHeader>
              <TableHeader>
                <Trans>Type / Unipile</Trans>
              </TableHeader>
              <TableHeader>
                <Trans>Extension</Trans>
              </TableHeader>
              <TableHeader>
                <Trans>Cookies</Trans>
              </TableHeader>
              <TableHeader>
                <Trans>Last synced</Trans>
              </TableHeader>
              <TableHeader>
                <Trans>Last validated</Trans>
              </TableHeader>
              <TableHeader>
                <Trans>Test cookies</Trans>
              </TableHeader>
            </TableRow>

            {rows.map((row) => {
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

              const profileSummary = rp
                ? [
                    dash(rp.workspaceMemberId),
                    dash(rp.profileId),
                    keepLinkedinLabel,
                  ]
                    .filter((x) => x && x !== '—')
                    .join(' · ')
                : '—';

              const jobCompany = rp
                ? [dash(rp.jobTitle), dash(rp.companyName)]
                    .filter((x) => x !== '—')
                    .join(' · ')
                : '—';

              const typeUnipile = rp
                ? [
                    dash(rp.typeWorkspaceMember),
                    dash(rp.linkedinUnipileAccountId),
                    dash(rp.whatsappUnipileAccountId),
                  ]
                    .filter((x) => x !== '—')
                    .join(' · ')
                : '—';

              const cookieSummary = rp
                ? [
                    rp.linkedinCookiesStored ? 'li_at' : null,
                    rp.linkedinLiAStored ? 'li_a' : null,
                  ]
                    .filter(Boolean)
                    .join(', ') || '—'
                : '—';

              const validateKey =
                rp?.workspaceMemberId != null
                  ? `${row.workspaceId}-${rp.workspaceMemberId}`
                  : null;
              const canValidate = Boolean(
                rp?.workspaceMemberId && rp.linkedinCookiesStored,
              );
              const isValidating = validateKey != null && validatingKey === validateKey;

              return (
                <TableRow
                  key={`${row.workspaceId}-${row.userId}`}
                  gridAutoColumns={TABLE_GRID}
                >
                  <StyledTableCell title={row.workspaceId}>
                    {row.workspaceName}
                    <br />
                    <StyledMuted>{row.workspaceId.slice(0, 8)}…</StyledMuted>
                  </StyledTableCell>
                  <StyledTableCell>{row.workspaceSubdomain}</StyledTableCell>
                  <StyledTableCell>
                    {formatDt(row.workspaceCreatedAt)}
                  </StyledTableCell>
                  <StyledTableCell title={row.userEmail}>
                    {row.userEmail}
                    <br />
                    <StyledMuted>{row.userId.slice(0, 8)}…</StyledMuted>
                  </StyledTableCell>
                  <StyledTableCell>{displayName || '—'}</StyledTableCell>
                  <StyledTableCell>
                    {formatDt(row.userCreatedAt)}
                  </StyledTableCell>
                  <StyledTableCell>
                    {formatDt(row.membershipCreatedAt)}
                  </StyledTableCell>
                  <StyledTableCell title={profileSummary}>
                    <StyledEllipsis as="span">{profileSummary}</StyledEllipsis>
                  </StyledTableCell>
                  <StyledTableCell title={rp?.phoneNumber ?? undefined}>
                    {dash(rp?.phoneNumber)}
                  </StyledTableCell>
                  <StyledTableCell title={rp?.linkedinUrl ?? undefined}>
                    <StyledEllipsis as="span">
                      {dash(rp?.linkedinUrl)}
                    </StyledEllipsis>
                  </StyledTableCell>
                  <StyledTableCell title={jobCompany}>
                    <StyledEllipsis as="span">{jobCompany}</StyledEllipsis>
                  </StyledTableCell>
                  <StyledTableCell title={typeUnipile}>
                    <StyledEllipsis as="span">{typeUnipile}</StyledEllipsis>
                  </StyledTableCell>
                  <StyledTableCell title={rp?.chromeExtensionId ?? undefined}>
                    {yesNo(rp?.extensionInstalled)}
                    {rp?.chromeExtensionId ? (
                      <>
                        <br />
                        <StyledMuted>{rp.chromeExtensionId.slice(0, 12)}…</StyledMuted>
                      </>
                    ) : null}
                  </StyledTableCell>
                  <StyledTableCell title={cookieSummary}>
                    {yesNo(rp?.linkedinCookiesStored)}
                    {cookieSummary !== '—' ? (
                      <>
                        <br />
                        <StyledMuted>{cookieSummary}</StyledMuted>
                      </>
                    ) : null}
                  </StyledTableCell>
                  <StyledTableCell>
                    {formatDt(rp?.linkedinCookiesLastSyncedAt)}
                  </StyledTableCell>
                  <StyledTableCell>
                    {formatDt(rp?.linkedinCookiesValidatedAt)}
                  </StyledTableCell>
                  <StyledValidateCell>
                    <Button
                      variant="secondary"
                      size="small"
                      title={t`Test cookie connection.`}
                      disabled={!canValidate || isValidating}
                      onClick={() => {
                        if (!rp?.workspaceMemberId) {
                          return;
                        }
                        void handleValidateCookies(
                          row.workspaceId,
                          rp.workspaceMemberId,
                        );
                      }}
                    >
                      {isValidating ? t`Testing…` : t`Test`}
                    </Button>
                  </StyledValidateCell>
                </TableRow>
              );
            })}
          </StyledTable>
        </StyledTableScroll>
      ) : null}
    </Section>
  );
};
