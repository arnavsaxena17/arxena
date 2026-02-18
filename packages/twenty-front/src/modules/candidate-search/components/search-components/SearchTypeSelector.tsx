import { LinkedInSearchType } from 'twenty-shared';
import { StyledLabel, StyledSection, StyledSelect } from '../../styles/SearchFormComponents.styled';

type SearchTypeSelectorProps = {
  searchType: LinkedInSearchType;
  onSearchTypeChange: (searchType: LinkedInSearchType) => void;
};

export const SearchTypeSelector = ({
  searchType,
  onSearchTypeChange,
}: SearchTypeSelectorProps) => {
  return (
    <StyledSection>
      <StyledLabel>Search Type</StyledLabel>
      <StyledSelect
        value={searchType}
        onChange={(e) => onSearchTypeChange(e.target.value as LinkedInSearchType)}
      >
        <option value="classic">LinkedIn Classic</option>
        <option value="sales_navigator">Sales Navigator</option>
        <option value="recruiter">LinkedIn Recruiter</option>
      </StyledSelect>
    </StyledSection>
  );
};
