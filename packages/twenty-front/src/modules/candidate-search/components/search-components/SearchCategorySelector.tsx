import { LinkedInSearchCategory } from '@/candidate-search/types/candidate-search.types';
import { StyledLabel, StyledSection, StyledSelect } from '../../styles/SearchFormComponents.styled';

type SearchCategorySelectorProps = {
  searchCategory: LinkedInSearchCategory;
  onSearchCategoryChange: (searchCategory: LinkedInSearchCategory) => void;
};

export const SearchCategorySelector = ({
  searchCategory,
  onSearchCategoryChange,
}: SearchCategorySelectorProps) => {
  return (
    <StyledSection>
      <StyledLabel>Search Category</StyledLabel>
      <StyledSelect value={searchCategory} onChange={(e) => onSearchCategoryChange(e.target.value as LinkedInSearchCategory)} >
        <option value="people">People</option>
        <option value="companies">Companies</option>
        <option value="jobs">Jobs</option>
        <option value="posts">Posts</option>
      </StyledSelect>
    </StyledSection>
  );
};