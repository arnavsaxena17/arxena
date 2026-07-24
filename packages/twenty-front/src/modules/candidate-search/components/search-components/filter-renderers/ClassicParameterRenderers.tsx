import { ParameterRendererProps } from '@/candidate-search/types/candidate-search.types';
import { Button } from 'twenty-ui';
import React from 'react';
import {
  StyledButtonContainer,
  StyledCheckbox,
  StyledCheckboxContainer,
  StyledInput,
  StyledLabel,
  StyledSection,
  StyledSelect,
  StyledTextArea,
} from '../../../styles/SearchParametersManager.styled';
import { LinkedInParameterSelector } from '../../search-components/LinkedInParameterSelector';

export const ClassicPeopleParameters = ({ parameters, updateParameters, handleParameterChange, onSearch, onClear }: ParameterRendererProps) => {
  const handleKeywordsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateParameters({ keywords: e.target.value });
  };

  const handleNetworkDistanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    const distances = e.target.checked
      ? [...parameters.network_distance, value]
      : parameters.network_distance.filter((d: number) => d !== value);
    updateParameters({ network_distance: distances });
  };

  const handleIndustryChange = (values: string[], display?: Array<{ id: string; title: string }>) => {
    const ids = display && display.length > 0 ? display.map(item => item.id) : values.filter(v => /^\d+$/.test(v) || v.includes('urn:li:'));
    if (display && display.length > 0) {
      updateParameters({ industry: ids, industry_display: display });
    } else {
      updateParameters({ industry: ids });
    }
  };

  const handleLocationChange = (values: string[], display?: Array<{ id: string; title: string }>) => {
    const ids = display && display.length > 0 ? display.map(item => item.id) : values.filter(v => /^\d+$/.test(v) || v.includes('urn:li:'));
    updateParameters(display && display.length ? { location: ids, location_display: display } : { location: ids });
  };

  const handleCompanyChange = (values: string[], display?: Array<{ id: string; title: string }>) => {
    const ids = display && display.length > 0 ? display.map(item => item.id) : values.filter(v => /^\d+$/.test(v) || v.includes('urn:li:'));
    updateParameters(display && display.length ? { company: ids, company_display: display } : { company: ids });
  };

  const handleCompanyDisplayChange = (display: Array<{ id: string; title: string }>) => {
    // Use the current company values with the new display information
    const currentCompanyIds = parameters.company || [];
    updateParameters({ company: currentCompanyIds, company_display: display });
  };

  const handleSchoolChange = (values: string[], display?: Array<{ id: string; title: string }>) => {
    const ids = display && display.length > 0 ? display.map(item => item.id) : values.filter(v => /^\d+$/.test(v) || v.includes('urn:li:'));
    updateParameters(display && display.length ? { school: ids, school_display: display } : { school: ids });
  };

  return (
    <>
      <StyledButtonContainer>
        <Button
          title="Search"
          variant="primary"
          accent="blue"
          onClick={onSearch}
        />
        <Button
          title="Clear"
          variant="secondary"
          onClick={onClear}
        />
      </StyledButtonContainer>

      <StyledSection>
        <StyledLabel>Keywords</StyledLabel>
        <StyledTextArea
          value={parameters.keywords || ''}
          onChange={handleKeywordsChange}
          placeholder="Enter job titles, skills, technologies..."
        />
      </StyledSection>

      <StyledSection>
        <StyledLabel>Network Distance</StyledLabel>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="distance-1"
            value={1}
            checked={parameters.network_distance?.includes(1)}
            onChange={handleNetworkDistanceChange}
          />
          <StyledLabel htmlFor="distance-1">1st connections</StyledLabel>
        </StyledCheckboxContainer>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="distance-2"
            value={2}
            checked={parameters.network_distance?.includes(2)}
            onChange={handleNetworkDistanceChange}
          />
          <StyledLabel htmlFor="distance-2">2nd connections</StyledLabel>
        </StyledCheckboxContainer>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="distance-3"
            value={3}
            checked={parameters.network_distance?.includes(3)}
            onChange={handleNetworkDistanceChange}
          />
          <StyledLabel htmlFor="distance-3">3rd connections</StyledLabel>
        </StyledCheckboxContainer>
      </StyledSection>

      <LinkedInParameterSelector
        parameterType="INDUSTRY"
        label="Industries"
        selectedValues={parameters.industry || []}
        onSelectionChange={(values) => handleIndustryChange(values)}
        onSelectionDisplayChange={(display) => handleIndustryChange(parameters.industry || [], display)}
      />

      <LinkedInParameterSelector
        parameterType="LOCATION"
        label="Locations"
        selectedValues={parameters.location || []}
        onSelectionChange={(values) => handleLocationChange(values)}
        onSelectionDisplayChange={(display) => handleLocationChange(parameters.location || [], display)}
      />

      <LinkedInParameterSelector
        parameterType="COMPANY"
        label="Companies"
        selectedValues={parameters.company || []}
        onSelectionChange={(values) => handleCompanyChange(values)}
        onSelectionDisplayChange={handleCompanyDisplayChange}
      />

      <LinkedInParameterSelector
        parameterType="SCHOOL"
        label="Schools"
        selectedValues={parameters.school || []}
        onSelectionChange={(values) => handleSchoolChange(values)}
        onSelectionDisplayChange={(display) => handleSchoolChange(parameters.school || [], display)}
      />
    </>
  );
};

export const ClassicCompaniesParameters = ({ parameters, updateParameters, onSearch, onClear }: ParameterRendererProps) => {
  const handleKeywordsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateParameters({ keywords: e.target.value });
  };

  const handleIndustryChange = (values: string[], display?: Array<{ id: string; title: string }>) => {
    const ids = display && display.length > 0 ? display.map(item => item.id) : values.filter(v => /^\d+$/.test(v) || v.includes('urn:li:'));
    updateParameters(display && display.length ? { industry: ids, industry_display: display } : { industry: ids });
  };

  const handleLocationChange = (values: string[], display?: Array<{ id: string; title: string }>) => {
    const ids = display && display.length > 0 ? display.map(item => item.id) : values.filter(v => /^\d+$/.test(v) || v.includes('urn:li:'));
    updateParameters(display && display.length ? { location: ids, location_display: display } : { location: ids });
  };

  const handleHeadcountMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateParameters({
      headcount: {
        ...parameters.headcount,
        min: parseInt(e.target.value) || 0,
      },
    });
  };

  const handleHeadcountMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateParameters({
      headcount: {
        ...parameters.headcount,
        max: parseInt(e.target.value) || 10000,
      },
    });
  };

  return (
    <>
      <StyledButtonContainer>
        <Button
          title="Search"
          variant="primary"
          accent="blue"
          onClick={onSearch}
        />
        <Button
          title="Clear"
          variant="secondary"
          onClick={onClear}
        />
      </StyledButtonContainer>

      <StyledSection>
        <StyledLabel>Keywords</StyledLabel>
        <StyledTextArea
          value={parameters.keywords || ''}
          onChange={handleKeywordsChange}
          placeholder="Enter company names, industries, technologies..."
        />
      </StyledSection>

      <LinkedInParameterSelector
        parameterType="INDUSTRY"
        label="Industries"
        selectedValues={parameters.industry || []}
        onSelectionChange={handleIndustryChange}
      />

      <LinkedInParameterSelector
        parameterType="LOCATION"
        label="Locations"
        selectedValues={parameters.location || []}
        onSelectionChange={handleLocationChange}
      />

      <StyledSection>
        <StyledLabel>Company Size</StyledLabel>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <StyledInput
            type="number"
            placeholder="Min employees"
            value={parameters.headcount?.min || ''}
            onChange={handleHeadcountMinChange}
          />
          <span>to</span>
          <StyledInput
            type="number"
            placeholder="Max employees"
            value={parameters.headcount?.max || ''}
            onChange={handleHeadcountMaxChange}
          />
        </div>
      </StyledSection>
    </>
  );
};

export const ClassicJobsParameters = ({ parameters, updateParameters, onSearch, onClear }: ParameterRendererProps) => {
  const handleKeywordsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateParameters({ keywords: e.target.value });
  };

  const handleIndustryChange = (values: string[], display?: Array<{ id: string; title: string }>) => {
    const ids = display && display.length > 0 ? display.map(item => item.id) : values.filter(v => /^\d+$/.test(v) || v.includes('urn:li:'));
    updateParameters(display && display.length ? { industry: ids, industry_display: display } : { industry: ids });
  };

  const handleLocationChange = (values: string[], display?: Array<{ id: string; title: string }>) => {
    const ids = display && display.length > 0 ? display.map(item => item.id) : values.filter(v => /^\d+$/.test(v) || v.includes('urn:li:'));
    updateParameters(display && display.length ? { location: ids, location_display: display } : { location: ids });
  };

  const handleCompanyChange = (values: string[], display?: Array<{ id: string; title: string }>) => {
    const ids = display && display.length > 0 ? display.map(item => item.id) : values.filter(v => /^\d+$/.test(v) || v.includes('urn:li:'));
    updateParameters(display && display.length ? { company: ids, company_display: display } : { company: ids });
  };

  const handleSeniorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(e.target.selectedOptions, option => option.value);
    updateParameters({ seniority: values });
  };

  const handleJobTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(e.target.selectedOptions, option => option.value);
    updateParameters({ job_type: values });
  };

  const handlePresenceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(e.target.selectedOptions, option => option.value);
    updateParameters({ presence: values });
  };

  return (
    <>
      <StyledButtonContainer>
        <Button
          title="Search"
          variant="primary"
          accent="blue"
          onClick={onSearch}
        />
        <Button
          title="Clear"
          variant="secondary"
          onClick={onClear}
        />
      </StyledButtonContainer>

      <StyledSection>
        <StyledLabel>Keywords</StyledLabel>
        <StyledTextArea
          value={parameters.keywords || ''}
          onChange={handleKeywordsChange}
          placeholder="Enter job titles, skills, technologies..."
        />
      </StyledSection>

      <LinkedInParameterSelector
        parameterType="INDUSTRY"
        label="Industries"
        selectedValues={parameters.industry || []}
        onSelectionChange={handleIndustryChange}
      />

      <LinkedInParameterSelector
        parameterType="LOCATION"
        label="Locations"
        selectedValues={parameters.location || []}
        onSelectionChange={handleLocationChange}
      />

      <LinkedInParameterSelector
        parameterType="COMPANY"
        label="Companies"
        selectedValues={parameters.company || []}
        onSelectionChange={handleCompanyChange}
      />

      <StyledSection>
        <StyledLabel>Seniority Level</StyledLabel>
        <StyledSelect
          multiple
          value={parameters.seniority || []}
          onChange={handleSeniorityChange}
        >
          <option value="executive">Executive</option>
          <option value="director">Director</option>
          <option value="mid_senior">Mid-Senior</option>
          <option value="associate">Associate</option>
          <option value="entry">Entry Level</option>
          <option value="intern">Intern</option>
        </StyledSelect>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Employment Type</StyledLabel>
        <StyledSelect
          multiple
          value={parameters.job_type || []}
          onChange={handleJobTypeChange}
        >
          <option value="full_time">Full Time</option>
          <option value="part_time">Part Time</option>
          <option value="contract">Contract</option>
          <option value="temporary">Temporary</option>
          <option value="volunteer">Volunteer</option>
          <option value="internship">Internship</option>
          <option value="other">Other</option>
        </StyledSelect>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Work Arrangement</StyledLabel>
        <StyledSelect
          multiple
          value={parameters.presence || []}
          onChange={handlePresenceChange}
        >
          <option value="on_site">On Site</option>
          <option value="hybrid">Hybrid</option>
          <option value="remote">Remote</option>
        </StyledSelect>
      </StyledSection>
    </>
  );
};
