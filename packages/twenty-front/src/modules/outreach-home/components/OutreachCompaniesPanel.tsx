import { styled } from '@linaria/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { Loader } from 'twenty-ui/feedback';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { ProjectTopBar } from '@/candidate-table/components/ProjectTopBar';
import { TableContainer } from '@/candidate-table/components/styled';
import { chatSearchQueryState } from '@/candidate-table/states/chatSearchQueryState';
import {
    OutreachDetailsTable,
    type OutreachTableData,
} from '@/outreach-home/components/OutreachDetailsTable';
import { type OutreachCompanyRow } from '@/outreach-home/types/outreach-home.types';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';

const StyledPanel = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  position: relative;
`;

const StyledEmpty = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.5;
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledLoading = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: center;
  min-height: 240px;
  padding: ${themeCssVariables.spacing[6]};
`;

const StyledStatusFilters = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
  min-width: 0;
`;

const StyledStatusChip = styled.button<{ isActive: boolean }>`
  background: ${({ isActive }) =>
    isActive
      ? themeCssVariables.background.quaternary
      : themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.xs};
  height: 24px;
  padding: ${`${themeCssVariables.spacing[0.5]} ${themeCssVariables.spacing[2]}`};
  white-space: nowrap;

  &:hover {
    border-color: ${themeCssVariables.border.color.medium};
    color: ${themeCssVariables.font.color.primary};
  }
`;

const StyledTableFill = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
  padding: ${themeCssVariables.spacing[2]};
`;

type OutreachCompaniesPanelProps = {
  companies: OutreachCompanyRow[];
  selectedCompanyId: string | null;
  onSelectCompanyId: (companyId: string | null) => void;
  isLoading?: boolean;
  onRefresh?: () => Promise<void>;
};

export const OutreachCompaniesPanel = ({
  companies,
  selectedCompanyId,
  onSelectCompanyId,
  isLoading = false,
  onRefresh,
}: OutreachCompaniesPanelProps) => {
  const setChatSearchQuery = useSetAtomState(chatSearchQueryState);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);

  useEffect(() => {
    setChatSearchQuery('');
    setSearchQuery('');

    return () => {
      setChatSearchQuery('');
    };
  }, [setChatSearchQuery]);

  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();

    for (const company of companies) {
      if (isDefined(company.status) && company.status.trim().length > 0) {
        statuses.add(company.status);
      }
    }

    return Array.from(statuses).sort((left, right) =>
      left.localeCompare(right),
    );
  }, [companies]);

  const filteredCompanies = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return companies.filter((company) => {
      if (statusFilter !== 'all' && company.status !== statusFilter) {
        return false;
      }

      if (normalizedQuery.length === 0) {
        return true;
      }

      const haystack =
        `${company.name} ${company.domain} ${company.industry} ${company.segment} ${company.icpFit} ${company.status}`.toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [companies, searchQuery, statusFilter]);

  const tableData: OutreachTableData = useMemo(
    () => ({
      tableType: 'data',
      label: 'Target companies (ephemeral)',
      columns: [
        'name',
        'domain',
        'industry',
        'employees',
        'segment',
        'icpFit',
        'status',
      ],
      rows: filteredCompanies,
    }),
    [filteredCompanies],
  );

  const primarySelectedIndex = filteredCompanies.findIndex(
    (company) => company.id === selectedCompanyId,
  );

  const handleToggleCompany = useCallback(
    (rowIndex: number) => {
      const company = filteredCompanies[rowIndex];

      if (!company) {
        return;
      }

      onSelectCompanyId(company.id);
      setSelectedCompanyIds((previous) => {
        if (previous.includes(company.id)) {
          return previous.filter((companyId) => companyId !== company.id);
        }

        return [...previous, company.id];
      });
    },
    [filteredCompanies, onSelectCompanyId],
  );

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);

    try {
      await (onRefresh?.() ?? Promise.resolve());
      enqueueSuccessSnackBar({ message: 'Companies list refreshed' });
    } catch {
      enqueueErrorSnackBar({ message: 'Failed to refresh companies list' });
    } finally {
      setIsRefreshing(false);
    }
  }, [
    enqueueErrorSnackBar,
    enqueueSuccessSnackBar,
    isRefreshing,
    onRefresh,
  ]);

  const handleClearFilters = useCallback(() => {
    setStatusFilter('all');
    setSearchQuery('');
    setChatSearchQuery('');
    setSelectedCompanyIds([]);
    onSelectCompanyId(null);
  }, [onSelectCompanyId, setChatSearchQuery]);

  const statusFilterChips = (
    <StyledStatusFilters>
      <StyledStatusChip
        type="button"
        isActive={statusFilter === 'all'}
        onClick={() => setStatusFilter('all')}
      >
        All statuses
      </StyledStatusChip>
      {statusOptions.map((status) => (
        <StyledStatusChip
          key={status}
          type="button"
          isActive={statusFilter === status}
          onClick={() => setStatusFilter(status)}
        >
          {status}
        </StyledStatusChip>
      ))}
      {selectedCompanyIds.length > 0 && (
        <StyledStatusChip
          type="button"
          isActive={false}
          onClick={() => {
            setSelectedCompanyIds([]);
            onSelectCompanyId(null);
          }}
        >
          {selectedCompanyIds.length} selected · Clear
        </StyledStatusChip>
      )}
    </StyledStatusFilters>
  );

  if (isLoading && companies.length === 0) {
    return (
      <StyledLoading>
        <Loader />
        Loading companies…
      </StyledLoading>
    );
  }

  return (
    <StyledPanel>
      <ProjectTopBar
        showSearch={true}
        searchPlaceholder="Search companies..."
        onSearch={setSearchQuery}
        showRefetch={true}
        onRefresh={() => {
          void handleRefresh();
        }}
        isRefreshing={isRefreshing}
        showClearAll={true}
        onClearAll={handleClearFilters}
        showJobStatusToggle={false}
        showFilterChips={false}
        showRedirectToObject={false}
        showImportCandidates={false}
        showStatistics={false}
        showAddJob={false}
        showEnrichment={false}
        showSorting={false}
        showValidateJobData={false}
        showBatchActions={false}
        centerComponent={statusFilterChips}
      />

      {companies.length === 0 ? (
        <StyledEmpty>
          No target companies in this project yet. Use Setup → Find companies
          (Ask AI) to discover accounts from your ICP search blurb. They stay
          on the Companies tab until you enroll people, which creates Company
          and Person records (plus enrollment) under this Project.
        </StyledEmpty>
      ) : filteredCompanies.length === 0 ? (
        <StyledEmpty>
          No companies match the current search or status filter.
        </StyledEmpty>
      ) : (
        <TableContainer>
          <StyledTableFill>
            <OutreachDetailsTable
              data={tableData}
              maxHeight={720}
              selectedRowIndex={
                primarySelectedIndex >= 0 ? primarySelectedIndex : undefined
              }
              onSelectRow={handleToggleCompany}
            />
          </StyledTableFill>
        </TableContainer>
      )}
    </StyledPanel>
  );
};
