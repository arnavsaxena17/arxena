import { StyledInput, StyledLabel, StyledSection, StyledSelect } from '../../styles/SearchFormComponents.styled';

type ProjectFiltersProps = {
  sortBy: 'relevance' | 'date';
  onSortByChange: (sortBy: 'relevance' | 'date') => void;
  datePosted: number | undefined;
  onDatePostedChange: (datePosted: number | undefined) => void;
  locationWithinArea: number | undefined;
  onLocationWithinAreaChange: (locationWithinArea: number | undefined) => void;
  easyApply: boolean | undefined;
  onEasyApplyChange: (easyApply: boolean | undefined) => void;
  inYourNetwork: boolean | undefined;
  onInYourNetworkChange: (inYourNetwork: boolean | undefined) => void;
  fairChanceEmployer: boolean | undefined;
  onFairChanceEmployerChange: (fairChanceEmployer: boolean | undefined) => void;
};

export const ProjectFilters = ({
  sortBy,
  onSortByChange,
  datePosted,
  onDatePostedChange,
  locationWithinArea,
  onLocationWithinAreaChange,
  easyApply,
  onEasyApplyChange,
  inYourNetwork,
  onInYourNetworkChange,
  fairChanceEmployer,
  onFairChanceEmployerChange,
}: ProjectFiltersProps) => {
  return (
    <>
      <StyledSection>
        <StyledLabel>Sort By</StyledLabel>
        <StyledSelect
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value as 'relevance' | 'date')}
        >
          <option value="relevance">Relevance</option>
          <option value="date">Date Posted</option>
        </StyledSelect>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Date Posted (days ago)</StyledLabel>
        <StyledInput
          type="number"
          value={datePosted || ''}
          onChange={(e) => onDatePostedChange(e.target.value ? parseInt(e.target.value) : undefined)}
          placeholder="e.g., 7 for past week..."
        />
      </StyledSection>

      <StyledSection>
        <StyledLabel>Location Within Area (miles)</StyledLabel>
        <StyledInput
          type="number"
          value={locationWithinArea || ''}
          onChange={(e) => onLocationWithinAreaChange(e.target.value ? parseInt(e.target.value) : undefined)}
          placeholder="e.g., 25..."
        />
      </StyledSection>

      <StyledSection>
        <StyledLabel>Easy Apply</StyledLabel>
        <StyledSelect
          value={easyApply === undefined ? '' : easyApply.toString()}
          onChange={(e) => onEasyApplyChange(e.target.value === '' ? undefined : e.target.value === 'true')}
        >
          <option value="">Any</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </StyledSelect>
      </StyledSection>

      <StyledSection>
        <StyledLabel>In Your Network</StyledLabel>
        <StyledSelect
          value={inYourNetwork === undefined ? '' : inYourNetwork.toString()}
          onChange={(e) => onInYourNetworkChange(e.target.value === '' ? undefined : e.target.value === 'true')}
        >
          <option value="">Any</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </StyledSelect>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Fair Chance Employer</StyledLabel>
        <StyledSelect
          value={fairChanceEmployer === undefined ? '' : fairChanceEmployer.toString()}
          onChange={(e) => onFairChanceEmployerChange(e.target.value === '' ? undefined : e.target.value === 'true')}
        >
          <option value="">Any</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </StyledSelect>
      </StyledSection>
    </>
  );
};
