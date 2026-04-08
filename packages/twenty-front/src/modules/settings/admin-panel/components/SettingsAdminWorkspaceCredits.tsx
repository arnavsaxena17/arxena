import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { ADMIN_ADJUST_WORKSPACE_CREDITS } from '@/settings/admin-panel/graphql/mutations/adminAdjustWorkspaceCredits';
import { ADMIN_DELETE_WORKSPACE } from '@/settings/admin-panel/graphql/mutations/adminDeleteWorkspace';
import { GET_ADMIN_WORKSPACES_WITH_CREDITS } from '@/settings/admin-panel/graphql/queries/getAdminWorkspacesWithCredits';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TextInput } from '@/ui/input/components/TextInput';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { Table } from '@/ui/layout/table/components/Table';
import { TableCell } from '@/ui/layout/table/components/TableCell';
import { TableHeader } from '@/ui/layout/table/components/TableHeader';
import { TableRow } from '@/ui/layout/table/components/TableRow';
import { useMutation, useQuery } from '@apollo/client';
import styled from '@emotion/styled';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';
import {
  Button,
  Checkbox,
  H2Title,
  IconTrash,
  Section,
  useIsMobile,
} from 'twenty-ui';

type WorkspaceCreditsRow = {
  workspaceId: string;
  workspaceCreatedAt: string;
  workspaceName: string;
  workspaceCreatorEmail?: string | null;
  orgChartCredits: number;
  emailContactCredits: number;
  phoneContactCredits: number;
};

type CreditType = 'ORG_CHART' | 'EMAIL_CONTACT' | 'PHONE_CONTACT';

type RowCreditEdit = {
  creditType: CreditType;
  delta: string;
};

const defaultRowCreditEdit = (): RowCreditEdit => ({
  creditType: 'EMAIL_CONTACT',
  delta: '',
});

const StyledTableScroll = styled.div`
  margin-top: ${({ theme }) => theme.spacing(3)};
  overflow-x: auto;
  width: 100%;
`;

const StyledTable = styled(Table)`
  min-width: 980px;
  width: 100%;
`;

const StyledTableCell = styled(TableCell)`
  align-items: flex-start;
  height: auto;
  min-height: ${({ theme }) => theme.spacing(8)};
  padding-bottom: ${({ theme }) => theme.spacing(2)};
  padding-top: ${({ theme }) => theme.spacing(2)};
  vertical-align: middle;
`;

const StyledCheckboxCell = styled(StyledTableCell)`
  align-items: center;
  justify-content: center;
  padding-left: 0;
  padding-right: 0;
`;

const StyledActionsControlsRow = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: nowrap;
  gap: ${({ theme }) => theme.spacing(2)};
  max-width: 100%;
  min-width: 0;
  width: 100%;
`;

const StyledAmountInputWrap = styled.div`
  flex: 1 1 auto;
  min-width: ${({ theme }) => theme.spacing(16)};
`;

const StyledSelect = styled.select`
  background: ${({ theme }) => theme.background.primary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  color: ${({ theme }) => theme.font.color.primary};
  flex-shrink: 0;
  font-size: ${({ theme }) => theme.font.size.sm};
  min-width: 120px;
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
`;

const StyledApplyButtonWrap = styled.div`
  flex-shrink: 0;
`;

const StyledShortWorkspaceId = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  font-family: monospace;
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledCreatedAt = styled.span`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  white-space: nowrap;
`;

const StyledMobileCardList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  margin-top: ${({ theme }) => theme.spacing(3)};
`;

const StyledMobileCard = styled.div`
  border-radius: ${({ theme }) => theme.border.radius.md};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
`;

const StyledMobileMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledMobileWorkspaceName = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  overflow-wrap: anywhere;
`;

const StyledCreatorEmail = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  overflow-wrap: anywhere;
`;

const StyledMobileCreditsRow = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  flex-wrap: wrap;
  font-size: ${({ theme }) => theme.font.size.sm};
  gap: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(4)};
`;

const StyledMobileCreditItem = styled.span`
  white-space: nowrap;
`;

const StyledMobileActionsColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme }) => theme.spacing(1)};
`;

const StyledMobileSelect = styled(StyledSelect)`
  min-width: 0;
  width: 100%;
`;

const TABLE_GRID =
  'minmax(40px, auto) minmax(96px, 1fr) minmax(104px, 0.9fr) minmax(120px, 1.2fr) minmax(140px, 1.4fr) minmax(72px, 0.55fr) minmax(64px, 0.5fr) minmax(64px, 0.5fr) minmax(72px, 0.55fr) minmax(260px, 1.4fr)';

const shortWorkspaceId = (id: string) => `${id.slice(0, 8)}…`;

const formatWorkspaceCreatedAt = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

const totalCredits = (row: WorkspaceCreditsRow) =>
  row.orgChartCredits + row.emailContactCredits + row.phoneContactCredits;

const StyledBulkActionsBar = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme }) => theme.spacing(2)};
`;

const StyledMobileCardHeaderRow = styled.div`
  align-items: flex-start;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledMobileMetaInHeader = styled(StyledMobileMeta)`
  flex: 1;
  min-width: 0;
`;

const StyledSelectedCount = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

export const SettingsAdminWorkspaceCredits = () => {
  const { t } = useLingui();
  const isMobile = useIsMobile();
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const { enqueueSnackBar } = useSnackBar();
  const { data, loading, refetch } = useQuery<{
    adminListWorkspacesWithCredits: WorkspaceCreditsRow[];
  }>(GET_ADMIN_WORKSPACES_WITH_CREDITS, { fetchPolicy: 'network-only' });
  const [adjustCredits] = useMutation<{ adminAdjustWorkspaceCredits: boolean }>(
    ADMIN_ADJUST_WORKSPACE_CREDITS,
  );
  const [deleteWorkspaceMutation] = useMutation<{
    adminDeleteWorkspace: boolean;
  }>(ADMIN_DELETE_WORKSPACE);
  const [adjustingWorkspaceId, setAdjustingWorkspaceId] = useState<
    string | null
  >(null);
  const [bulkDeletePendingRows, setBulkDeletePendingRows] = useState<
    WorkspaceCreditsRow[] | null
  >(null);
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<string[]>(
    [],
  );
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [rowCreditEdits, setRowCreditEdits] = useState<
    Record<string, RowCreditEdit>
  >({});

  const rows = useMemo(
    () => data?.adminListWorkspacesWithCredits ?? [],
    [data?.adminListWorkspacesWithCredits],
  );

  const deletableRows = useMemo(
    () => rows.filter((row) => row.workspaceId !== currentWorkspace?.id),
    [rows, currentWorkspace?.id],
  );

  const selectedDeletableCount = useMemo(
    () =>
      deletableRows.filter((row) =>
        selectedWorkspaceIds.includes(row.workspaceId),
      ).length,
    [deletableRows, selectedWorkspaceIds],
  );

  const isAllDeletableSelected =
    deletableRows.length > 0 && selectedDeletableCount === deletableRows.length;

  const isSomeDeletableSelected =
    selectedDeletableCount > 0 && !isAllDeletableSelected;

  const selectedRowsForBulk = useMemo(
    () => rows.filter((row) => selectedWorkspaceIds.includes(row.workspaceId)),
    [rows, selectedWorkspaceIds],
  );

  const getRowCreditEdit = (workspaceId: string): RowCreditEdit => ({
    ...defaultRowCreditEdit(),
    ...rowCreditEdits[workspaceId],
  });

  const setRowCreditTypeForWorkspace = (
    workspaceId: string,
    nextCreditType: CreditType,
  ) => {
    setRowCreditEdits((prev) => ({
      ...prev,
      [workspaceId]: {
        ...defaultRowCreditEdit(),
        ...prev[workspaceId],
        creditType: nextCreditType,
      },
    }));
  };

  const setRowDeltaForWorkspace = (workspaceId: string, delta: string) => {
    setRowCreditEdits((prev) => ({
      ...prev,
      [workspaceId]: {
        ...defaultRowCreditEdit(),
        ...prev[workspaceId],
        delta,
      },
    }));
  };

  const handleAdjust = async (workspaceId: string) => {
    const { creditType: rowCreditType, delta: rowDelta } =
      getRowCreditEdit(workspaceId);
    const delta = parseInt(rowDelta, 10);
    if (Number.isNaN(delta) || delta === 0) {
      enqueueSnackBar(t`Enter a non-zero number`, {
        variant: SnackBarVariant.Error,
      });
      return;
    }
    setAdjustingWorkspaceId(workspaceId);
    try {
      await adjustCredits({
        variables: {
          input: {
            workspaceId,
            creditType: rowCreditType,
            delta,
          },
        },
      });
      enqueueSnackBar(t`Credits updated`, { variant: SnackBarVariant.Success });
      setRowCreditEdits((prev) => ({
        ...prev,
        [workspaceId]: {
          ...defaultRowCreditEdit(),
          ...prev[workspaceId],
          delta: '',
        },
      }));
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

  const setBulkDeleteModalOpen = (open: boolean) => {
    if (!open) {
      setBulkDeletePendingRows(null);
    }
  };

  const toggleWorkspaceSelected = (workspaceId: string) => {
    if (workspaceId === currentWorkspace?.id) {
      return;
    }
    setSelectedWorkspaceIds((prev) =>
      prev.includes(workspaceId)
        ? prev.filter((id) => id !== workspaceId)
        : [...prev, workspaceId],
    );
  };

  const handleSelectAllDeletable = () => {
    if (isAllDeletableSelected) {
      setSelectedWorkspaceIds([]);
      return;
    }
    setSelectedWorkspaceIds(deletableRows.map((row) => row.workspaceId));
  };

  const handleOpenBulkDelete = () => {
    if (selectedRowsForBulk.length === 0) {
      return;
    }
    setBulkDeletePendingRows(selectedRowsForBulk);
  };

  const handleConfirmBulkDelete = async () => {
    const rowsToDelete = bulkDeletePendingRows;
    if (!rowsToDelete?.length) {
      return;
    }
    setIsBulkDeleting(true);
    let failureCount = 0;
    const errors: string[] = [];
    for (const row of rowsToDelete) {
      if (row.workspaceId === currentWorkspace?.id) {
        continue;
      }
      try {
        await deleteWorkspaceMutation({
          variables: { workspaceId: row.workspaceId },
        });
      } catch (err) {
        failureCount += 1;
        errors.push(
          err instanceof Error ? err.message : t`Failed to delete workspace`,
        );
      }
    }
    setIsBulkDeleting(false);
    setSelectedWorkspaceIds([]);
    await refetch();
    const deletedCount = rowsToDelete.length - failureCount;
    if (failureCount === 0) {
      enqueueSnackBar(
        deletedCount === 1
          ? t`Deleted 1 workspace`
          : t`Deleted ${deletedCount} workspaces`,
        { variant: SnackBarVariant.Success },
      );
      return;
    }
    const deleted = deletedCount;
    const failed = failureCount;
    const firstError = errors[0] ?? '';
    enqueueSnackBar(t`Deleted ${deleted}, ${failed} failed: ${firstError}`, {
      variant: SnackBarVariant.Error,
    });
  };

  const bulkDeleteWorkspaceCount = bulkDeletePendingRows?.length ?? 0;
  const selectedWorkspaceCount = selectedDeletableCount;

  return (
    <>
      <ConfirmationModal
        isOpen={bulkDeletePendingRows !== null}
        setIsOpen={setBulkDeleteModalOpen}
        title={t`Delete workspaces`}
        subtitle={
          bulkDeletePendingRows && bulkDeletePendingRows.length > 0 ? (
            <Trans>
              This permanently deletes{' '}
              <strong>{bulkDeleteWorkspaceCount}</strong> workspaces and all of
              their data. This cannot be undone.
            </Trans>
          ) : null
        }
        onConfirmClick={handleConfirmBulkDelete}
        deleteButtonText={t`Delete workspaces`}
        loading={isBulkDeleting}
      />
      <Section>
        <H2Title
          title={t`Workspace Credits`}
          description={t`View and manually add or remove credits per workspace.`}
        />
        {!loading && selectedDeletableCount > 0 ? (
          <StyledBulkActionsBar>
            <StyledSelectedCount>
              {t`${selectedWorkspaceCount} selected`}
            </StyledSelectedCount>
            <Button
              accent="danger"
              variant="secondary"
              title={t`Delete selected workspaces`}
              Icon={IconTrash}
              onClick={handleOpenBulkDelete}
              disabled={isBulkDeleting}
            />
          </StyledBulkActionsBar>
        ) : null}
        {loading ? (
          <p>{t`Loading...`}</p>
        ) : isMobile ? (
          <StyledMobileCardList>
            {rows.map((row) => {
              const rowCreditEdit = getRowCreditEdit(row.workspaceId);
              return (
                <StyledMobileCard key={row.workspaceId}>
                  <StyledMobileCardHeaderRow>
                    <Checkbox
                      checked={selectedWorkspaceIds.includes(row.workspaceId)}
                      onCheckedChange={() =>
                        toggleWorkspaceSelected(row.workspaceId)
                      }
                      disabled={row.workspaceId === currentWorkspace?.id}
                    />
                    <StyledMobileMetaInHeader>
                      <StyledShortWorkspaceId title={row.workspaceId}>
                        {shortWorkspaceId(row.workspaceId)}
                      </StyledShortWorkspaceId>
                      <StyledCreatedAt>
                        {formatWorkspaceCreatedAt(row.workspaceCreatedAt)}
                      </StyledCreatedAt>
                      <StyledMobileWorkspaceName>
                        {row.workspaceName || '—'}
                      </StyledMobileWorkspaceName>
                      <StyledCreatorEmail>
                        {t`Creator email`}: {row.workspaceCreatorEmail || '—'}
                      </StyledCreatorEmail>
                    </StyledMobileMetaInHeader>
                  </StyledMobileCardHeaderRow>
                  <StyledMobileCreditsRow>
                    <StyledMobileCreditItem>
                      {t`Org chart`}: {row.orgChartCredits}
                    </StyledMobileCreditItem>
                    <StyledMobileCreditItem>
                      {t`Email`}: {row.emailContactCredits}
                    </StyledMobileCreditItem>
                    <StyledMobileCreditItem>
                      {t`Phone`}: {row.phoneContactCredits}
                    </StyledMobileCreditItem>
                    <StyledMobileCreditItem>
                      {t`Total`}: {totalCredits(row)}
                    </StyledMobileCreditItem>
                  </StyledMobileCreditsRow>
                  <StyledMobileActionsColumn>
                    <StyledMobileSelect
                      value={rowCreditEdit.creditType}
                      onChange={(e) =>
                        setRowCreditTypeForWorkspace(
                          row.workspaceId,
                          e.target.value as CreditType,
                        )
                      }
                      aria-label={t`Credit type`}
                    >
                      <option value="ORG_CHART">{t`Org chart`}</option>
                      <option value="EMAIL_CONTACT">{t`Email`}</option>
                      <option value="PHONE_CONTACT">{t`Phone`}</option>
                    </StyledMobileSelect>
                    <TextInput
                      value={rowCreditEdit.delta}
                      onChange={(v) =>
                        setRowDeltaForWorkspace(row.workspaceId, v)
                      }
                      placeholder={t`Amount (+ / -)`}
                      fullWidth
                    />
                    <Button
                      title={t`Apply`}
                      fullWidth
                      onClick={() => handleAdjust(row.workspaceId)}
                      disabled={
                        adjustingWorkspaceId === row.workspaceId ||
                        !rowCreditEdit.delta.trim()
                      }
                    />
                  </StyledMobileActionsColumn>
                </StyledMobileCard>
              );
            })}
          </StyledMobileCardList>
        ) : (
          <StyledTableScroll>
            <StyledTable>
              <TableRow gridAutoColumns={TABLE_GRID}>
                <TableHeader>
                  <Checkbox
                    checked={isAllDeletableSelected}
                    indeterminate={isSomeDeletableSelected}
                    onCheckedChange={handleSelectAllDeletable}
                    disabled={deletableRows.length === 0}
                  />
                </TableHeader>
                <TableHeader>{t`Workspace ID`}</TableHeader>
                <TableHeader>{t`Created`}</TableHeader>
                <TableHeader>{t`Name`}</TableHeader>
                <TableHeader>{t`Creator email`}</TableHeader>
                <TableHeader align="right">{t`Org chart`}</TableHeader>
                <TableHeader align="right">{t`Email`}</TableHeader>
                <TableHeader align="right">{t`Phone`}</TableHeader>
                <TableHeader align="right">{t`Total`}</TableHeader>
                <TableHeader>{t`Actions`}</TableHeader>
              </TableRow>
              {rows.map((row) => {
                const rowCreditEdit = getRowCreditEdit(row.workspaceId);
                return (
                  <TableRow key={row.workspaceId} gridAutoColumns={TABLE_GRID}>
                    <StyledCheckboxCell>
                      <Checkbox
                        checked={selectedWorkspaceIds.includes(row.workspaceId)}
                        onCheckedChange={() =>
                          toggleWorkspaceSelected(row.workspaceId)
                        }
                        disabled={row.workspaceId === currentWorkspace?.id}
                      />
                    </StyledCheckboxCell>
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
                    <StyledTableCell>
                      {row.workspaceName || '—'}
                    </StyledTableCell>
                    <StyledTableCell>
                      <StyledCreatorEmail>
                        {row.workspaceCreatorEmail || '—'}
                      </StyledCreatorEmail>
                    </StyledTableCell>
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
                      <StyledActionsControlsRow>
                        <StyledSelect
                            value={rowCreditEdit.creditType}
                            onChange={(e) =>
                              setRowCreditTypeForWorkspace(
                                row.workspaceId,
                                e.target.value as CreditType,
                              )
                            }
                            aria-label={t`Credit type`}
                          >
                            <option value="ORG_CHART">{t`Org chart`}</option>
                            <option value="EMAIL_CONTACT">{t`Email`}</option>
                            <option value="PHONE_CONTACT">{t`Phone`}</option>
                          </StyledSelect>
                          <StyledAmountInputWrap>
                            <TextInput
                              value={rowCreditEdit.delta}
                              onChange={(v) =>
                                setRowDeltaForWorkspace(row.workspaceId, v)
                              }
                              placeholder={t`Amount (+ / -)`}
                              fullWidth
                            />
                          </StyledAmountInputWrap>
                          <StyledApplyButtonWrap>
                            <Button
                              title={t`Apply`}
                              onClick={() => handleAdjust(row.workspaceId)}
                              disabled={
                                adjustingWorkspaceId === row.workspaceId ||
                                !rowCreditEdit.delta.trim()
                              }
                            />
                          </StyledApplyButtonWrap>
                        </StyledActionsControlsRow>
                      </StyledActionsInner>
                    </StyledTableCell>
                  </TableRow>
                );
              })}
            </StyledTable>
          </StyledTableScroll>
        )}
      </Section>
    </>
  );
};
