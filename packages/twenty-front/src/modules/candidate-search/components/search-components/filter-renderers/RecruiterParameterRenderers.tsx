import { ParameterRendererProps } from '@/candidate-search/types/candidate-search.types';
import { Button } from 'twenty-ui';
import React from 'react';
import {
  StyledButtonContainer,
  StyledCheckbox,
  StyledCheckboxContainer,
  StyledInput,
  StyledLabel,
  StyledRow,
  StyledRowButton,
  StyledSection,
  StyledSelect,
  StyledTextArea,
} from '../../../styles/SearchParametersManager.styled';
import { LinkedInParameterSelector } from '../../search-components/LinkedInParameterSelector';

export const RecruiterPeopleParameters = ({ parameters, updateParameters, handleParameterChange, onSearch, onClear }: ParameterRendererProps) => {
  const handleKeywordsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateParameters({ keywords: e.target.value });
  };

  const handleLocationChange = (values: string[], display?: Array<{ id: string; title: string }>) => {
    const ids = display && display.length > 0 ? display.map(item => item.id) : values.filter(v => /^\d+$/.test(v) || v.includes('urn:li:'));
    updateParameters(display && display.length ? { location: ids, location_display: display } : { location: ids });
  };

  const handleIndustryChange = (values: string[], display?: Array<{ id: string; title: string }>) => {
    const ids = display && display.length > 0 ? display.map(item => item.id) : values.filter(v => /^\d+$/.test(v) || v.includes('urn:li:'));
    updateParameters(display && display.length ? { industry: ids, industry_display: display } : { industry: ids });
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

      <StyledSection>
        <StyledLabel>Locale</StyledLabel>
        <StyledSelect
          value={parameters.locale || ''}
          onChange={(e) => handleParameterChange('locale', e.target.value || undefined)}
        >
          <option value="">Select Locale</option>
          <option value="english">English</option>
          <option value="spanish">Spanish</option>
          <option value="french">French</option>
          <option value="german">German</option>
          <option value="italian">Italian</option>
          <option value="portuguese">Portuguese</option>
          <option value="dutch">Dutch</option>
          <option value="russian">Russian</option>
          <option value="japanese">Japanese</option>
          <option value="korean">Korean</option>
          <option value="chinese_simplified">Chinese (Simplified)</option>
          <option value="chinese_traditional">Chinese (Traditional)</option>
          <option value="arabic">Arabic</option>
          <option value="hindi">Hindi</option>
          <option value="hebrew">Hebrew</option>
          <option value="thai">Thai</option>
          <option value="vietnamese">Vietnamese</option>
        </StyledSelect>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Saved Filter</StyledLabel>
        <StyledInput
          value={parameters.saved_filter || ''}
          onChange={(e) => handleParameterChange('saved_filter', e.target.value || undefined)}
          placeholder="Enter saved filter name..."
        />
      </StyledSection>

      <LinkedInParameterSelector
        parameterType="LOCATION"
        label="Locations"
        selectedValues={parameters.location || []}
        onSelectionChange={handleLocationChange}
      />

      <StyledSection>
        <StyledLabel>Location Within Area (miles)</StyledLabel>
        <StyledInput
          type="number"
          value={parameters.location_within_area || ''}
          onChange={(e) => handleParameterChange('location_within_area', e.target.value ? parseInt(e.target.value) : undefined)}
          placeholder="e.g., 50"
        />
      </StyledSection>

      <LinkedInParameterSelector
        parameterType="INDUSTRY"
        label="Industries"
        selectedValues={parameters.industry || []}
        onSelectionChange={handleIndustryChange}
      />

      <StyledSection>
        <StyledLabel>Roles</StyledLabel>
        {(Array.isArray(parameters.role) ? parameters.role : []).map((r: any, idx: number) => (
          <StyledRow key={`role-${idx}`}>
            <StyledInput
              placeholder="Role keywords"
              value={r.keywords || ''}
              onChange={(e) => {
                const roleArray = Array.isArray(parameters.role) ? parameters.role : [];
                const next = [...roleArray];
                next[idx] = { ...next[idx], keywords: e.target.value || undefined };
                handleParameterChange('role', next.filter(item => item && (item.id || item.keywords)));
              }}
            />
            <StyledSelect
              value={r.priority || 'CAN_HAVE'}
              onChange={(e) => {
                const roleArray = Array.isArray(parameters.role) ? parameters.role : [];
                const next = [...roleArray];
                next[idx] = { ...next[idx], priority: e.target.value };
                handleParameterChange('role', next);
              }}
            >
              <option value="CAN_HAVE">Can have</option>
              <option value="MUST_HAVE">Must have</option>
              <option value="DOESNT_HAVE">Doesn't have</option>
            </StyledSelect>
            <StyledSelect
              value={r.scope || 'CURRENT'}
              onChange={(e) => {
                const roleArray = Array.isArray(parameters.role) ? parameters.role : [];
                const next = [...roleArray];
                next[idx] = { ...next[idx], scope: e.target.value };
                handleParameterChange('role', next);
              }}
            >
              <option value="CURRENT_OR_PAST">Current or Past</option>
              <option value="CURRENT">Current</option>
              <option value="PAST">Past</option>
              <option value="PAST_NOT_CURRENT">Past not Current</option>
              <option value="OPEN_TO_WORK">Open to Work</option>
            </StyledSelect>
            <StyledRowButton
              onClick={() => {
                const roleArray = Array.isArray(parameters.role) ? parameters.role : [];
                const next = [...roleArray];
                next.splice(idx, 1);
                handleParameterChange('role', next.length ? next : undefined);
              }}
            >Remove</StyledRowButton>
          </StyledRow>
        ))}
        <StyledRow>
          <StyledRowButton
            onClick={() => {
              const roleArray = Array.isArray(parameters.role) ? parameters.role : [];
              const next = [...roleArray];
              next.push({ keywords: '' });
              handleParameterChange('role', next);
            }}
          >Add role</StyledRowButton>
        </StyledRow>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Skills</StyledLabel>
        {(Array.isArray(parameters.skills) ? parameters.skills : []).map((s: any, idx: number) => (
          <StyledRow key={`skill-${idx}`}>
            <StyledInput
              placeholder="Skill keywords"
              value={s.keywords || ''}
              onChange={(e) => {
                const skillsArray = Array.isArray(parameters.skills) ? parameters.skills : [];
                const next = [...skillsArray];
                next[idx] = { ...next[idx], keywords: e.target.value || undefined };
                handleParameterChange('skills', next.filter(item => item && (item.id || item.keywords)));
              }}
            />
            <StyledSelect
              value={s.priority || 'CAN_HAVE'}
              onChange={(e) => {
                const skillsArray = Array.isArray(parameters.skills) ? parameters.skills : [];
                const next = [...skillsArray];
                next[idx] = { ...next[idx], priority: e.target.value };
                handleParameterChange('skills', next);
              }}
            >
              <option value="CAN_HAVE">Can have</option>
              <option value="MUST_HAVE">Must have</option>
              <option value="DOESNT_HAVE">Doesn't have</option>
            </StyledSelect>
            <StyledRowButton
              onClick={() => {
                const skillsArray = Array.isArray(parameters.skills) ? parameters.skills : [];
                const next = [...skillsArray];
                next.splice(idx, 1);
                handleParameterChange('skills', next.length ? next : undefined);
              }}
            >Remove</StyledRowButton>
          </StyledRow>
        ))}
        <StyledRow>
          <StyledRowButton
            onClick={() => {
              const skillsArray = Array.isArray(parameters.skills) ? parameters.skills : [];
              const next = [...skillsArray];
              next.push({ keywords: '' });
              handleParameterChange('skills', next);
            }}
          >Add skill</StyledRowButton>
        </StyledRow>
      </StyledSection>

      <LinkedInParameterSelector
        parameterType="COMPANY"
        label="Companies"
        selectedValues={parameters.company || []}
        onSelectionChange={handleCompanyChange}
      />

      <StyledSection>
        <StyledLabel>Company Headcount Ranges</StyledLabel>
        {(Array.isArray(parameters.company_headcount) ? parameters.company_headcount : []).map((r: any, idx: number) => (
          <StyledRow key={`headcount-${idx}`}>
            <StyledInput
              type="number"
              placeholder="Min"
              value={r?.min ?? ''}
              onChange={(e) => {
                const headcountArray = Array.isArray(parameters.company_headcount) ? parameters.company_headcount : [];
                const next = [...headcountArray];
                next[idx] = { ...(next[idx] || {}), min: e.target.value ? parseInt(e.target.value) : undefined };
                handleParameterChange('company_headcount', next);
              }}
            />
            <span>to</span>
            <StyledInput
              type="number"
              placeholder="Max"
              value={r?.max ?? ''}
              onChange={(e) => {
                const headcountArray = Array.isArray(parameters.company_headcount) ? parameters.company_headcount : [];
                const next = [...headcountArray];
                next[idx] = { ...(next[idx] || {}), max: e.target.value ? parseInt(e.target.value) : undefined };
                handleParameterChange('company_headcount', next);
              }}
            />
            <StyledRowButton
              onClick={() => {
                const headcountArray = Array.isArray(parameters.company_headcount) ? parameters.company_headcount : [];
                const next = [...headcountArray];
                next.splice(idx, 1);
                handleParameterChange('company_headcount', next.length ? next : undefined);
              }}
            >Remove</StyledRowButton>
          </StyledRow>
        ))}
        <StyledRow>
          <StyledRowButton
            onClick={() => {
              const headcountArray = Array.isArray(parameters.company_headcount) ? parameters.company_headcount : [];
              const next = [...headcountArray];
              next.push({});
              handleParameterChange('company_headcount', next);
            }}
          >Add range</StyledRowButton>
        </StyledRow>
      </StyledSection>

      <LinkedInParameterSelector
        parameterType="COMPANY"
        label="Current Companies"
        selectedValues={parameters.current_company || []}
        onSelectionChange={(values) => handleParameterChange('current_company', values)}
      />

      <LinkedInParameterSelector
        parameterType="COMPANY"
        label="Past Companies"
        selectedValues={parameters.past_company || []}
        onSelectionChange={(values) => handleParameterChange('past_company', values)}
      />

      <LinkedInParameterSelector
        parameterType="SCHOOL"
        label="Schools"
        selectedValues={parameters.school || []}
        onSelectionChange={handleSchoolChange}
      />

      <StyledSection>
        <StyledLabel>Groups</StyledLabel>
        <StyledTextArea
          value={Array.isArray(parameters.groups) ? parameters.groups.join('\n') : ''}
          onChange={(e) => {
            const groups = e.target.value.split('\n').filter(group => group.trim());
            handleParameterChange('groups', groups.length > 0 ? groups : undefined);
          }}
          placeholder="Enter LinkedIn group names (one per line)"
        />
      </StyledSection>

      <StyledSection>
        <StyledLabel>Graduation Year Range</StyledLabel>
        <StyledRow>
          <StyledInput
            type="number"
            placeholder="Min year"
            value={parameters.graduation_year?.min ?? ''}
            onChange={(e) => {
              const min = e.target.value ? parseInt(e.target.value) : undefined;
              const next = { ...(parameters.graduation_year || {}), min };
              if (next.min === undefined && next.max === undefined) return handleParameterChange('graduation_year', undefined);
              handleParameterChange('graduation_year', next);
            }}
          />
          <span>to</span>
          <StyledInput
            type="number"
            placeholder="Max year"
            value={parameters.graduation_year?.max ?? ''}
            onChange={(e) => {
              const max = e.target.value ? parseInt(e.target.value) : undefined;
              const next = { ...(parameters.graduation_year || {}), max };
              if (next.min === undefined && next.max === undefined) return handleParameterChange('graduation_year', undefined);
              handleParameterChange('graduation_year', next);
            }}
          />
        </StyledRow>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Tenure Range (years)</StyledLabel>
        <StyledRow>
          <StyledInput
            type="number"
            placeholder="Min years"
            value={parameters.tenure?.min ?? ''}
            onChange={(e) => {
              const min = e.target.value ? parseInt(e.target.value) : undefined;
              const next = { ...(parameters.tenure || {}), min };
              if (next.min === undefined && next.max === undefined) return handleParameterChange('tenure', undefined);
              handleParameterChange('tenure', next);
            }}
          />
          <span>to</span>
          <StyledInput
            type="number"
            placeholder="Max years"
            value={parameters.tenure?.max ?? ''}
            onChange={(e) => {
              const max = e.target.value ? parseInt(e.target.value) : undefined;
              const next = { ...(parameters.tenure || {}), max };
              if (next.min === undefined && next.max === undefined) return handleParameterChange('tenure', undefined);
              handleParameterChange('tenure', next);
            }}
          />
        </StyledRow>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Seniority Level</StyledLabel>
        <StyledLabel>Include</StyledLabel>
        <StyledSelect
          multiple
          value={(parameters.seniority?.include || []) as any}
          onChange={(e) => {
            const values = Array.from(e.target.selectedOptions, o => o.value);
            const next = { ...(parameters.seniority || {}), include: values };
            if ((!next.include || next.include.length === 0) && (!next.exclude || next.exclude.length === 0)) return handleParameterChange('seniority', undefined);
            handleParameterChange('seniority', next);
          }}
        >
          <option value="owner">Owner</option>
          <option value="partner">Partner</option>
          <option value="cxo">CxO</option>
          <option value="vp">VP</option>
          <option value="director">Director</option>
          <option value="manager">Manager</option>
          <option value="senior">Senior</option>
          <option value="entry">Entry</option>
          <option value="training">In Training</option>
          <option value="unpaid">Unpaid</option>
        </StyledSelect>
        <StyledLabel>Exclude</StyledLabel>
        <StyledSelect
          multiple
          value={(parameters.seniority?.exclude || []) as any}
          onChange={(e) => {
            const values = Array.from(e.target.selectedOptions, o => o.value);
            const next = { ...(parameters.seniority || {}), exclude: values };
            if ((!next.include || next.include.length === 0) && (!next.exclude || next.exclude.length === 0)) return handleParameterChange('seniority', undefined);
            handleParameterChange('seniority', next);
          }}
        >
          <option value="owner">Owner</option>
          <option value="partner">Partner</option>
          <option value="cxo">CxO</option>
          <option value="vp">VP</option>
          <option value="director">Director</option>
          <option value="manager">Manager</option>
          <option value="senior">Senior</option>
          <option value="entry">Entry</option>
          <option value="training">In Training</option>
          <option value="unpaid">Unpaid</option>
        </StyledSelect>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Function</StyledLabel>
        <StyledTextArea
          value={Array.isArray(parameters.function) ? parameters.function.join('\n') : ''}
          onChange={(e) => {
            const functions = e.target.value.split('\n').filter(func => func.trim());
            handleParameterChange('function', functions.length > 0 ? functions : undefined);
          }}
          placeholder="Enter functions (one per line)&#10;e.g., Engineering"
        />
      </StyledSection>

      <StyledSection>
        <StyledLabel>Network Distance</StyledLabel>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="rec-distance-1"
            checked={(parameters.network_distance || []).includes(1)}
            onChange={(e) => {
              const list: any[] = [...(parameters.network_distance || [])];
              if (e.target.checked) {
                list.push(1);
                handleParameterChange('network_distance', Array.from(new Set(list)) as any);
              } else {
                handleParameterChange('network_distance', list.filter(v => v !== 1));
              }
            }}
          />
          <StyledLabel htmlFor="rec-distance-1">1st</StyledLabel>
        </StyledCheckboxContainer>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="rec-distance-2"
            checked={(parameters.network_distance || []).includes(2)}
            onChange={(e) => {
              const list: any[] = [...(parameters.network_distance || [])];
              if (e.target.checked) {
                list.push(2);
                handleParameterChange('network_distance', Array.from(new Set(list)) as any);
              } else {
                handleParameterChange('network_distance', list.filter(v => v !== 2));
              }
            }}
          />
          <StyledLabel htmlFor="rec-distance-2">2nd</StyledLabel>
        </StyledCheckboxContainer>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="rec-distance-3"
            checked={(parameters.network_distance || []).includes(3)}
            onChange={(e) => {
              const list: any[] = [...(parameters.network_distance || [])];
              if (e.target.checked) {
                list.push(3);
                handleParameterChange('network_distance', Array.from(new Set(list)) as any);
              } else {
                handleParameterChange('network_distance', list.filter(v => v !== 3));
              }
            }}
          />
          <StyledLabel htmlFor="rec-distance-3">3rd</StyledLabel>
        </StyledCheckboxContainer>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="rec-distance-group"
            checked={(parameters.network_distance || []).includes('GROUP')}
            onChange={(e) => {
              const list: any[] = [...(parameters.network_distance || [])];
              if (e.target.checked) {
                list.push('GROUP');
                handleParameterChange('network_distance', Array.from(new Set(list)) as any);
              } else {
                handleParameterChange('network_distance', list.filter(v => v !== 'GROUP'));
              }
            }}
          />
          <StyledLabel htmlFor="rec-distance-group">Group</StyledLabel>
        </StyledCheckboxContainer>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Spoken Languages</StyledLabel>
        {(Array.isArray(parameters.spoken_languages) ? parameters.spoken_languages : []).map((l: any, idx: number) => (
          <StyledRow key={`lang-${idx}`}>
            <StyledInput
              placeholder="Language"
              value={l.language || ''}
              onChange={(e) => {
                const languagesArray = Array.isArray(parameters.spoken_languages) ? parameters.spoken_languages : [];
                const next = [...languagesArray];
                next[idx] = { ...next[idx], language: e.target.value || undefined };
                handleParameterChange('spoken_languages', next.filter(item => item && item.language));
              }}
            />
            <StyledSelect
              value={l.priority || 'CAN_HAVE'}
              onChange={(e) => {
                const languagesArray = Array.isArray(parameters.spoken_languages) ? parameters.spoken_languages : [];
                const next = [...languagesArray];
                next[idx] = { ...next[idx], priority: e.target.value };
                handleParameterChange('spoken_languages', next);
              }}
            >
              <option value="CAN_HAVE">Can have</option>
              <option value="MUST_HAVE">Must have</option>
              <option value="DOESNT_HAVE">Doesn't have</option>
            </StyledSelect>
            <StyledSelect
              value={l.scope || 'FULL_PROFESSIONAL'}
              onChange={(e) => {
                const languagesArray = Array.isArray(parameters.spoken_languages) ? parameters.spoken_languages : [];
                const next = [...languagesArray];
                next[idx] = { ...next[idx], scope: e.target.value };
                handleParameterChange('spoken_languages', next);
              }}
            >
              <option value="ELEMENTARY">Elementary</option>
              <option value="LIMITED_WORKING">Limited working</option>
              <option value="PROFESSIONAL_WORKING">Professional working</option>
              <option value="FULL_PROFESSIONAL">Full professional</option>
              <option value="NATIVE_OR_BILINGUAL">Native or bilingual</option>
            </StyledSelect>
            <StyledRowButton
              onClick={() => {
                const languagesArray = Array.isArray(parameters.spoken_languages) ? parameters.spoken_languages : [];
                const next = [...languagesArray];
                next.splice(idx, 1);
                handleParameterChange('spoken_languages', next.length ? next : undefined);
              }}
            >Remove</StyledRowButton>
          </StyledRow>
        ))}
        <StyledRow>
          <StyledRowButton
            onClick={() => {
              const languagesArray = Array.isArray(parameters.spoken_languages) ? parameters.spoken_languages : [];
              const next = [...languagesArray];
              next.push({ language: '' });
              handleParameterChange('spoken_languages', next);
            }}
          >Add language</StyledRowButton>
        </StyledRow>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Profile Language</StyledLabel>
        <StyledTextArea
          value={Array.isArray(parameters.profile_language) ? parameters.profile_language.join('\n') : ''}
          onChange={(e) => {
            const languages = e.target.value.split('\n').filter(lang => lang.trim());
            handleParameterChange('profile_language', languages.length > 0 ? languages : undefined);
          }}
          placeholder="Enter profile languages (one per line)"
        />
      </StyledSection>

      <StyledSection>
        <StyledLabel>Spotlights</StyledLabel>
        <StyledTextArea
          value={Array.isArray(parameters.spotlights) ? parameters.spotlights.join('\n') : ''}
          onChange={(e) => {
            const spotlights = e.target.value.split('\n').filter(spotlight => spotlight.trim());
            const validSpotlights = spotlights.filter(s => 
              ['OPEN_TO_WORK', 'ACTIVE_TALENT', 'REDISCOVERED_CANDIDATES', 'INTERNAL_CANDIDATES', 'INTERESTED_IN_YOUR_COMPANY', 'HAVE_COMPANY_CONNECTIONS'].includes(s)
            );
            handleParameterChange('spotlights', validSpotlights.length > 0 ? validSpotlights as ('OPEN_TO_WORK' | 'ACTIVE_TALENT' | 'REDISCOVERED_CANDIDATES' | 'INTERNAL_CANDIDATES' | 'INTERESTED_IN_YOUR_COMPANY' | 'HAVE_COMPANY_CONNECTIONS')[] : undefined);
          }}
          placeholder="Enter spotlights (one per line)&#10;Valid options: OPEN_TO_WORK, ACTIVE_TALENT, REDISCOVERED_CANDIDATES, INTERNAL_CANDIDATES, INTERESTED_IN_YOUR_COMPANY, HAVE_COMPANY_CONNECTIONS"
        />
      </StyledSection>

      <StyledSection>
        <StyledLabel>Military Background</StyledLabel>
        <StyledSelect
          value={parameters.has_military_background === undefined ? '' : parameters.has_military_background.toString()}
          onChange={(e) => handleParameterChange('has_military_background', e.target.value === '' ? undefined : e.target.value === 'true')}
        >
          <option value="">Any</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </StyledSelect>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Past Applicants</StyledLabel>
        <StyledSelect
          value={parameters.past_applicants === undefined ? '' : parameters.past_applicants.toString()}
          onChange={(e) => handleParameterChange('past_applicants', e.target.value === '' ? undefined : e.target.value === 'true')}
        >
          <option value="">Any</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </StyledSelect>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Recruiting Activity</StyledLabel>
        <StyledTextArea
          value={Array.isArray(parameters.recruiting_activity) ? parameters.recruiting_activity.map((activity: any) => `${activity.id} (${activity.priority || 'CAN_HAVE'}, ${activity.timespan || 0} days)`).join('\n') : ''}
          onChange={(e) => {
            const lines = e.target.value.split('\n').filter(line => line.trim());
            const activities = lines.map(line => {
              const match = line.match(/^(.+?)\s*\((.+?),\s*(\d+)\s*days?\)$/);
              if (match) {
                return {
                  id: match[1].trim() as 'messages' | 'tags' | 'notes' | 'projects' | 'resumes' | 'reviews',
                  priority: match[2].trim() as 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE',
                  timespan: parseInt(match[3])
                };
              }
              return null;
            }).filter(Boolean);
            handleParameterChange('recruiting_activity', activities.length > 0 ? activities : undefined);
          }}
          placeholder="Enter recruiting activity (format: activity (priority, days))&#10;e.g., messages (MUST_HAVE, 90 days)"
        />
      </StyledSection>

      <StyledSection>
        <StyledLabel>Hide Previously Viewed (days)</StyledLabel>
        <StyledInput
          type="number"
          value={parameters.hide_previously_viewed?.timespan || ''}
          onChange={(e) => handleParameterChange('hide_previously_viewed', e.target.value ? { timespan: parseInt(e.target.value) } : undefined)}
          placeholder="e.g., 30"
        />
      </StyledSection>

      <StyledSection>
        <StyledLabel>Recently Joined Ranges (days)</StyledLabel>
        {(Array.isArray(parameters.recently_joined) ? parameters.recently_joined : []).map((r: any, idx: number) => (
          <StyledRow key={`recent-${idx}`}>
            <StyledInput
              type="number"
              placeholder="Min days"
              value={r?.min ?? ''}
              onChange={(e) => {
                const recentArray = Array.isArray(parameters.recently_joined) ? parameters.recently_joined : [];
                const next = [...recentArray];
                next[idx] = { ...(next[idx] || {}), min: e.target.value ? parseInt(e.target.value) : undefined };
                handleParameterChange('recently_joined', next);
              }}
            />
            <span>to</span>
            <StyledInput
              type="number"
              placeholder="Max days"
              value={r?.max ?? ''}
              onChange={(e) => {
                const recentArray = Array.isArray(parameters.recently_joined) ? parameters.recently_joined : [];
                const next = [...recentArray];
                next[idx] = { ...(next[idx] || {}), max: e.target.value ? parseInt(e.target.value) : undefined };
                handleParameterChange('recently_joined', next);
              }}
            />
            <StyledRowButton
              onClick={() => {
                const recentArray = Array.isArray(parameters.recently_joined) ? parameters.recently_joined : [];
                const next = [...recentArray];
                next.splice(idx, 1);
                handleParameterChange('recently_joined', next.length ? next : undefined);
              }}
            >Remove</StyledRowButton>
          </StyledRow>
        ))}
        <StyledRow>
          <StyledRowButton
            onClick={() => {
              const recentArray = Array.isArray(parameters.recently_joined) ? parameters.recently_joined : [];
              const next = [...recentArray];
              next.push({});
              handleParameterChange('recently_joined', next);
            }}
          >Add range</StyledRowButton>
        </StyledRow>
      </StyledSection>

      <StyledSection>
        <StyledLabel>First Name</StyledLabel>
        <StyledTextArea
          value={Array.isArray(parameters.first_name) ? parameters.first_name.join('\n') : ''}
          onChange={(e) => {
            const names = e.target.value.split('\n').filter(name => name.trim());
            handleParameterChange('first_name', names.length > 0 ? names : undefined);
          }}
          placeholder="Enter first names (one per line)"
        />
      </StyledSection>

      <StyledSection>
        <StyledLabel>Last Name</StyledLabel>
        <StyledTextArea
          value={Array.isArray(parameters.last_name) ? parameters.last_name.join('\n') : ''}
          onChange={(e) => {
            const names = e.target.value.split('\n').filter(name => name.trim());
            handleParameterChange('last_name', names.length > 0 ? names : undefined);
          }}
          placeholder="Enter last names (one per line)"
        />
      </StyledSection>

      <StyledSection>
        <StyledLabel>Notes</StyledLabel>
        <StyledTextArea
          value={Array.isArray(parameters.notes) ? parameters.notes.join('\n') : ''}
          onChange={(e) => {
            const notes = e.target.value.split('\n').filter(note => note.trim());
            handleParameterChange('notes', notes.length > 0 ? notes : undefined);
          }}
          placeholder="Enter notes (one per line)"
        />
      </StyledSection>
    </>
  );
};
