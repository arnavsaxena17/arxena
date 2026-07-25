import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { IconBuildingSkyscraper, IconCalendar, IconCurrencyRupee, IconMail, IconMap, IconPhone, IconUser } from 'twenty-ui/icon';
import { getCandidateCustomField } from 'twenty-shared/utils';

type CandidateProfileTabProps = {
  candidateData: any;
  isLoading?: boolean;
};

const StyledContainer = styled.div`
  padding: ${themeCssVariables.spacing[3]};
  height: 100%;
  overflow-y: auto;
  background-color: ${themeCssVariables.background.primary};
`;

const StyledSection = styled.div`
  margin-bottom: ${themeCssVariables.spacing[4]};
`;

const StyledSectionTitle = styled.h3`
  margin: 0 0 ${themeCssVariables.spacing[2]} 0;
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.primary};
  border-bottom: 2px solid ${themeCssVariables.border.color.light};
  padding-bottom: ${themeCssVariables.spacing[1]};
`;

const StyledField = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
  margin-bottom: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]};
  background-color: ${themeCssVariables.background.secondary};
  border-radius: ${themeCssVariables.border.radius.md};
  border: 1px solid ${themeCssVariables.border.color.light};
`;

const StyledFieldLabel = styled.span`
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.secondary};
  min-width: 120px;
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledFieldValue = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  flex: 1;
`;

const StyledIconWrapper = styled.div`
  display: flex;
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  width: 20px;
`;

const StyledExperienceItem = styled.div`
  margin-bottom: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[2]};
  background-color: ${themeCssVariables.background.secondary};
  border-radius: ${themeCssVariables.border.radius.md};
  border-left: 4px solid ${themeCssVariables.color.blue8};
`;

const StyledEducationItem = styled.div`
  margin-bottom: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[2]};
  background-color: ${themeCssVariables.background.secondary};
  border-radius: ${themeCssVariables.border.radius.md};
  border-left: 4px solid ${themeCssVariables.color.green8};
`;

const StyledSkillsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
  margin-top: ${themeCssVariables.spacing[2]};
`;

const StyledSkillTag = styled.span`
  background-color: ${themeCssVariables.color.blue2};
  color: ${themeCssVariables.color.blue8};
  padding: ${themeCssVariables.spacing[0.5]} ${themeCssVariables.spacing[1.5]};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledLoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: ${themeCssVariables.font.color.secondary};
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
            backgroundColor: '#f8f9fa', 
            borderRadius: '8px',
            border: '1px solid #e9ecef',
            fontSize: '14px',
            lineHeight: '1.5',
            color: '#495057'
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
