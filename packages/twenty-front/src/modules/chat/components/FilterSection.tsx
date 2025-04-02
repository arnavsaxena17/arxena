import styled from '@emotion/styled';

const StyledFilterSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
`;

const StyledHeader = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
`;

const StyledTitle = styled.h3`
  ${({ theme }) => theme.font.size.lg};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0;
`;

const StyledClearButton = styled.button`
  ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.color.blue};
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;

  &:hover {
    text-decoration: underline;
  }
`;

const StyledFilterGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledFilterHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(4)} 0;
`;

const StyledFilterTitle = styled.span`
  ${({ theme }) => theme.font.size.lg};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledFilterOptions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledFilterOption = styled.label`
  align-items: center;
  color: ${({ theme }) => theme.font.color.primary};
  cursor: pointer;
  display: flex;
  ${({ theme }) => theme.font.size.sm};
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledCheckbox = styled.input`
  width: 16px;
  height: 16px;
  margin: 0;
  cursor: pointer;
`;

const StyledApplyButton = styled.button`
  width: 100%;
  padding: ${({ theme }) => theme.spacing(2.5)};
  background-color: ${({ theme }) => theme.color.blue};
  color: ${({ theme }) => theme.font.color.inverted};
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  ${({ theme }) => theme.font.size.sm};
  cursor: pointer;

  &:hover {
    background-color: ${({ theme }) => theme.color.blue70};
  }
`;

type FilterOption = {
  id: string;
  label: string;
  checked: boolean;
};

type FilterGroup = {
  id: string;
  title: string;
  options: FilterOption[];
};

type FilterSectionProps = {
  filterGroups: FilterGroup[];
  onFilterChange: (groupId: string, optionId: string, checked: boolean) => void;
  onClearAll: () => void;
  onApplyFilters: () => void;
};

export const FilterSection = ({
  filterGroups,
  onFilterChange,
  onClearAll,
  onApplyFilters,
}: FilterSectionProps) => {
  return (
    <StyledFilterSection>
      <StyledHeader>
        <StyledTitle>Filter Candidates</StyledTitle>
        <StyledClearButton onClick={onClearAll}>Clear All</StyledClearButton>
      </StyledHeader>

      {filterGroups.map((group) => (
        <StyledFilterGroup key={group.id}>
          <StyledFilterHeader>
            <StyledFilterTitle>{group.title}</StyledFilterTitle>
          </StyledFilterHeader>
          <StyledFilterOptions>
            {group.options.map((option) => (
              <StyledFilterOption key={option.id}>
                <StyledCheckbox
                  type="checkbox"
                  checked={option.checked}
                  onChange={(e) =>
                    onFilterChange(group.id, option.id, e.target.checked)
                  }
                />
                {option.label}
              </StyledFilterOption>
            ))}
          </StyledFilterOptions>
        </StyledFilterGroup>
      ))}

      <StyledApplyButton onClick={onApplyFilters}>
        Apply Filters
      </StyledApplyButton>
    </StyledFilterSection>
  );
};

export default FilterSection;
