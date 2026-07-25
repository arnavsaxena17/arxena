import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { useApolloAdminClient } from '@/settings/admin-panel/apollo/hooks/useApolloAdminClient';
import { ADMIN_ADJUST_WORKSPACE_CREDITS } from '@/settings/admin-panel/graphql/mutations/adminAdjustWorkspaceCredits';
import { ADMIN_DELETE_WORKSPACE } from '@/settings/admin-panel/graphql/mutations/adminDeleteWorkspace';
import { GET_ADMIN_WORKSPACES_WITH_CREDITS } from '@/settings/admin-panel/graphql/queries/getAdminWorkspacesWithCredits';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TextInput } from '@/ui/input/components/TextInput';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useModal } from '@/ui/layout/modal/hooks/useModal';
import { Table } from '@/ui/layout/table/components/Table';
import { TableCell } from '@/ui/layout/table/components/TableCell';
import { TableHeader } from '@/ui/layout/table/components/TableHeader';
import { TableRow } from '@/ui/layout/table/components/TableRow';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useMutation, useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMemo, useState } from 'react';
import { IconTrash } from 'twenty-ui/icon';
import { Button, Checkbox } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { H2Title } from 'twenty-ui/typography';
import { useIsMobile } from 'twenty-ui/utilities';

type WorkspaceCreditsRow = {
  workspaceId: string;
  workspaceCreatedAt: string;
  workspaceName: string;
  workspaceCreatorEmail?: string | null;
  orgChartCredits: number;
  revealCredits: number;
};

type CreditType = 'ORG_CHART' | 'REVEAL';

type RowCreditEdit = {
  creditType: CreditType;
  delta: string;
};

const defaultRowCreditEdit = (): RowCreditEdit => ({
  creditType: 'REVEAL',
  delta: '',
});

const StyledTableScroll = styled.div`
  margin-top: ${themeCssVariables.spacing[3]};
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
  min-height: ${themeCssVariables.spacing[8]};
  padding-bottom: ${themeCssVariables.spacing[2]};
  padding-top: ${themeCssVariables.spacing[2]};
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
  gap: ${themeCssVariables.spacing[2]};
  max-width: 100%;
  min-width: 0;
  width: 100%;
`;

const StyledAmountInputWrap = styled.div`
  flex: 1 1 auto;
  min-width: ${themeCssVariables.spacing[16]};
`;

const StyledSelect = styled.select`
  background: ${themeCssVariables.background.primary};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.medium};
  color: ${themeCssVariables.font.color.primary};
  flex-shrink: 0;
  font-size: ${themeCssVariables.font.size.sm};
  min-width: 120px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

const StyledApplyButtonWrap = styled.div`
  flex-shrink: 0;
`;

const StyledShortWorkspaceId = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  font-family: monospace;
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledCreatedAt = styled.span`
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.secondary};
  white-space: nowrap;
`;

const StyledMobileCardList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  margin-top: ${themeCssVariables.spacing[3]};
`;

const StyledMobileCard = styled.div`
  border-radius: ${themeCssVariables.border.radius.md};
  border: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledMobileMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledMobileWorkspaceName = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-weight: ${themeCssVariables.font.weight.medium};
  overflow-wrap: anywhere;
`;

const StyledCreatorEmail = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  overflow-wrap: anywhere;
`;

const StyledMobileCreditsRow = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  flex-wrap: wrap;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
`;

const StyledMobileCreditItem = styled.span`
  white-space: nowrap;
`;

const StyledMobileActionsColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[1]};
`;

const StyledMobileSelect = styled(StyledSelect)`
  min-width: 0;
  width: 100%;
`;

const TABLE_GRID =
  'minmax(40px, auto) minmax(96px, 1fr) minmax(104px, 0.9fr) minmax(120px, 1.2fr) minmax(140px, 1.4fr) minmax(72px, 0.55fr) minmax(72px, 0.55fr) minmax(260px, 1.4fr)';

const BULK_DELETE_WORKSPACES_MODAL_ID =
  'settings-admin-workspace-credits-bulk-delete';

const shortWorkspaceId = (id: string) => `${id.slice(0, 8)}…`;

const formatWorkspaceCreatedAt = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

const StyledBulkActionsBar = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[2]};
`;

const StyledMobileCardHeaderRow = styled.div`
  align-items: flex-start;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledMobileMetaInHeader = styled(StyledMobileMeta)`
  flex: 1;
  min-width: 0;
`;

const StyledSelectedCount = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
`;

export const SettingsAdminWorkspaceCredits = () => {
  const { t } = useLingui();
  const isMobile = useIsMobile();
  const apolloAdminClient = useApolloAdminClient();
  const { openModal } = useModal();
  const currentWorkspace = useAtomStateValue(currentWorkspaceState);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const { data, loading, refetch } = useQuery<{
    adminListWorkspacesWithCredits: WorkspaceCreditsRow[];
  }>(GET_ADMIN_WORKSPACES_WITH_CREDITS, {
    client: apolloAdminClient,
    fetchPolicy: 'network-only',
  });
  const [adjustCredits] = useMutation<{ adminAdjustWorkspaceCredits: boolean }>(
    ADMIN_ADJUST_WORKSPACE_CREDITS,
    { client: apolloAdminClient },
  );
  const [deleteWorkspaceMutation] = useMutation<{
    adminDeleteWorkspace: boolean;
  }>(ADMIN_DELETE_WORKSPACE, { client: apolloAdminClient });
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
      enqueueErrorSnackBar({ message: t`Enter a non-zero number` });
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
      enqueueSuccessSnackBar({ message: t`Credits updated` });
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
      enqueueErrorSnackBar({
        message:
          err instanceof Error ? err.message : t`Failed to update credits`,
      });
    } finally {
      setAdjustingWorkspaceId(null);
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
    openModal(BULK_DELETE_WORKSPACES_MODAL_ID);
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
    setBulkDeletePendingRows(null);
    await refetch();
    const deletedCount = rowsToDelete.length - failureCount;
    if (failureCount === 0) {
      enqueueSuccessSnackBar({
        message:
          deletedCount === 1
            ? t`Deleted 1 workspace`
            : t`Deleted ${deletedCount} workspaces`,
      });
      return;
    }
    const deleted = deletedCount;
    const failed = failureCount;
    const firstError = errors[0] ?? '';
    enqueueErrorSnackBar({
      message: t`Deleted ${deleted}, ${failed} failed: ${firstError}`,
    });
  };

  const bulkDeleteWorkspaceCount = bulkDeletePendingRows?.length ?? 0;
  const selectedWorkspaceCount = selectedDeletableCount;

  return (
    <>
      <ConfirmationModal
        modalInstanceId={BULK_DELETE_WORKSPACES_MODAL_ID}
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
        confirmButtonText={t`Delete workspaces`}
        loading={isBulkDeleting}
        onClose={() => setBulkDeletePendingRows(null)}
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
                      {t`Reveal`}: {row.revealCredits}
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
                      <option value="REVEAL">{t`Reveal`}</option>
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
                <TableHeader align="right">{t`Reveal`}</TableHeader>
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
                      {row.revealCredits}
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
                          <option value="REVEAL">{t`Reveal`}</option>
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
