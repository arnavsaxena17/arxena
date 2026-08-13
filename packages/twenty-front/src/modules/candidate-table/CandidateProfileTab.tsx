import { styled } from '@linaria/react';
import { getCandidateCustomField } from 'twenty-shared/utils';
import { IconBuildingSkyscraper, IconCalendar, IconCurrencyRupee, IconMail, IconMap, IconPhone, IconUser } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

type CandidateProfileTabProps = {
  candidateData: any;
  isLoading?: boolean;
};

const StyledContainer = styled.div`
  background-color: ${themeCssVariables.background.primary};
  height: 100%;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledSection = styled.div`
  margin-bottom: ${themeCssVariables.spacing[4]};
`;

const StyledSectionTitle = styled.h3`
  border-bottom: 2px solid ${themeCssVariables.border.color.light};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0 0 ${themeCssVariables.spacing[2]} 0;
  padding-bottom: ${themeCssVariables.spacing[1]};
`;

const StyledField = styled.div`
  align-items: center;
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  margin-bottom: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledFieldLabel = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  min-width: 120px;
`;

const StyledFieldValue = styled.span`
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledIconWrapper = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  width: 20px;
`;

const StyledExperienceItem = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  border-left: 4px solid ${themeCssVariables.color.blue8};
  border-radius: ${themeCssVariables.border.radius.md};
  margin-bottom: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledEducationItem = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  border-left: 4px solid ${themeCssVariables.color.green8};
  border-radius: ${themeCssVariables.border.radius.md};
  margin-bottom: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledSkillsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
  margin-top: ${themeCssVariables.spacing[2]};
`;

const StyledSkillTag = styled.span`
  background-color: ${themeCssVariables.color.blue2};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.color.blue8};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: ${themeCssVariables.spacing[0.5]} ${themeCssVariables.spacing[1.5]};
`;

const StyledLoadingContainer = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  height: 200px;
  justify-content: center;
`;

export const CandidateProfileTab = ({ candidateData, isLoading }: CandidateProfileTabProps) => {
  const getFieldValue = (fieldName: string) => {
    const value = getCandidateCustomField(candidateData, fieldName);
    if (value === null || value === undefined) {
      return '';
    }

    return typeof value === 'string' ? value : JSON.stringify(value);
  };

  const parseJsonField = (fieldName: string) => {
    const value = getCandidateCustomField(candidateData, fieldName);
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'object') {
      return value;
    }

    try {
      return typeof value === 'string' ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  };

  const experience = parseJsonField('experience');
  const education = parseJsonField('education');
  const skills = parseJsonField('skills');
  const locations = parseJsonField('locations');

  if (isLoading) {
    return (
      <StyledContainer>
        <StyledLoadingContainer>Loading candidate profile...</StyledLoadingContainer>
      </StyledContainer>
    );
  }

  if (!candidateData) {
    return (
      <StyledContainer>
        <div>No candidate data available</div>
      </StyledContainer>
    );
  }

  return (
    <StyledContainer>
      {/* Basic Information */}
      <StyledSection>
        <StyledSectionTitle>Basic Information</StyledSectionTitle>

        <StyledField>
          <StyledIconWrapper>
            <IconUser size={16} />
          </StyledIconWrapper>
          <StyledFieldLabel>Name:</StyledFieldLabel>
          <StyledFieldValue>{candidateData.name}</StyledFieldValue>
        </StyledField>

        {(() => {
          const phoneValue = typeof candidateData.phone === 'string'
            ? candidateData.phone
            : candidateData.phone?.primaryPhoneNumber || '';
          return phoneValue && (
            <StyledField>
              <StyledIconWrapper>
                <IconPhone size={16} />
              </StyledIconWrapper>
              <StyledFieldLabel>Phone:</StyledFieldLabel>
              <StyledFieldValue>{phoneValue}</StyledFieldValue>
            </StyledField>
          );
        })()}

        {(() => {
          const emailValue = typeof candidateData.email === 'string'
            ? candidateData.email
            : candidateData.email?.primaryEmail || '';
          return emailValue && (
            <StyledField>
              <StyledIconWrapper>
                <IconMail size={16} />
              </StyledIconWrapper>
              <StyledFieldLabel>Email:</StyledFieldLabel>
              <StyledFieldValue>{emailValue}</StyledFieldValue>
            </StyledField>
          );
        })()}

        {getFieldValue('location_name') && (
          <StyledField>
            <StyledIconWrapper>
              <IconMap size={16} />
            </StyledIconWrapper>
            <StyledFieldLabel>Location:</StyledFieldLabel>
            <StyledFieldValue>{getFieldValue('location_name')}</StyledFieldValue>
          </StyledField>
        )}

        {getFieldValue('inferred_years_experience') && (
          <StyledField>
            <StyledIconWrapper>
              <IconCalendar size={16} />
            </StyledIconWrapper>
            <StyledFieldLabel>Experience:</StyledFieldLabel>
            <StyledFieldValue>{getFieldValue('inferred_years_experience')}</StyledFieldValue>
          </StyledField>
        )}

        {getFieldValue('inferred_salary') && (
          <StyledField>
            <StyledIconWrapper>
              <IconCurrencyRupee size={16} />
            </StyledIconWrapper>
            <StyledFieldLabel>Current CTC:</StyledFieldLabel>
            <StyledFieldValue>{getFieldValue('inferred_salary')} LPA</StyledFieldValue>
          </StyledField>
        )}

        {getFieldValue('industry') && (
          <StyledField>
            <StyledIconWrapper>
              <IconBuildingSkyscraper size={16} />
            </StyledIconWrapper>
            <StyledFieldLabel>Industry:</StyledFieldLabel>
            <StyledFieldValue>{getFieldValue('industry')}</StyledFieldValue>
          </StyledField>
        )}
      </StyledSection>

      {/* Profile Summary */}
      {getFieldValue('profile_title') && (
        <StyledSection>
          <StyledSectionTitle>Profile Summary</StyledSectionTitle>
          <div style={{
            padding: '16px',
            backgroundColor: 'var(--t-background-tertiary)',
            borderRadius: '8px',
            border: '1px solid var(--t-border-color-medium)',
            fontSize: '14px',
            lineHeight: '1.5',
            color: 'var(--t-font-color-secondary)'
          }}>
            {getFieldValue('profile_title')}
          </div>
        </StyledSection>
      )}

      {/* Experience */}
      {experience && Array.isArray(experience) && experience.length > 0 && (
        <StyledSection>
          <StyledSectionTitle>Work Experience</StyledSectionTitle>
          {experience.map((exp: any, index: number) => (
            <StyledExperienceItem key={index}>
              <div style={{ fontWeight: '600', marginBottom: '8px', fontSize: '15px' }}>
                {exp.title?.name || 'Position'}
              </div>
              <div style={{ color: '#6c757d', marginBottom: '4px', fontSize: '14px' }}>
                {exp.company?.name || 'Company'}
                {exp.company?.location?.locality && ` • ${exp.company.location.locality}`}
              </div>
              <div style={{ color: '#6c757d', fontSize: '13px' }}>
                {exp.start_date && exp.end_date
                  ? `${exp.start_date} - ${exp.end_date}`
                  : exp.start_date || 'Current'
                }
                {exp.experience_years && ` • ${exp.experience_years} years`}
                {exp.salary_ctc && ` • ₹${exp.salary_ctc}L`}
              </div>
              {exp.company?.profiles && (
                <div style={{ marginTop: '8px', fontSize: '13px', color: '#495057', fontStyle: 'italic' }}>
                  {exp.company.profiles}
                </div>
              )}
            </StyledExperienceItem>
          ))}
        </StyledSection>
      )}

      {/* Education */}
      {education && Array.isArray(education) && education.length > 0 && (
        <StyledSection>
          <StyledSectionTitle>Education</StyledSectionTitle>
          {education.map((edu: any, index: number) => (
            <StyledEducationItem key={index}>
              <div style={{ fontWeight: '600', marginBottom: '8px', fontSize: '15px' }}>
                {edu.education_course || 'Degree'}
              </div>
              <div style={{ color: '#6c757d', marginBottom: '4px', fontSize: '14px' }}>
                {edu.institute?.name || 'Institution'}
                {edu.institute?.location && ` • ${edu.institute.location}`}
              </div>
              <div style={{ color: '#6c757d', fontSize: '13px' }}>
                {edu.start_date && edu.end_date
                  ? `${edu.start_date} - ${edu.end_date}`
                  : edu.end_date || 'Graduated'
                }
                {edu.gpa && ` • GPA: ${edu.gpa}`}
                {edu.majors && ` • ${edu.majors}`}
              </div>
            </StyledEducationItem>
          ))}
        </StyledSection>
      )}

      {/* Skills */}
      {skills && Array.isArray(skills) && skills.length > 0 && (
        <StyledSection>
          <StyledSectionTitle>Skills</StyledSectionTitle>
          <StyledSkillsContainer>
            {skills.map((skill: string, index: number) => (
              <StyledSkillTag key={index}>{skill}</StyledSkillTag>
            ))}
          </StyledSkillsContainer>
        </StyledSection>
      )}

      {/* Additional Information */}
      <StyledSection>
        <StyledSectionTitle>Additional Information</StyledSectionTitle>

        {getFieldValue('notice_period') && (
          <StyledField>
            <StyledFieldLabel>Notice Period:</StyledFieldLabel>
            <StyledFieldValue>{getFieldValue('notice_period')}</StyledFieldValue>
          </StyledField>
        )}

        {getFieldValue('marital_status') && (
          <StyledField>
            <StyledFieldLabel>Marital Status:</StyledFieldLabel>
            <StyledFieldValue>{getFieldValue('marital_status')}</StyledFieldValue>
          </StyledField>
        )}

        {getFieldValue('home_town') && (
          <StyledField>
            <StyledFieldLabel>Home Town:</StyledFieldLabel>
            <StyledFieldValue>{getFieldValue('home_town')}</StyledFieldValue>
          </StyledField>
        )}

        {getFieldValue('preferred_locations') && (
          <StyledField>
            <StyledFieldLabel>Preferred Locations:</StyledFieldLabel>
            <StyledFieldValue>{getFieldValue('preferred_locations')}</StyledFieldValue>
          </StyledField>
        )}
      </StyledSection>
    </StyledContainer>
  );
};
