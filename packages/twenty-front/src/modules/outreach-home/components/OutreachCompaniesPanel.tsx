import { useState } from 'react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { Button } from 'twenty-ui/input';

import {
  OutreachDetailsTable,
  type OutreachTableData,
} from '@/outreach-home/components/OutreachDetailsTable';
import { type OutreachCompanyRow } from '@/outreach-home/types/outreach-home.types';

const StyledPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  height: 100%;
`;

const StyledEmpty = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.5;
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledHint = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
`;

type OutreachCompaniesPanelProps = {
  companies: OutreachCompanyRow[];
  selectedCompanyId: string | null;
  onSelectCompanyId: (companyId: string | null) => void;
};

export const OutreachCompaniesPanel = ({
  companies,
  selectedCompanyId,
  onSelectCompanyId,
}: OutreachCompaniesPanelProps) => {
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);

  if (companies.length === 0) {
    return (
      <StyledEmpty>
        No target companies in this project yet. Use Setup → Find companies
        (Ask AI) to discover accounts from your ICP search blurb. They stay
        on the Companies tab until you enroll people, which creates Company and
        Person records (plus enrollment) under this Project.
      </StyledEmpty>
    );
  }

  const tableData: OutreachTableData = {
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
    rows: companies,
  };

  const primarySelectedIndex = companies.findIndex(
    (company) => company.id === selectedCompanyId,
  );

  const handleToggleCompany = (rowIndex: number) => {
    const company = companies[rowIndex];

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
      <OutreachDetailsTable
        data={tableData}
        maxHeight={420}
        selectedRowIndex={
          primarySelectedIndex >= 0 ? primarySelectedIndex : undefined
        }
        onSelectRow={handleToggleCompany}
      />
    </StyledPanel>
  );
};
