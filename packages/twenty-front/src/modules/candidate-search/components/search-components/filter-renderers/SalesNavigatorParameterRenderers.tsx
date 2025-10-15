
import { ParameterRendererProps } from '@/candidate-search/types/candidate-search.types';
import { Button } from '@ui/input/button/components/Button';
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

export const SalesNavigatorPeopleParameters = ({ parameters, updateParameters, onSearch, onClear }: ParameterRendererProps) => {
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

      <LinkedInParameterSelector
        parameterType="SCHOOL"
        label="Schools"
        selectedValues={parameters.school || []}
        onSelectionChange={handleSchoolChange}
      />

      {/* Sales Navigator specific fields */}
      <StyledSection>
        <StyledLabel>Experience (Tenure)</StyledLabel>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <StyledInput
            type="number"
            placeholder="Min years"
            value={parameters.tenure?.min || ''}
            onChange={(e) => updateParameters({
              tenure: {
                ...parameters.tenure,
                min: parseInt(e.target.value) || undefined
              }
            })}
          />
          <span>to</span>
          <StyledInput
            type="number"
            placeholder="Max years"
            value={parameters.tenure?.max || ''}
            onChange={(e) => updateParameters({
              tenure: {
                ...parameters.tenure,
                max: parseInt(e.target.value) || undefined
              }
            })}
          />
        </div>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Company Size</StyledLabel>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <StyledInput
            type="number"
            placeholder="Min employees"
            value={parameters.company_headcount?.min || ''}
            onChange={(e) => updateParameters({
              company_headcount: {
                ...parameters.company_headcount,
                min: parseInt(e.target.value) || undefined
              }
            })}
          />
          <span>to</span>
          <StyledInput
            type="number"
            placeholder="Max employees"
            value={parameters.company_headcount?.max || ''}
            onChange={(e) => updateParameters({
              company_headcount: {
                ...parameters.company_headcount,
                max: parseInt(e.target.value) || undefined
              }
            })}
          />
        </div>
      </StyledSection>

      <LinkedInParameterSelector
        parameterType="JOB_FUNCTION"
        label="Job Functions"
        selectedValues={parameters.function?.include || []}
        onSelectionChange={(values) => updateParameters({ 
          function: { 
            include: values, 
            exclude: parameters.function?.exclude || [] 
          } 
        })}
      />

      <LinkedInParameterSelector
        parameterType="JOB_TITLE"
        label="Roles"
        selectedValues={parameters.role?.include || []}
        onSelectionChange={(values) => updateParameters({ 
          role: { 
            include: values, 
            exclude: parameters.role?.exclude || [] 
          } 
        })}
      />

      <StyledSection>
        <StyledLabel>Seniority Level</StyledLabel>
        <StyledSelect
          multiple
          value={parameters.seniority || []}
          onChange={(e) => {
            const values = Array.from(e.target.selectedOptions, option => option.value);
            updateParameters({ seniority: values });
          }}
        >
          <option value="entry_level">Entry Level</option>
          <option value="in_training">In Training</option>
          <option value="associate">Associate</option>
          <option value="senior">Senior</option>
          <option value="experienced_manager">Experienced Manager</option>
          <option value="director">Director</option>
          <option value="executive">Executive</option>
        </StyledSelect>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Network Distance</StyledLabel>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="sn-distance-1"
            value={1}
            checked={parameters.network_distance?.includes(1)}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              const distances = e.target.checked
                ? [...(parameters.network_distance || []), value]
                : (parameters.network_distance || []).filter((d: number) => d !== value);
              updateParameters({ network_distance: distances });
            }}
          />
          <StyledLabel htmlFor="sn-distance-1">1st connections</StyledLabel>
        </StyledCheckboxContainer>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="sn-distance-2"
            value={2}
            checked={parameters.network_distance?.includes(2)}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              const distances = e.target.checked
                ? [...(parameters.network_distance || []), value]
                : (parameters.network_distance || []).filter((d: number) => d !== value);
              updateParameters({ network_distance: distances });
            }}
          />
          <StyledLabel htmlFor="sn-distance-2">2nd connections</StyledLabel>
        </StyledCheckboxContainer>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="sn-distance-3"
            value={3}
            checked={parameters.network_distance?.includes(3)}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              const distances = e.target.checked
                ? [...(parameters.network_distance || []), value]
                : (parameters.network_distance || []).filter((d: number) => d !== value);
              updateParameters({ network_distance: distances });
            }}
          />
          <StyledLabel htmlFor="sn-distance-3">3rd connections</StyledLabel>
        </StyledCheckboxContainer>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Company Type</StyledLabel>
        <StyledSelect
          multiple
          value={parameters.company_type || []}
          onChange={(e) => {
            const values = Array.from(e.target.selectedOptions, option => option.value);
            updateParameters({ company_type: values });
          }}
        >
          <option value="public_company">Public Company</option>
          <option value="privately_held">Privately Held</option>
          <option value="self_employed">Self Employed</option>
          <option value="government_agency">Government Agency</option>
          <option value="non_profit">Non Profit</option>
          <option value="self_owned">Self Owned</option>
          <option value="educational">Educational</option>
        </StyledSelect>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Time at Current Company</StyledLabel>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <StyledInput
            type="number"
            placeholder="Min years"
            value={parameters.tenure_at_company?.min || ''}
            onChange={(e) => updateParameters({
              tenure_at_company: {
                ...parameters.tenure_at_company,
                min: parseInt(e.target.value) || undefined
              }
            })}
          />
          <span>to</span>
          <StyledInput
            type="number"
            placeholder="Max years"
            value={parameters.tenure_at_company?.max || ''}
            onChange={(e) => updateParameters({
              tenure_at_company: {
                ...parameters.tenure_at_company,
                max: parseInt(e.target.value) || undefined
              }
            })}
          />
        </div>
      </StyledSection>

      <LinkedInParameterSelector
        parameterType="JOB_TITLE"
        label="Past Roles"
        selectedValues={parameters.past_role?.include || []}
        onSelectionChange={(values) => updateParameters({ 
          past_role: { 
            include: values, 
            exclude: parameters.past_role?.exclude || [] 
          } 
        })}
      />

      <StyledSection>
        <StyledLabel>Activity Filters</StyledLabel>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="following-company"
            checked={parameters.following_your_company || false}
            onChange={(e) => updateParameters({ following_your_company: e.target.checked })}
          />
          <StyledLabel htmlFor="following-company">Following your company</StyledLabel>
        </StyledCheckboxContainer>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="viewed-profile"
            checked={parameters.viewed_your_profile_recently || false}
            onChange={(e) => updateParameters({ viewed_your_profile_recently: e.target.checked })}
          />
          <StyledLabel htmlFor="viewed-profile">Viewed your profile recently</StyledLabel>
        </StyledCheckboxContainer>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="posted-linkedin"
            checked={parameters.posted_on_linkedin || false}
            onChange={(e) => updateParameters({ posted_on_linkedin: e.target.checked })}
          />
          <StyledLabel htmlFor="posted-linkedin">Posted on LinkedIn recently</StyledLabel>
        </StyledCheckboxContainer>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="changed-jobs"
            checked={parameters.changed_jobs || false}
            onChange={(e) => updateParameters({ changed_jobs: e.target.checked })}
          />
          <StyledLabel htmlFor="changed-jobs">Changed jobs recently</StyledLabel>
        </StyledCheckboxContainer>
      </StyledSection>
    </>
  );
};

export const SalesNavigatorCompaniesParameters = ({ parameters, updateParameters, onSearch, onClear }: ParameterRendererProps) => {
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
