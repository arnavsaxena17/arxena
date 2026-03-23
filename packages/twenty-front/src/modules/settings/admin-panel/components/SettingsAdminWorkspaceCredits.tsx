import { ADMIN_ADJUST_WORKSPACE_CREDITS } from '@/settings/admin-panel/graphql/mutations/adminAdjustWorkspaceCredits';
import { GET_ADMIN_WORKSPACES_WITH_CREDITS } from '@/settings/admin-panel/graphql/queries/getAdminWorkspacesWithCredits';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TextInput } from '@/ui/input/components/TextInput';
import { Table } from '@/ui/layout/table/components/Table';
import { TableCell } from '@/ui/layout/table/components/TableCell';
import { TableHeader } from '@/ui/layout/table/components/TableHeader';
import { TableRow } from '@/ui/layout/table/components/TableRow';
import { useMutation, useQuery } from '@apollo/client';
import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { Button, H2Title, Section } from 'twenty-ui';

type WorkspaceCreditsRow = {
  workspaceId: string;
  workspaceCreatedAt: string;
  workspaceName: string;
  orgChartCredits: number;
  emailContactCredits: number;
  phoneContactCredits: number;
};

type CreditType = 'ORG_CHART' | 'EMAIL_CONTACT' | 'PHONE_CONTACT';

const StyledTable = styled(Table)`
  margin-top: ${({ theme }) => theme.spacing(3)};
`;

const StyledTableCell = styled(TableCell)`
  vertical-align: middle;
`;

const StyledActionsInner = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  flex-wrap: wrap;
`;

const StyledSelect = styled.select`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  min-width: 120px;
`;

const StyledShortWorkspaceId = styled.span`
  font-family: monospace;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledCreatedAt = styled.span`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  white-space: nowrap;
`;

const TABLE_GRID =
  'minmax(0, 0.55fr) minmax(0, 0.85fr) minmax(0, 2fr) 1fr 1fr 1fr 1fr 3fr';

const shortWorkspaceId = (id: string) => `${id.slice(0, 8)}…`;

const formatWorkspaceCreatedAt = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

const totalCredits = (row: WorkspaceCreditsRow) =>
  row.orgChartCredits + row.emailContactCredits + row.phoneContactCredits;

export const SettingsAdminWorkspaceCredits = () => {
  const { t } = useLingui();
  const { enqueueSnackBar } = useSnackBar();
  const { data, loading, refetch } = useQuery<{
    adminListWorkspacesWithCredits: WorkspaceCreditsRow[];
  }>(GET_ADMIN_WORKSPACES_WITH_CREDITS, { fetchPolicy: 'network-only' });
  const [adjustCredits] = useMutation<{ adminAdjustWorkspaceCredits: boolean }>(
    ADMIN_ADJUST_WORKSPACE_CREDITS,
  );
  const [adjustingWorkspaceId, setAdjustingWorkspaceId] = useState<
    string | null
  >(null);
  const [creditType, setCreditType] = useState<CreditType>('EMAIL_CONTACT');
  const [deltaInput, setDeltaInput] = useState('');

  const rows = data?.adminListWorkspacesWithCredits ?? [];

  const handleAdjust = async (workspaceId: string) => {
    const delta = parseInt(deltaInput, 10);
    if (Number.isNaN(delta) || delta === 0) {
      enqueueSnackBar(t`Enter a non-zero number`, { variant: SnackBarVariant.Error });
      return;
    }
    setAdjustingWorkspaceId(workspaceId);
    try {
      await adjustCredits({
        variables: {
          input: {
            workspaceId,
            creditType,
            delta,
          },
        },
      });
      enqueueSnackBar(t`Credits updated`, { variant: SnackBarVariant.Success });
      setDeltaInput('');
      await refetch();
    } catch (err) {
      enqueueSnackBar(
        err instanceof Error ? err.message : t`Failed to update credits`,
        { variant: SnackBarVariant.Error },
      );
    } finally {
      setAdjustingWorkspaceId(null);
    }
  };

  return (
    <>
      <Section>
        <H2Title
          title={t`Workspace Credits`}
          description={t`View and manually add or remove credits per workspace.`}
        />
        {loading ? (
          <p>{t`Loading...`}</p>
        ) : (
          <StyledTable>
            <TableRow gridAutoColumns={TABLE_GRID}>
              <TableHeader>{t`Workspace ID`}</TableHeader>
              <TableHeader>{t`Created`}</TableHeader>
              <TableHeader>{t`Name`}</TableHeader>
              <TableHeader align="right">{t`Org chart`}</TableHeader>
              <TableHeader align="right">{t`Email`}</TableHeader>
              <TableHeader align="right">{t`Phone`}</TableHeader>
              <TableHeader align="right">{t`Total`}</TableHeader>
              <TableHeader>{t`Actions`}</TableHeader>
            </TableRow>
            {rows.map((row) => (
              <TableRow
                key={row.workspaceId}
                gridAutoColumns={TABLE_GRID}
              >
                <StyledTableCell>
                  <StyledShortWorkspaceId title={row.workspaceId}>
                    {shortWorkspaceId(row.workspaceId)}
                  </StyledShortWorkspaceId>
                </StyledTableCell>
                <StyledTableCell>
                  <StyledCreatedAt>
                    {formatWorkspaceCreatedAt(row.workspaceCreatedAt)}
                  </StyledCreatedAt>
                </StyledTableCell>
                <StyledTableCell>{row.workspaceName || '—'}</StyledTableCell>
                <StyledTableCell align="right">
                  {row.orgChartCredits}
                </StyledTableCell>
                <StyledTableCell align="right">
                  {row.emailContactCredits}
                </StyledTableCell>
                <StyledTableCell align="right">
                  {row.phoneContactCredits}
                </StyledTableCell>
                <StyledTableCell align="right">
                  {totalCredits(row)}
                </StyledTableCell>
                <StyledTableCell>
                  <StyledActionsInner>
                    <StyledSelect
                      value={creditType}
                      onChange={(e) =>
                        setCreditType(e.target.value as CreditType)
                      }
                      aria-label={t`Credit type`}
                    >
                      <option value="ORG_CHART">{t`Org chart`}</option>
                      <option value="EMAIL_CONTACT">{t`Email`}</option>
                      <option value="PHONE_CONTACT">{t`Phone`}</option>
                    </StyledSelect>
                    <TextInput
                      value={deltaInput}
                      onChange={(v) => setDeltaInput(v)}
                      placeholder={t`Amount (+ / -)`}
                      width={100}
                    />
                    <Button
                      title={t`Apply`}
                      onClick={() => handleAdjust(row.workspaceId)}
                      disabled={
                        adjustingWorkspaceId === row.workspaceId ||
                        !deltaInput.trim()
                      }
                    />
                  </StyledActionsInner>
                </StyledTableCell>
              </TableRow>
            ))}
          </StyledTable>
        )}
      </Section>
    </>
  );
};
