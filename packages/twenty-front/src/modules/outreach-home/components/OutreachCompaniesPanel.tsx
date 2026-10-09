import { styled } from '@linaria/react';
import { isNonEmptyString } from '@sniptt/guards';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getLogoUrlFromDomainName } from 'twenty-shared/utils';
import { Loader } from 'twenty-ui/feedback';
import {
  IconBuildingSkyscraper,
  IconDatabase,
  IconTag,
  IconFileImport,
  IconFilterOff,
  IconLink,
  IconRefresh,
  IconStatusChange,
  IconTarget,
  IconTargetArrow,
  IconUsers,
} from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { chatSearchQueryState } from '@/candidate-table/states/chatSearchQueryState';
import { useOpenObjectRecordsSpreadsheetImportDialog } from '@/object-record/spreadsheet-import/hooks/useOpenObjectRecordsSpreadsheetImportDialog';
import {
  OutreachRecordTable,
  type OutreachRecordTableColumn,
} from '@/outreach-home/components/record-table/OutreachRecordTable';
import {
  OutreachLinkCell,
  OutreachRecordChipCell,
  OutreachTagCell,
  OutreachTextCell,
} from '@/outreach-home/components/record-table/OutreachRecordTableCells';
import { type OutreachRecordCard } from '@/outreach-home/components/record-table/OutreachRecordCardList';
import { appendOutreachRawJsonColumns } from '@/outreach-home/components/record-table/appendOutreachRawJsonColumns';
import { OutreachAiViewBar } from '@/outreach-home/components/OutreachAiViewBar';
import { useSaveOutreachTargetsToCrm } from '@/outreach-home/hooks/useSaveOutreachTargetsToCrm';
import { useOutreachAiTableView } from '@/outreach-home/hooks/useOutreachAiTableView';
import { type OutreachTableView } from '@/outreach-home/constants/outreach-cache-realtime.constants';
import { OutreachTableEmptyState } from '@/outreach-home/components/record-table/OutreachTableEmptyState';
import {
  OutreachViewBar,
  OutreachViewBarIconAction,
  OutreachViewBarPill,
} from '@/outreach-home/components/record-table/OutreachViewBar';
import { useOutreachTablePresentation } from '@/outreach-home/hooks/useOutreachTablePresentation';
import { type OutreachCompanyRow } from '@/outreach-home/types/outreach-home.types';
import { mapCrmCompanyRecordsToOutreachCompanyRows } from '@/outreach-home/utils/map-crm-record-to-outreach-row.util';
import {
  getFreeTextTagColor,
  getIcpFitTagColor,
} from '@/outreach-home/utils/outreachTagColors';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

const StyledPanel = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
`;

const StyledLoading = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: center;
  min-height: 240px;
`;

const COMPANY_COLUMNS: OutreachRecordTableColumn<OutreachCompanyRow>[] = [
  {
    id: 'name',
    label: 'Name',
    Icon: IconBuildingSkyscraper,
    width: 220,
    sortValue: (company) => company.name,
    render: (company) => (
      <OutreachRecordChipCell
        name={company.name}
        avatarType="squared"
        avatarUrl={getLogoUrlFromDomainName(
          company.domain,
          REACT_APP_SERVER_BASE_URL,
        )}
      />
    ),
  },
  {
    id: 'domain',
    label: 'Domain',
    Icon: IconLink,
    width: 180,
    sortValue: (company) => company.domain,
    render: (company) => <OutreachLinkCell url={company.domain} />,
  },
  {
    id: 'industry',
    label: 'Industry',
    Icon: IconTag,
    width: 200,
    sortValue: (company) => company.industry,
    render: (company) => <OutreachTextCell value={company.industry} />,
  },
  {
    id: 'employees',
    label: 'Employees',
    Icon: IconUsers,
    width: 120,
    sortValue: (company) => {
      const employeeCount = Number.parseInt(company.employees, 10);

      return Number.isFinite(employeeCount) ? employeeCount : company.employees;
    },
    render: (company) => <OutreachTextCell value={company.employees} />,
  },
  {
    id: 'segment',
    label: 'Segment',
    Icon: IconTarget,
    width: 170,
    sortValue: (company) => company.segment,
    render: (company) => <OutreachTextCell value={company.segment} />,
  },
  {
    id: 'icpFit',
    label: 'ICP fit',
    Icon: IconTargetArrow,
    width: 140,
    sortValue: (company) => company.icpFit,
    render: (company) =>
      isNonEmptyString(company.icpFit) ? (
        <OutreachTagCell
          label={company.icpFit}
          color={getIcpFitTagColor(company.icpFit)}
        />
      ) : null,
  },
  {
    id: 'status',
    label: 'Status',
    Icon: IconStatusChange,
    width: 150,
    sortValue: (company) => company.status,
    render: (company) =>
      isNonEmptyString(company.status) ? (
        <OutreachTagCell
          label={company.status}
          color={getFreeTextTagColor(company.status)}
        />
      ) : null,
  },
];

const getCompanyMobileCard = (
  company: OutreachCompanyRow,
): OutreachRecordCard => ({
  title: company.name,
  avatarType: 'squared',
  avatarUrl: getLogoUrlFromDomainName(
    company.domain,
    REACT_APP_SERVER_BASE_URL,
  ),
  subtitle: [
    company.industry,
    isNonEmptyString(company.employees) ? `${company.employees} employees` : '',
  ]
    .filter((part) => isNonEmptyString(part))
    .join(' · '),
  status: isNonEmptyString(company.status) ? (
    <OutreachTagCell
      label={company.status}
      color={getFreeTextTagColor(company.status)}
    />
  ) : undefined,
  footer:
    isNonEmptyString(company.icpFit) || isNonEmptyString(company.domain) ? (
      <>
        {isNonEmptyString(company.icpFit) && (
          <OutreachTagCell
            label={`ICP fit: ${company.icpFit}`}
            color={getIcpFitTagColor(company.icpFit)}
          />
        )}
        <OutreachTextCell value={company.domain} isMuted />
      </>
    ) : undefined,
});

type OutreachCompaniesPanelProps = {
  companies: OutreachCompanyRow[];
  projectId: string | null | undefined;
  selectedCompanyId: string | null;
  onSelectCompanyId: (companyId: string | null) => void;
  isLoading?: boolean;
  onRefresh?: () => Promise<void>;
  appendCompanies?: (companiesToAdd: OutreachCompanyRow[]) => Promise<void>;
  aiTableView?: OutreachTableView | null;
};

export const OutreachCompaniesPanel = ({
  companies,
  projectId,
  selectedCompanyId,
  onSelectCompanyId,
  isLoading = false,
  onRefresh,
  appendCompanies,
  aiTableView,
}: OutreachCompaniesPanelProps) => {
  const setChatSearchQuery = useSetAtomState(chatSearchQueryState);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const { isSaving, saveTargetsToCrm } = useSaveOutreachTargetsToCrm();
  const {
    columnLayout,
    persistLayout,
    columnFilters,
    persistFilters,
    clearColumnFilters,
  } = useOutreachTablePresentation(projectId, 'companies');
  const { externalSort, activeView, clearAiView } = useOutreachAiTableView({
    projectId,
    tab: 'companies',
    view: aiTableView,
    persistFilters,
  });

  const { openObjectRecordsSpreadsheetImportDialog } =
    useOpenObjectRecordsSpreadsheetImportDialog('company');

  const handleImportCompanies = useCallback(() => {
    openObjectRecordsSpreadsheetImportDialog({
      onRecordsCreated: async (createdRecords) => {
        const mappedCompanies =
          mapCrmCompanyRecordsToOutreachCompanyRows(createdRecords);

        if (mappedCompanies.length === 0) {
          return;
        }

        await appendCompanies?.(mappedCompanies);
        await onRefresh?.();
      },
    });
  }, [appendCompanies, onRefresh, openObjectRecordsSpreadsheetImportDialog]);

  useEffect(() => {
    setChatSearchQuery('');
    setSearchQuery('');

    return () => {
      setChatSearchQuery('');
    };
  }, [setChatSearchQuery]);

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const company of companies) {
      if (isNonEmptyString(company.status?.trim())) {
        counts.set(company.status, (counts.get(company.status) ?? 0) + 1);
      }
    }

    return [...counts.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    );
  }, [companies]);

  const companyColumns = useMemo(
    () => appendOutreachRawJsonColumns(COMPANY_COLUMNS, companies, columnLayout),
    [companies, columnLayout],
  );

  const filteredCompanies = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return companies.filter((company) => {
      if (statusFilter !== 'all' && company.status !== statusFilter) {
        return false;
      }

      if (normalizedQuery.length === 0) {
        return true;
      }

      return `${company.name} ${company.domain} ${company.industry} ${company.segment} ${company.icpFit} ${company.status}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [companies, searchQuery, statusFilter]);

  // Clicking a company scopes the People tab to it; clicking again clears it
  const handleRowClick = useCallback(
    (company: OutreachCompanyRow) => {
      onSelectCompanyId(company.id === selectedCompanyId ? null : company.id);
    },
    [onSelectCompanyId, selectedCompanyId],
  );

  const handleSelectedRowIdsChange = useCallback(
    (rowIds: string[]) => {
      setSelectedCompanyIds(rowIds);

      if (rowIds.length === 1) {
        onSelectCompanyId(rowIds[0]);
      } else if (rowIds.length === 0) {
        onSelectCompanyId(null);
      }
    },
    [onSelectCompanyId],
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
  }, [enqueueErrorSnackBar, enqueueSuccessSnackBar, isRefreshing, onRefresh]);

  const hasActiveFilter =
    statusFilter !== 'all' ||
    searchQuery.trim().length > 0 ||
    selectedCompanyIds.length > 0;

  const handleClearFilters = () => {
    clearColumnFilters();
    setStatusFilter('all');
    setSearchQuery('');
    setChatSearchQuery('');
    setSelectedCompanyIds([]);
    onSelectCompanyId(null);
  };

  if (isLoading && companies.length === 0) {
    return (
      <StyledLoading>
        <Loader />
        Loading companies…
      </StyledLoading>
    );
  }

  const pills = (
    <>
      <OutreachViewBarPill
        label="All"
        count={companies.length}
        isActive={statusFilter === 'all'}
        onClick={() => setStatusFilter('all')}
      />
      {statusCounts.map(([status, count]) => (
        <OutreachViewBarPill
          key={status}
          label={status}
          count={count}
          isActive={statusFilter === status}
          onClick={() => setStatusFilter(status)}
        />
      ))}
    </>
  );

  const actions = (
    <>
      {hasActiveFilter && (
        <OutreachViewBarIconAction
          title="Clear filters and selection"
          Icon={IconFilterOff}
          onClick={handleClearFilters}
        />
      )}
      <OutreachViewBarIconAction
        title={isRefreshing ? 'Refreshing…' : 'Refresh'}
        Icon={IconRefresh}
        disabled={isRefreshing}
        onClick={() => {
          void handleRefresh();
        }}
      />
      <OutreachViewBarIconAction
        title="Import companies"
        Icon={IconFileImport}
        onClick={handleImportCompanies}
      />
      <OutreachViewBarIconAction
        title={
          selectedCompanyIds.length > 0
            ? `Save selected to CRM (${selectedCompanyIds.length})`
            : 'Save all to CRM'
        }
        Icon={IconDatabase}
        disabled={isSaving}
        onClick={() => {
          void saveTargetsToCrm({
            target: 'companies',
            companyIds:
              selectedCompanyIds.length > 0 ? selectedCompanyIds : undefined,
          });
        }}
      />
    </>
  );

  return (
    <StyledPanel>
      <OutreachViewBar
        pills={pills}
        searchValue={searchQuery}
        searchPlaceholder="Search companies"
        onSearchChange={setSearchQuery}
        actions={actions}
      />
      <OutreachAiViewBar
        view={activeView}
        getColumnLabel={(columnId) =>
          companyColumns.find((column) => column.id === columnId)?.label ??
          columnId
        }
        onClear={clearAiView}
      />
      {companies.length === 0 ? (
        <OutreachTableEmptyState
          title="No target companies yet"
          description="Use Setup → Find companies (Ask AI) to discover accounts from your ICP. They stay here until you enroll people, which creates the CRM Company and Person records."
        />
      ) : filteredCompanies.length === 0 ? (
        <OutreachTableEmptyState
          title="No companies match"
          description="Try another status filter or search term."
          onClearFilters={handleClearFilters}
        />
      ) : (
        <OutreachRecordTable
          rows={filteredCompanies}
          columns={companyColumns}
          getRowId={(company) => company.id}
          selectedRowIds={selectedCompanyIds}
          activeRowId={selectedCompanyId}
          onSelectedRowIdsChange={handleSelectedRowIdsChange}
          onRowClick={handleRowClick}
          getMobileCard={getCompanyMobileCard}
          columnLayout={columnLayout}
          onColumnLayoutChange={persistLayout}
          columnFilters={columnFilters}
          onColumnFiltersChange={persistFilters}
          externalSort={externalSort}
        />
      )}
    </StyledPanel>
  );
};
