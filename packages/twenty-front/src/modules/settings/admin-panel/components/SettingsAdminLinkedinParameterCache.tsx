import { Button, H2Title, Section } from 'twenty-ui';
import { IconRefresh, IconTrash } from 'twenty-ui/icons';
import {
  CLEAR_ADMIN_LINKEDIN_PARAMETER_CACHE,
  DELETE_ADMIN_LINKEDIN_PARAMETER_CACHE_ENTRY,
} from '@/settings/admin-panel/graphql/mutations/adminLinkedinParameterCache';
import { GET_ADMIN_LINKEDIN_PARAMETER_CACHE_ENTRIES } from '@/settings/admin-panel/graphql/queries/getAdminLinkedinParameterCacheEntries';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TextInput } from '@/ui/input/components/TextInput';
import { Table } from '@/ui/layout/table/components/Table';
import { TableCell } from '@/ui/layout/table/components/TableCell';
import { TableHeader } from '@/ui/layout/table/components/TableHeader';
import { TableRow } from '@/ui/layout/table/components/TableRow';
import { useMutation, useQuery } from '@apollo/client';
import styled from '@emotion/styled';
import { useMemo, useState } from 'react';

type LinkedinParameterCacheEntryRow = {
  cacheKey: string;
  parameterType: string;
  searchTerm: string;
  linkedinId?: string | null;
  linkedinTitle?: string | null;
  notFound: boolean;
};

type GetAdminLinkedinParameterCacheEntriesData = {
  adminLinkedinParameterCacheEntries: LinkedinParameterCacheEntryRow[];
};

const StyledSection = styled(Section)`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledToolbar = styled.div`
  align-items: flex-end;
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  justify-content: flex-end;
`;

const StyledTable = styled(Table)`
  margin-top: ${({ theme }) => theme.spacing(2)};
`;

const StyledHint = styled.p`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  margin: 0;
`;

const StyledNotFound = styled.span`
  color: ${({ theme }) => theme.font.color.danger};
`;

export const SettingsAdminLinkedinParameterCache = () => {
  const { enqueueSnackBar } = useSnackBar();
  const [filterText, setFilterText] = useState('');
  const [deletingCacheKey, setDeletingCacheKey] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const { data, loading, refetch } =
    useQuery<GetAdminLinkedinParameterCacheEntriesData>(
      GET_ADMIN_LINKEDIN_PARAMETER_CACHE_ENTRIES,
      {
        fetchPolicy: 'network-only',
      },
    );

  const [deleteEntry] = useMutation(DELETE_ADMIN_LINKEDIN_PARAMETER_CACHE_ENTRY);
  const [clearCache] = useMutation(CLEAR_ADMIN_LINKEDIN_PARAMETER_CACHE);

  const rows = data?.adminLinkedinParameterCacheEntries ?? [];

  const filteredRows = useMemo(() => {
    const normalizedFilter = filterText.trim().toLowerCase();
    if (!normalizedFilter) {
      return rows;
    }

    return rows.filter((row) => {
      const haystack = [
        row.cacheKey,
        row.parameterType,
        row.searchTerm,
        row.linkedinId ?? '',
        row.linkedinTitle ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedFilter);
    });
  }, [filterText, rows]);

  const handleDelete = async (cacheKey: string) => {
    setDeletingCacheKey(cacheKey);
    try {
      const result = await deleteEntry({
        variables: { cacheKey },
        refetchQueries: [GET_ADMIN_LINKEDIN_PARAMETER_CACHE_ENTRIES],
      });

      if (!result.data?.adminDeleteLinkedinParameterCacheEntry) {
        throw new Error('Cache entry not found');
      }

      enqueueSnackBar(`Deleted cache entry ${cacheKey}`, {
        variant: SnackBarVariant.Success,
      });
    } catch (error) {
      enqueueSnackBar(
        error instanceof Error ? error.message : 'Failed to delete cache entry',
        { variant: SnackBarVariant.Error },
      );
    } finally {
      setDeletingCacheKey(null);
    }
  };

  const handleClearAll = async () => {
    if (isClearing || rows.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Delete all ${rows.length} LinkedIn parameter cache entries?`,
    );
    if (!confirmed) {
      return;
    }

    setIsClearing(true);
    try {
      const result = await clearCache({
        refetchQueries: [GET_ADMIN_LINKEDIN_PARAMETER_CACHE_ENTRIES],
      });
      const deletedCount = result.data?.adminClearLinkedinParameterCache ?? 0;

      enqueueSnackBar(`Cleared ${deletedCount} cache entries`, {
        variant: SnackBarVariant.Success,
      });
    } catch (error) {
      enqueueSnackBar(
        error instanceof Error ? error.message : 'Failed to clear cache',
        { variant: SnackBarVariant.Error },
      );
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <StyledSection>
      <H2Title
        title="LinkedIn parameter cache"
        description="Resolved LinkedIn facet lookups (company, location, school, industry) cached on the server. Delete stale entries when a slug resolves to the wrong company."
      />
      <StyledHint>
        Example: deleting <code>COMPANY_hinduja-hospital</code> forces a fresh
        Unipile lookup on the next org-chart or super-impose search.
      </StyledHint>

      <StyledToolbar>
        <TextInput
          value={filterText}
          onChange={setFilterText}
          placeholder="Filter by search term, type, LinkedIn id, or title"
          fullWidth
        />
        <Button
          Icon={IconRefresh}
          variant="secondary"
          title="Refresh"
          onClick={() => {
            void refetch();
          }}
          disabled={loading}
        />
        <Button
          Icon={IconTrash}
          variant="secondary"
          accent="danger"
          title="Clear all"
          onClick={() => {
            void handleClearAll();
          }}
          disabled={loading || isClearing || rows.length === 0}
        >
          {isClearing ? 'Clearing...' : 'Clear all'}
        </Button>
      </StyledToolbar>

      <StyledTable>
        <TableRow gridAutoColumns="120px 1fr 1fr 1fr 120px 80px">
          <TableHeader>Type</TableHeader>
          <TableHeader>Search term</TableHeader>
          <TableHeader>LinkedIn id</TableHeader>
          <TableHeader>LinkedIn title</TableHeader>
          <TableHeader>Status</TableHeader>
          <TableHeader align="right">Actions</TableHeader>
        </TableRow>

        {loading && (
          <TableRow>
            <TableCell>Loading cache entries...</TableCell>
          </TableRow>
        )}

        {!loading && filteredRows.length === 0 && (
          <TableRow>
            <TableCell>No cache entries match the current filter.</TableCell>
          </TableRow>
        )}

        {!loading &&
          filteredRows.map((row) => (
            <TableRow
              key={row.cacheKey}
              gridAutoColumns="120px 1fr 1fr 1fr 120px 80px"
            >
              <TableCell>{row.parameterType}</TableCell>
              <TableCell>{row.searchTerm}</TableCell>
              <TableCell>{row.linkedinId ?? '—'}</TableCell>
              <TableCell>{row.linkedinTitle ?? '—'}</TableCell>
              <TableCell>
                {row.notFound ? (
                  <StyledNotFound>Not found</StyledNotFound>
                ) : (
                  'Resolved'
                )}
              </TableCell>
              <TableCell align="right">
                <StyledActions>
                  <Button
                    Icon={IconTrash}
                    variant="tertiary"
                    accent="danger"
                    size="small"
                    title="Delete"
                    onClick={() => {
                      void handleDelete(row.cacheKey);
                    }}
                    disabled={deletingCacheKey === row.cacheKey}
                  />
                </StyledActions>
              </TableCell>
            </TableRow>
          ))}
      </StyledTable>
    </StyledSection>
  );
};
