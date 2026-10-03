import { styled } from '@linaria/react';
import { isNonEmptyString } from '@sniptt/guards';
import { type ReactNode, useState } from 'react';
import {
  IconBrandLinkedin,
  IconClock,
  IconCurrencyDollar,
  IconFileText,
  IconMail,
  IconMap,
  IconPhone,
  IconTag,
} from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { CandidateProfileTab } from '@/candidate-table/CandidateProfileTab';
import { CandidateWarmPathTab } from '@/candidate-table/CandidateWarmPathTab';
import {
  CandidateDrawerPropertyList,
  CandidateDrawerPropertyRow,
} from '@/candidate-table/components/CandidateDrawerPropertyList';
import { type useCandidateDrawerRecord } from '@/candidate-table/hooks/useCandidateDrawerRecord';
import { LinkDisplay } from '@/ui/field/display/components/LinkDisplay';

const StyledSection = styled.section`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledSectionTitle = styled.h3`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0;
`;

const StyledText = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  line-height: ${themeCssVariables.text.lineHeight.lg};
`;

const StyledMuted = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  line-height: ${themeCssVariables.text.lineHeight.lg};
`;

const StyledEmbedded = styled.div`
  margin: 0 -${themeCssVariables.spacing[4]};
`;

const StyledPropertyListWrapper = styled.div`
  margin: 0 -${themeCssVariables.spacing[3]};

  & > div {
    border-bottom: none;
    padding-bottom: 0;
    padding-top: 0;
  }
`;

const CONNECTION_DEGREE_LABELS: Record<number, string> = {
  1: '1st-degree connection',
  2: '2nd-degree connection',
  3: '3rd-degree connection',
};

const readOtherFields = (row: Record<string, unknown> | undefined) => {
  const otherFields = row?.otherFields;

  return otherFields !== null && typeof otherFields === 'object'
    ? (otherFields as Record<string, unknown>)
    : {};
};

type CandidateDrawerContextTabProps = {
  record: ReturnType<typeof useCandidateDrawerRecord>;
  selectedTableRow: Record<string, unknown> | undefined;
  isCandidateDataLoading: boolean;
  renderCv: () => ReactNode;
};

export const CandidateDrawerContextTab = ({
  record,
  selectedTableRow,
  isCandidateDataLoading,
  renderCv,
}: CandidateDrawerContextTabProps) => {
  const [isCvOpen, setIsCvOpen] = useState(false);
  const { fields, candidateData } = record;

  if (fields === null) {
    return null;
  }

  const otherFields = readOtherFields(selectedTableRow);
  const connectionDegree =
    typeof otherFields.connectionDegree === 'number'
      ? otherFields.connectionDegree
      : null;
  const personaPriorityScore =
    typeof otherFields.personaPriorityScore === 'number'
      ? otherFields.personaPriorityScore
      : null;
  const warmPath =
    typeof otherFields.warmPath === 'string' ? otherFields.warmPath : '';

  const pickSignals = [
    personaPriorityScore !== null
      ? `Persona priority ${Math.round(personaPriorityScore)}/100`
      : null,
    connectionDegree !== null
      ? (CONNECTION_DEGREE_LABELS[connectionDegree] ??
        `${connectionDegree}th-degree connection`)
      : null,
    isNonEmptyString(warmPath) ? `Warm path: ${warmPath}` : null,
  ].filter((signal): signal is string => signal !== null);

  return (
    <div>
      <StyledSection>
        <StyledSectionTitle>Profile</StyledSectionTitle>
        <StyledPropertyListWrapper>
          <CandidateDrawerPropertyList>
            {fields.email.length > 0 && (
              <CandidateDrawerPropertyRow
                Icon={IconMail}
                label="Email"
                value={fields.email}
                title="Copy email"
                onClick={() => record.copyToClipboard(fields.email, 'Email')}
              />
            )}
            {fields.phone.length > 0 && (
              <CandidateDrawerPropertyRow
                Icon={IconPhone}
                label="Phone"
                value={fields.phone}
                title="Copy phone number"
                onClick={() =>
                  record.copyToClipboard(fields.phone, 'Phone number')
                }
              />
            )}
            {fields.location.length > 0 && (
              <CandidateDrawerPropertyRow
                Icon={IconMap}
                label="Location"
                value={fields.location}
                title={fields.location}
              />
            )}
            {fields.experience.length > 0 && (
              <CandidateDrawerPropertyRow
                Icon={IconClock}
                label="Experience"
                value={fields.experience}
              />
            )}
            {fields.salary.length > 0 && (
              <CandidateDrawerPropertyRow
                Icon={IconCurrencyDollar}
                label="Salary"
                value={`${fields.salary}L`}
              />
            )}
            {fields.industry.length > 0 && (
              <CandidateDrawerPropertyRow
                Icon={IconTag}
                label="Industry"
                value={fields.industry}
                title={fields.industry}
              />
            )}
            {fields.profileUrl.length > 0 && (
              <CandidateDrawerPropertyRow
                Icon={IconBrandLinkedin}
                label="LinkedIn"
                value={<LinkDisplay value={{ url: fields.profileUrl }} />}
              />
            )}
          </CandidateDrawerPropertyList>
        </StyledPropertyListWrapper>
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Why this person was picked</StyledSectionTitle>
        {pickSignals.length > 0 ? (
          <StyledText>{pickSignals.join(' · ')}</StyledText>
        ) : (
          <StyledMuted>No fit signals recorded for this person.</StyledMuted>
        )}
        <StyledMuted>
          Fit reasoning, org-chart position and company news aren't captured
          yet.
        </StyledMuted>
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Warm path</StyledSectionTitle>
        <StyledEmbedded>
          <CandidateWarmPathTab candidateData={candidateData} isActive />
        </StyledEmbedded>
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Full profile</StyledSectionTitle>
        <StyledEmbedded>
          <CandidateProfileTab
            candidateData={candidateData}
            isLoading={isCandidateDataLoading}
          />
        </StyledEmbedded>
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>CV</StyledSectionTitle>
        <div>
          <Button
            Icon={IconFileText}
            title={isCvOpen ? 'Hide CV' : 'Show CV'}
            variant="secondary"
            size="small"
            onClick={() => setIsCvOpen((open) => !open)}
          />
        </div>
        {isCvOpen && <StyledEmbedded>{renderCv()}</StyledEmbedded>}
      </StyledSection>
    </div>
  );
};
