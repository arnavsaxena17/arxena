import { StyledLabel, StyledSection, StyledSelect } from '../../styles/SearchFormComponents.styled';

type CompanyFiltersProps = {
  hasJobOffers: boolean | undefined;
  onHasJobOffersChange: (hasJobOffers: boolean | undefined) => void;
};

export const CompanyFilters = ({
  hasJobOffers,
  onHasJobOffersChange,
}: CompanyFiltersProps) => {
  return (
    <StyledSection>
      <StyledLabel>Has Job Offers</StyledLabel>
      <StyledSelect
        value={hasJobOffers === undefined ? '' : hasJobOffers.toString()}
        onChange={(e) => onHasJobOffersChange(e.target.value === '' ? undefined : e.target.value === 'true')}
      >
        <option value="">Any</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </StyledSelect>
    </StyledSection>
  );
};
