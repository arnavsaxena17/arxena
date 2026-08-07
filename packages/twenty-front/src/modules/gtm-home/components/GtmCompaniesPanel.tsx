import { Suspense, lazy, useMemo, useState } from 'react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { Loader } from 'twenty-ui/feedback';
import { Button } from 'twenty-ui/input';

import { type AssistantTableData } from '@/assistant/components/AssistantDetailsTable';
import { type GtmCompanyRow } from '@/gtm-home/types/gtm-home.types';

const AssistantDetailsTable = lazy(() =>
  import('@/assistant/components/AssistantDetailsTable').then((module) => ({
    default: module.AssistantDetailsTable,
  })),
);

const StyledPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  height: 100%;
`;

const StyledEmpty = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[4]};
  line-height: 1.5;
`;

const StyledActions = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  flex-wrap: wrap;
`;

const StyledHint = styled.div`
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.secondary};
`;

type GtmCompaniesPanelProps = {
  companies: GtmCompanyRow[];
  selectedCompanyId: string | null;
  selectedSegmentId: string | null;
  onSelectCompanyId: (companyId: string | null) => void;
};

export const GtmCompaniesPanel = ({
  companies,
  selectedCompanyId,
  selectedSegmentId,
  onSelectCompanyId,
}: GtmCompaniesPanelProps) => {
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);

  const filteredCompanies = useMemo(
    () =>
      selectedSegmentId
        ? companies.filter(
            (company) =>
              company.segment.toLowerCase().replace(/\s+/g, '-') ===
              selectedSegmentId,
          )
        : companies,
    [companies, selectedSegmentId],
  );

  if (filteredCompanies.length === 0) {
    return (
      <StyledEmpty>
        No target companies in this GTM run yet. Use Ask AI to discover
        accounts — they stay ephemeral (Redis) until you enroll people, which
        creates CRM Company + Candidate under this Project.
      </StyledEmpty>
    );
  }

  const tableData: AssistantTableData = {
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
  };

  const primarySelectedIndex = filteredCompanies.findIndex(
    (company) => company.id === selectedCompanyId,
  );

  const handleToggleCompany = (rowIndex: number) => {
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
  };

  return (
    <StyledPanel>
      <StyledHint>
        Ephemeral list for this Project (Redis). CRM Company rows are created
        when people from these accounts are enrolled / added to CRM.
      </StyledHint>
      <StyledActions>
        {selectedCompanyIds.length > 0 && (
          <Button
            title="Clear selection"
            size="small"
            variant="secondary"
            onClick={() => {
              setSelectedCompanyIds([]);
              onSelectCompanyId(null);
            }}
          />
        )}
      </StyledActions>
      <Suspense fallback={<Loader />}>
        <AssistantDetailsTable
          data={tableData}
          maxHeight={420}
          selectedRowIndex={
            primarySelectedIndex >= 0 ? primarySelectedIndex : undefined
          }
          onSelectRow={handleToggleCompany}
        />
      </Suspense>
    </StyledPanel>
  );
};
