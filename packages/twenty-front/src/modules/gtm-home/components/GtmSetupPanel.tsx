import { isNonEmptyString } from '@sniptt/guards';
import { styled } from '@linaria/react';
import { useEffect, useState } from 'react';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { GtmChipTagInput } from '@/gtm-home/components/GtmChipTagInput';
import { type GtmWorkspaceCompany } from '@/gtm-home/types/gtm-home.types';
import {
  GTM_ICP_CHIP_FIELDS,
  parseIcpSpecObject,
  readIcpChipValues,
  writeIcpChipValues,
  type GtmIcpChipFieldKey,
} from '@/gtm-home/utils/gtm-icp-chip-fields.util';
import { TextArea } from '@/ui/input/components/TextArea';

const StyledPanel = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[5]};
  min-height: 100%;
`;

const StyledSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledTitleRow = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
`;

const StyledTitleGroup = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledTitle = styled.h2`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0;
`;

const StyledBadge = styled.span`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.xs};
  padding: 2px ${themeCssVariables.spacing[1]};
`;

const StyledMetaRow = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledSellerName = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledBody = styled.p`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.5;
  margin: 0;
`;

const StyledFieldLabel = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledMuted = styled.span`
  color: ${themeCssVariables.font.color.light};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledJsonToggle = styled.button`
  align-self: flex-start;
  appearance: none;
  background: none;
  border: none;
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
`;

const StyledStickyBar = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.primary};
  border-top: 1px solid ${themeCssVariables.border.color.medium};
  bottom: 0;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
  margin-top: auto;
  padding: ${themeCssVariables.spacing[3]} 0 ${themeCssVariables.spacing[1]};
  position: sticky;
  z-index: 1;
`;

const formatIcpDraft = (icpSpec: string | null): string => {
  if (!isNonEmptyString(icpSpec)) {
    return '';
  }

  try {
    return JSON.stringify(JSON.parse(icpSpec), null, 2);
  } catch {
    return icpSpec;
  }
};

type GtmSetupPanelProps = {
  workspaceCompany: GtmWorkspaceCompany;
  icpSpec: string | null;
  isIcpRunOverride: boolean;
  hasWorkspaceProfile: boolean;
  hasProject: boolean;
  isSavingIcp: boolean;
  onRegenerateIcp: () => void;
  isRegeneratingIcp: boolean;
  onSaveIcp: (input: { icpSpec: string }) => Promise<void>;
  onFindCompanies: () => void;
  onFindPeople: () => void;
};

export const GtmSetupPanel = ({
  workspaceCompany,
  icpSpec,
  isIcpRunOverride,
  hasWorkspaceProfile,
  hasProject,
  isSavingIcp,
  onRegenerateIcp,
  isRegeneratingIcp,
  onSaveIcp,
  onFindCompanies,
  onFindPeople,
}: GtmSetupPanelProps) => {
  const [icpDraft, setIcpDraft] = useState(() => formatIcpDraft(icpSpec));
  const [isJsonOpen, setIsJsonOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  useEffect(() => {
    setIcpDraft(formatIcpDraft(icpSpec));
  }, [icpSpec]);

  const canPersist = hasWorkspaceProfile || hasProject;
  const parsedIcp = parseIcpSpecObject(icpDraft);
  const canEditChips = parsedIcp !== null || icpDraft.trim().length === 0;
  const sellerChips = [
    workspaceCompany.industry,
    workspaceCompany.employeeRange
      ? `Size: ${workspaceCompany.employeeRange}`
      : '',
    workspaceCompany.hq ? `HQ: ${workspaceCompany.hq}` : '',
  ].filter(isNonEmptyString);
  const summary = workspaceCompany.summary ?? '';
  const isSummaryLong = summary.length > 160;
  const visibleSummary =
    isSummaryOpen || !isSummaryLong ? summary : `${summary.slice(0, 160)}…`;

  const updateChipField = (key: GtmIcpChipFieldKey, values: string[]) => {
    setIcpDraft((current) => writeIcpChipValues(current, key, values));
  };

  const handleSaveAll = async () => {
    await onSaveIcp({
      icpSpec: icpDraft,
    });
  };

  return (
    <StyledPanel>
      <StyledSection>
        <StyledTitle>Seller company</StyledTitle>
        <StyledMetaRow>
          <StyledSellerName>
            {workspaceCompany.name}
            {isNonEmptyString(workspaceCompany.domain)
              ? ` (${workspaceCompany.domain})`
              : ''}
          </StyledSellerName>
          {sellerChips.map((chip) => (
            <StyledBadge key={chip}>{chip}</StyledBadge>
          ))}
        </StyledMetaRow>
        {isNonEmptyString(summary) && (
          <>
            <StyledBody>{visibleSummary}</StyledBody>
            {isSummaryLong && (
              <StyledJsonToggle
                type="button"
                onClick={() => setIsSummaryOpen((open) => !open)}
              >
                {isSummaryOpen ? 'Show less' : 'Show more'}
              </StyledJsonToggle>
            )}
          </>
        )}
      </StyledSection>

      <StyledSection>
        <StyledTitleRow>
          <StyledTitleGroup>
            <StyledTitle>ICP</StyledTitle>
            <StyledBadge>
              {isIcpRunOverride ? 'Run override' : 'Workspace default'}
            </StyledBadge>
          </StyledTitleGroup>
          <Button
            title={isRegeneratingIcp ? 'Regenerating…' : 'Regenerate'}
            variant="secondary"
            size="small"
            onClick={onRegenerateIcp}
            disabled={isRegeneratingIcp}
          />
        </StyledTitleRow>
        {GTM_ICP_CHIP_FIELDS.map((field) => (
          <div key={field.key}>
            <StyledFieldLabel>{field.label}</StyledFieldLabel>
            <GtmChipTagInput
              values={readIcpChipValues(icpDraft, field.key)}
              onChange={(next) => updateChipField(field.key, next)}
              disabled={!canEditChips}
              placeholder={`Add ${field.label.toLowerCase()}`}
            />
          </div>
        ))}
        {!canEditChips && (
          <StyledMuted>
            ICP JSON is invalid — open Edit as JSON to fix it before changing
            chips.
          </StyledMuted>
        )}
        <StyledJsonToggle
          type="button"
          onClick={() => setIsJsonOpen((open) => !open)}
        >
          {isJsonOpen ? 'Hide JSON' : 'Edit as JSON'}
        </StyledJsonToggle>
        {isJsonOpen && (
          <TextArea
            textAreaId="gtm-setup-icp"
            minRows={8}
            maxRows={16}
            value={icpDraft}
            onChange={setIcpDraft}
            placeholder="ICP JSON will appear here after bootstrap or regenerate."
          />
        )}
      </StyledSection>

      <StyledStickyBar>
        <StyledActions>
          <Button
            title={isSavingIcp ? 'Saving…' : 'Save'}
            variant="secondary"
            size="small"
            onClick={() => {
              void handleSaveAll();
            }}
            disabled={!canPersist || isSavingIcp}
          />
          <Button
            title="Find companies"
            variant="primary"
            size="small"
            onClick={onFindCompanies}
            disabled={!hasProject}
          />
          <Button
            title="Find people"
            variant="secondary"
            size="small"
            onClick={onFindPeople}
            disabled={!hasProject}
          />
        </StyledActions>
        {!hasProject && (
          <StyledMuted>
            Create or select a GTM run first, then use these actions.
          </StyledMuted>
        )}
        {hasProject && !hasWorkspaceProfile && (
          <StyledMuted>
            Workspace GTM profile is still provisioning — Save writes to this
            run until the profile exists.
          </StyledMuted>
        )}
      </StyledStickyBar>
    </StyledPanel>
  );
};
