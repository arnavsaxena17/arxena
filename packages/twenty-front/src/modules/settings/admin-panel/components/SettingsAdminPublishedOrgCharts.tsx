import { getArxenaSiteBaseUrl } from '@/auth/utils/arxenaSiteUrl';
import { useApolloAdminClient } from '@/settings/admin-panel/apollo/hooks/useApolloAdminClient';
import {
  ADD_ADMIN_PUBLISHED_ORG_CHART_ALIAS,
  DELETE_ADMIN_PUBLISHED_ORG_CHART_SLUG,
  RENAME_ADMIN_PUBLISHED_ORG_CHART_SLUG,
} from '@/settings/admin-panel/graphql/mutations/adminPublishedOrgChartSlugs';
import { REBUILD_ADMIN_PUBLISHED_ORG_CHART } from '@/settings/admin-panel/graphql/mutations/rebuildAdminPublishedOrgChart';
import { UPDATE_ADMIN_PUBLISHED_ORG_CHART } from '@/settings/admin-panel/graphql/mutations/updateAdminPublishedOrgChart';
import { GET_ADMIN_PUBLISHED_ORG_CHARTS } from '@/settings/admin-panel/graphql/queries/getAdminPublishedOrgCharts';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TextInput } from '@/ui/input/components/TextInput';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useModal } from '@/ui/layout/modal/hooks/useModal';
import { Table } from '@/ui/layout/table/components/Table';
import { TableCell } from '@/ui/layout/table/components/TableCell';
import { TableHeader } from '@/ui/layout/table/components/TableHeader';
import { TableRow } from '@/ui/layout/table/components/TableRow';
import { useMutation, useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { useMemo, useState } from 'react';
import { IconRefresh, IconTrash } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { H2Title } from 'twenty-ui/typography';

type AdminPublishedOrgChartRow = {
  publishSlug: string;
  companyId: string;
  companyName?: string | null;
  companyLinkedinUrl?: string | null;
  companyWebsite?: string | null;
  industry?: string | null;
  country?: string | null;
  countOrg?: number | null;
  publishedAt: string;
  workspaceId: string;
  hasOrgChartInS3: boolean;
  s3RelativePath?: string | null;
};

type AdminPublishedOrgChartsData = {
  adminPublishedOrgCharts: AdminPublishedOrgChartRow[];
};

type UpdateAdminPublishedOrgChartData = {
  updateAdminPublishedOrgChart: AdminPublishedOrgChartRow;
};

type RebuildAdminPublishedOrgChartData = {
  rebuildAdminPublishedOrgChart: AdminPublishedOrgChartRow;
};

type AddAdminPublishedOrgChartAliasData = {
  addAdminPublishedOrgChartAlias: AdminPublishedOrgChartRow;
};

type RenameAdminPublishedOrgChartSlugData = {
  renameAdminPublishedOrgChartSlug: AdminPublishedOrgChartRow;
};

type DeleteAdminPublishedOrgChartSlugData = {
  deleteAdminPublishedOrgChartSlug: boolean;
};

type EditableOrgChartDraft = {
  companyId: string;
  companyName: string;
  companyLinkedinUrl: string;
  companyWebsite: string;
  industry: string;
  country: string;
};

const StyledSection = styled(Section)`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledToolbar = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledTableScroll = styled.div`
  margin-top: ${themeCssVariables.spacing[2]};
  overflow-x: auto;
  width: 100%;
`;

const StyledTable = styled(Table)`
  min-width: 2400px;
  width: 100%;
`;

const StyledTableCell = styled(TableCell)`
  align-items: flex-start;
  height: auto;
  min-height: ${themeCssVariables.spacing[8]};
  padding-bottom: ${themeCssVariables.spacing[2]};
  padding-top: ${themeCssVariables.spacing[2]};
  vertical-align: top;
`;

const StyledReadOnlyCell = styled(StyledTableCell)`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledLink = styled.a`
  color: ${themeCssVariables.font.color.primary};
  text-decoration: underline;
`;

const StyledHint = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
  max-width: 960px;
`;

const StyledErrorMessage = styled.div`
  background: ${themeCssVariables.background.transparent.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.color.red};
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
  justify-content: flex-end;
`;

const StyledEmptyTableMessage = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
`;

const StyledSlugCell = styled(StyledTableCell)`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledAliasBadge = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledAliasInputRow = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
`;

const TABLE_GRID =
  'minmax(160px, 1fr) minmax(140px, 1fr) minmax(160px, 1.1fr) minmax(180px, 1.2fr) minmax(180px, 1.2fr) minmax(120px, 0.9fr) minmax(100px, 0.8fr) minmax(72px, 0.55fr) minmax(140px, 1fr) minmax(120px, 0.9fr) minmax(220px, 1.3fr) minmax(160px, 1fr)';

const DELETE_PUBLISH_SLUG_MODAL_ID =
  'settings-admin-published-org-charts-delete-slug';

const formatDt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const rowToDraft = (row: AdminPublishedOrgChartRow): EditableOrgChartDraft => ({
  companyId: row.companyId ?? '',
  companyName: row.companyName ?? '',
  companyLinkedinUrl: row.companyLinkedinUrl ?? '',
  companyWebsite: row.companyWebsite ?? '',
  industry: row.industry ?? '',
  country: row.country ?? '',
});

const draftsEqual = (
  left: EditableOrgChartDraft,
  right: EditableOrgChartDraft,
) =>
  left.companyId === right.companyId &&
  left.companyName === right.companyName &&
  left.companyLinkedinUrl === right.companyLinkedinUrl &&
  left.companyWebsite === right.companyWebsite &&
  left.industry === right.industry &&
  left.country === right.country;

export const SettingsAdminPublishedOrgCharts = () => {
  const apolloAdminClient = useApolloAdminClient();
  const { openModal } = useModal();
  const {
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
    enqueueInfoSnackBar,
  } = useSnackBar();
  const [draftsBySlug, setDraftsBySlug] = useState<
    Record<string, EditableOrgChartDraft>
  >({});
  const [slugDraftsBySlug, setSlugDraftsBySlug] = useState<
    Record<string, string>
  >({});
  const [aliasInputsBySourceSlug, setAliasInputsBySourceSlug] = useState<
    Record<string, string>
  >({});
  const [expandedAliasSourceSlug, setExpandedAliasSourceSlug] = useState<
    string | null
  >(null);
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [renamingSlug, setRenamingSlug] = useState<string | null>(null);
  const [addingAliasForSlug, setAddingAliasForSlug] = useState<string | null>(
    null,
  );
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const [deletePendingSlug, setDeletePendingSlug] = useState<string | null>(
    null,
  );
  const [rebuildingSlug, setRebuildingSlug] = useState<string | null>(null);

  const { data, loading, error, refetch } = useQuery<AdminPublishedOrgChartsData>(
    GET_ADMIN_PUBLISHED_ORG_CHARTS,
    { client: apolloAdminClient, fetchPolicy: 'network-only' },
  );

  const [updatePublishedOrgChart] = useMutation<UpdateAdminPublishedOrgChartData>(
    UPDATE_ADMIN_PUBLISHED_ORG_CHART,
    { client: apolloAdminClient },
  );

  const [rebuildPublishedOrgChart] = useMutation<RebuildAdminPublishedOrgChartData>(
    REBUILD_ADMIN_PUBLISHED_ORG_CHART,
    { client: apolloAdminClient },
  );

  const [addPublishedOrgChartAlias] =
    useMutation<AddAdminPublishedOrgChartAliasData>(
      ADD_ADMIN_PUBLISHED_ORG_CHART_ALIAS,
      { client: apolloAdminClient },
    );

  const [renamePublishedOrgChartSlug] =
    useMutation<RenameAdminPublishedOrgChartSlugData>(
      RENAME_ADMIN_PUBLISHED_ORG_CHART_SLUG,
      { client: apolloAdminClient },
    );

  const [deletePublishedOrgChartSlug] =
    useMutation<DeleteAdminPublishedOrgChartSlugData>(
      DELETE_ADMIN_PUBLISHED_ORG_CHART_SLUG,
      { client: apolloAdminClient },
    );

  const rows = data?.adminPublishedOrgCharts ?? [];
  const siteBase = getArxenaSiteBaseUrl();

  const aliasCountByCompanyId = useMemo(() => {
    const counts = new Map<string, number>();

    for (const row of rows) {
      const companyId = row.companyId.trim();
      if (!companyId) {
        continue;
      }
      counts.set(companyId, (counts.get(companyId) ?? 0) + 1);
    }

    return counts;
  }, [rows]);

  const getDraftForRow = (row: AdminPublishedOrgChartRow): EditableOrgChartDraft =>
    draftsBySlug[row.publishSlug] ?? rowToDraft(row);

  const getSlugDraftForRow = (row: AdminPublishedOrgChartRow): string =>
    slugDraftsBySlug[row.publishSlug] ?? row.publishSlug;

  const clearRowDraftState = (publishSlug: string) => {
    setDraftsBySlug((previous) => {
      const next = { ...previous };
      delete next[publishSlug];
      return next;
    });
    setSlugDraftsBySlug((previous) => {
      const next = { ...previous };
      delete next[publishSlug];
      return next;
    });
    setAliasInputsBySourceSlug((previous) => {
      const next = { ...previous };
      delete next[publishSlug];
      return next;
    });
    if (expandedAliasSourceSlug === publishSlug) {
      setExpandedAliasSourceSlug(null);
    }
  };

  const updateDraftField = (
    publishSlug: string,
    row: AdminPublishedOrgChartRow,
    field: keyof EditableOrgChartDraft,
    value: string,
  ) => {
    const currentDraft = getDraftForRow(row);

    setDraftsBySlug((previous) => ({
      ...previous,
      [publishSlug]: {
        ...currentDraft,
        [field]: value,
      },
    }));
  };

  const updateSlugDraft = (publishSlug: string, value: string) => {
    setSlugDraftsBySlug((previous) => ({
      ...previous,
      [publishSlug]: value,
    }));
  };

  const handleSaveRow = async (row: AdminPublishedOrgChartRow) => {
    const draft = getDraftForRow(row);
    const baseline = rowToDraft(row);

    if (draftsEqual(draft, baseline)) {
      enqueueInfoSnackBar({ message: 'No metadata changes to save' });
      return;
    }

    setSavingSlug(row.publishSlug);

    try {
      await updatePublishedOrgChart({
        variables: {
          input: {
            publishSlug: row.publishSlug,
            companyId: draft.companyId,
            companyName: draft.companyName,
            companyLinkedinUrl: draft.companyLinkedinUrl,
            companyWebsite: draft.companyWebsite,
            industry: draft.industry,
            country: draft.country,
          },
        },
      });

      enqueueSuccessSnackBar({ message: `Saved org chart metadata for ${row.publishSlug}` });

      clearRowDraftState(row.publishSlug);
      await refetch();
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : 'Failed to update published org chart';

      enqueueErrorSnackBar({ message });
    } finally {
      setSavingSlug(null);
    }
  };

  const handleRenameSlug = async (row: AdminPublishedOrgChartRow) => {
    const nextSlug = getSlugDraftForRow(row).trim();

    if (!nextSlug || nextSlug === row.publishSlug) {
      enqueueInfoSnackBar({ message: 'No slug changes to save' });
      return;
    }

    setRenamingSlug(row.publishSlug);

    try {
      await renamePublishedOrgChartSlug({
        variables: {
          input: {
            publishSlug: row.publishSlug,
            newPublishSlug: nextSlug,
          },
        },
      });

      enqueueSuccessSnackBar({ message: `Renamed publish slug ${row.publishSlug} → ${nextSlug}` });

      clearRowDraftState(row.publishSlug);
      await refetch();
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : 'Failed to rename publish slug';

      enqueueErrorSnackBar({ message });
    } finally {
      setRenamingSlug(null);
    }
  };

  const handleAddAlias = async (row: AdminPublishedOrgChartRow) => {
    const newPublishSlug = (aliasInputsBySourceSlug[row.publishSlug] ?? '').trim();

    if (!newPublishSlug) {
      enqueueErrorSnackBar({ message: 'Enter a new publish slug' });
      return;
    }

    setAddingAliasForSlug(row.publishSlug);

    try {
      await addPublishedOrgChartAlias({
        variables: {
          input: {
            sourcePublishSlug: row.publishSlug,
            newPublishSlug,
          },
        },
      });

      enqueueSuccessSnackBar({ message: `Added alias slug ${newPublishSlug}` });

      setAliasInputsBySourceSlug((previous) => {
        const next = { ...previous };
        delete next[row.publishSlug];
        return next;
      });
      setExpandedAliasSourceSlug(null);
      await refetch();
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : 'Failed to add publish slug alias';

      enqueueErrorSnackBar({ message });
    } finally {
      setAddingAliasForSlug(null);
    }
  };

  const handleConfirmDeleteSlug = async () => {
    if (!deletePendingSlug) {
      return;
    }

    setDeletingSlug(deletePendingSlug);

    try {
      await deletePublishedOrgChartSlug({
        variables: {
          publishSlug: deletePendingSlug,
        },
      });

      enqueueSuccessSnackBar({ message: `Removed publish slug ${deletePendingSlug}` });

      clearRowDraftState(deletePendingSlug);
      setDeletePendingSlug(null);
      await refetch();
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : 'Failed to delete publish slug';

      enqueueErrorSnackBar({ message });
    } finally {
      setDeletingSlug(null);
    }
  };

  const handleRebuildRow = async (row: AdminPublishedOrgChartRow) => {
    setRebuildingSlug(row.publishSlug);

    try {
      const { data: resultData } = await rebuildPublishedOrgChart({
        variables: {
          input: {
            publishSlug: row.publishSlug,
          },
        },
      });

      const rebuilt = resultData?.rebuildAdminPublishedOrgChart;

      enqueueSuccessSnackBar({
        message: rebuilt?.countOrg
          ? `Rebuilt org chart for ${row.publishSlug} (${rebuilt.countOrg} people)`
          : `Rebuilt org chart for ${row.publishSlug}`,
        options: { duration: 8000 },
      });

      clearRowDraftState(row.publishSlug);
      await refetch();
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : 'Failed to rebuild org chart';

      enqueueErrorSnackBar({
        message,
        options: { duration: 10000 },
      });
    } finally {
      setRebuildingSlug(null);
    }
  };

  const isRowBusy = (publishSlug: string) =>
    savingSlug === publishSlug ||
    renamingSlug === publishSlug ||
    addingAliasForSlug === publishSlug ||
    deletingSlug === publishSlug ||
    rebuildingSlug === publishSlug;

  return (
    <>
      <ConfirmationModal
        modalInstanceId={DELETE_PUBLISH_SLUG_MODAL_ID}
        title="Remove publish slug"
        subtitle={
          deletePendingSlug
            ? `Remove /org/${deletePendingSlug}? The org chart data in S3 is kept; only this public URL mapping is deleted.`
            : null
        }
        onConfirmClick={handleConfirmDeleteSlug}
        confirmButtonText="Remove slug"
        loading={deletingSlug !== null}
        onClose={() => setDeletePendingSlug(null)}
      />

      <StyledSection>
        <H2Title
          title="Published org charts"
          description="Public /org/{slug} links backed by orgchart.json in S3. Multiple slugs can point at the same chart."
        />

        <StyledHint>
          Each publish slug is a public URL alias for one org chart (company ID in
          S3). Add aliases when you want both /org/locus and /org/locus-sh to
          serve the same chart. Rename or remove slugs without deleting
          orgchart.json. Saving metadata updates S3 orgchart.json for all aliases
          sharing that company ID.
        </StyledHint>

        <StyledToolbar>
          <Button
            Icon={IconRefresh}
            variant="secondary"
            title="Refresh"
            onClick={() => refetch()}
            disabled={loading}
          />
        </StyledToolbar>

        {error && (
          <StyledErrorMessage>
            Failed to load published org charts: {error.message}
          </StyledErrorMessage>
        )}

        <StyledTableScroll>
          <StyledTable>
            <TableRow gridAutoColumns={TABLE_GRID}>
              <TableHeader>Publish slug</TableHeader>
              <TableHeader>Company ID</TableHeader>
              <TableHeader>Company name</TableHeader>
              <TableHeader>LinkedIn URL</TableHeader>
              <TableHeader>Website</TableHeader>
              <TableHeader>Industry</TableHeader>
              <TableHeader>Country</TableHeader>
              <TableHeader>People</TableHeader>
              <TableHeader>Published</TableHeader>
              <TableHeader>Public link</TableHeader>
              <TableHeader>S3 path</TableHeader>
              <TableHeader align="right">Actions</TableHeader>
            </TableRow>

            {loading && rows.length === 0 && (
              <TableRow gridAutoColumns={TABLE_GRID}>
                <StyledReadOnlyCell>Loading published org charts…</StyledReadOnlyCell>
              </TableRow>
            )}

            {!loading && rows.length === 0 && (
              <TableRow gridAutoColumns={TABLE_GRID}>
                <StyledReadOnlyCell>
                  <StyledEmptyTableMessage>
                    No published org charts found.
                  </StyledEmptyTableMessage>
                </StyledReadOnlyCell>
              </TableRow>
            )}

            {rows.map((row) => {
              const draft = getDraftForRow(row);
              const slugDraft = getSlugDraftForRow(row);
              const isMetadataDirty = !draftsEqual(draft, rowToDraft(row));
              const isSlugDirty = slugDraft.trim() !== row.publishSlug;
              const aliasCount = aliasCountByCompanyId.get(row.companyId.trim()) ?? 1;
              const publicUrl = `${siteBase}/org/${encodeURIComponent(row.publishSlug)}`;
              const isAliasExpanded = expandedAliasSourceSlug === row.publishSlug;
              const aliasInput = aliasInputsBySourceSlug[row.publishSlug] ?? '';
              const rowBusy = isRowBusy(row.publishSlug);

              return (
                <TableRow key={row.publishSlug} gridAutoColumns={TABLE_GRID}>
                  <StyledSlugCell>
                    <TextInput
                      value={slugDraft}
                      onChange={(value) => updateSlugDraft(row.publishSlug, value)}
                      fullWidth
                    />
                    {aliasCount > 1 ? (
                      <StyledAliasBadge>
                        {aliasCount} slugs share company ID {row.companyId}
                      </StyledAliasBadge>
                    ) : null}
                    {isSlugDirty ? (
                      <Button
                        variant="secondary"
                        title={
                          renamingSlug === row.publishSlug
                            ? 'Saving slug…'
                            : 'Save slug'
                        }
                        onClick={() => handleRenameSlug(row)}
                        disabled={rowBusy}
                      />
                    ) : null}
                    {isAliasExpanded ? (
                      <StyledAliasInputRow>
                        <TextInput
                          value={aliasInput}
                          onChange={(value) =>
                            setAliasInputsBySourceSlug((previous) => ({
                              ...previous,
                              [row.publishSlug]: value,
                            }))
                          }
                          placeholder="new-slug"
                          fullWidth
                        />
                        <Button
                          variant="secondary"
                          title={
                            addingAliasForSlug === row.publishSlug
                              ? 'Adding…'
                              : 'Create'
                          }
                          onClick={() => handleAddAlias(row)}
                          disabled={rowBusy}
                        />
                        <Button
                          variant="tertiary"
                          title="Cancel"
                          onClick={() => {
                            setExpandedAliasSourceSlug(null);
                            setAliasInputsBySourceSlug((previous) => {
                              const next = { ...previous };
                              delete next[row.publishSlug];
                              return next;
                            });
                          }}
                          disabled={rowBusy}
                        />
                      </StyledAliasInputRow>
                    ) : (
                      <Button
                        variant="tertiary"
                        title="Add alias slug"
                        onClick={() => setExpandedAliasSourceSlug(row.publishSlug)}
                        disabled={rowBusy}
                      />
                    )}
                  </StyledSlugCell>
                  <StyledTableCell>
                    <TextInput
                      value={draft.companyId}
                      onChange={(value) =>
                        updateDraftField(row.publishSlug, row, 'companyId', value)
                      }
                      fullWidth
                    />
                  </StyledTableCell>
                  <StyledTableCell>
                    <TextInput
                      value={draft.companyName}
                      onChange={(value) =>
                        updateDraftField(row.publishSlug, row, 'companyName', value)
                      }
                      fullWidth
                    />
                  </StyledTableCell>
                  <StyledTableCell>
                    <TextInput
                      value={draft.companyLinkedinUrl}
                      onChange={(value) =>
                        updateDraftField(
                          row.publishSlug,
                          row,
                          'companyLinkedinUrl',
                          value,
                        )
                      }
                      fullWidth
                    />
                  </StyledTableCell>
                  <StyledTableCell>
                    <TextInput
                      value={draft.companyWebsite}
                      onChange={(value) =>
                        updateDraftField(
                          row.publishSlug,
                          row,
                          'companyWebsite',
                          value,
                        )
                      }
                      fullWidth
                    />
                  </StyledTableCell>
                  <StyledTableCell>
                    <TextInput
                      value={draft.industry}
                      onChange={(value) =>
                        updateDraftField(row.publishSlug, row, 'industry', value)
                      }
                      fullWidth
                    />
                  </StyledTableCell>
                  <StyledTableCell>
                    <TextInput
                      value={draft.country}
                      onChange={(value) =>
                        updateDraftField(row.publishSlug, row, 'country', value)
                      }
                      fullWidth
                    />
                  </StyledTableCell>
                  <StyledReadOnlyCell>
                    {row.countOrg ?? '—'}
                    {!row.hasOrgChartInS3 ? ' (missing S3)' : ''}
                  </StyledReadOnlyCell>
                  <StyledReadOnlyCell>{formatDt(row.publishedAt)}</StyledReadOnlyCell>
                  <StyledReadOnlyCell>
                    <StyledLink href={publicUrl} target="_blank" rel="noreferrer">
                      {publicUrl}
                    </StyledLink>
                  </StyledReadOnlyCell>
                  <StyledReadOnlyCell>{row.s3RelativePath ?? '—'}</StyledReadOnlyCell>
                  <StyledTableCell align="right">
                    <StyledActions>
                      <Button
                        variant="secondary"
                        title={
                          rebuildingSlug === row.publishSlug
                            ? 'Rebuilding…'
                            : 'Rebuild org chart'
                        }
                        onClick={() => handleRebuildRow(row)}
                        disabled={rowBusy}
                      />
                      <Button
                        variant="secondary"
                        title={
                          savingSlug === row.publishSlug
                            ? 'Saving…'
                            : 'Save metadata'
                        }
                        onClick={() => handleSaveRow(row)}
                        disabled={!isMetadataDirty || rowBusy}
                      />
                      <Button
                        accent="danger"
                        variant="secondary"
                        title="Remove slug"
                        Icon={IconTrash}
                        onClick={() => {
                          setDeletePendingSlug(row.publishSlug);
                          openModal(DELETE_PUBLISH_SLUG_MODAL_ID);
                        }}
                        disabled={rowBusy}
                      />
                    </StyledActions>
                  </StyledTableCell>
                </TableRow>
              );
            })}
          </StyledTable>
        </StyledTableScroll>
      </StyledSection>
    </>
  );
};
