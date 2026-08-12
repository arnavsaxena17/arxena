import { isNonEmptyString } from '@sniptt/guards';
import { styled } from '@linaria/react';
import { useEffect, useState } from 'react';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { type GtmWorkspaceCompany } from '@/gtm-home/types/gtm-home.types';
import { TextArea } from '@/ui/input/components/TextArea';

const StyledPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
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

const StyledBody = styled.p`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.5;
  margin: 0;
  white-space: pre-wrap;
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
  icpBlurb: string | null;
  companySearchBlurb: string | null;
  peopleSearchBlurb: string | null;
  isIcpRunOverride: boolean;
  hasWorkspaceProfile: boolean;
  hasProject: boolean;
  isSavingIcp: boolean;
  isSavingCompanySearchBlurb: boolean;
  isSavingPeopleSearchBlurb: boolean;
  onRegenerateIcp: () => void;
  onRegenerateCompanySearchBlurb: () => void;
  onRegeneratePeopleSearchBlurb: () => void;
  onSaveIcp: (input: { icpSpec: string; icpBlurb: string }) => Promise<void>;
  onSaveCompanySearchBlurb: (value: string) => Promise<void>;
  onSavePeopleSearchBlurb: (value: string) => Promise<void>;
  onFindCompanies: () => void;
  onFindPeople: () => void;
};

export const GtmSetupPanel = ({
  workspaceCompany,
  icpSpec,
  icpBlurb,
  companySearchBlurb,
  peopleSearchBlurb,
  isIcpRunOverride,
  hasWorkspaceProfile,
  hasProject,
  isSavingIcp,
  isSavingCompanySearchBlurb,
  isSavingPeopleSearchBlurb,
  onRegenerateIcp,
  onRegenerateCompanySearchBlurb,
  onRegeneratePeopleSearchBlurb,
  onSaveIcp,
  onSaveCompanySearchBlurb,
  onSavePeopleSearchBlurb,
  onFindCompanies,
  onFindPeople,
}: GtmSetupPanelProps) => {
  const [icpDraft, setIcpDraft] = useState(() => formatIcpDraft(icpSpec));
  const [icpBlurbDraft, setIcpBlurbDraft] = useState(() => icpBlurb ?? '');
  const [companySearchBlurbDraft, setCompanySearchBlurbDraft] = useState(
    () => companySearchBlurb ?? '',
  );
  const [peopleSearchBlurbDraft, setPeopleSearchBlurbDraft] = useState(
    () => peopleSearchBlurb ?? '',
  );

  useEffect(() => {
    setIcpDraft(formatIcpDraft(icpSpec));
  }, [icpSpec]);

  useEffect(() => {
    setIcpBlurbDraft(icpBlurb ?? '');
  }, [icpBlurb]);

  useEffect(() => {
    setCompanySearchBlurbDraft(companySearchBlurb ?? '');
  }, [companySearchBlurb]);

  useEffect(() => {
    setPeopleSearchBlurbDraft(peopleSearchBlurb ?? '');
  }, [peopleSearchBlurb]);

  const canPersist = hasWorkspaceProfile || hasProject;

  return (
    <StyledPanel>
      <StyledSection>
        <StyledTitle>Seller company</StyledTitle>
        <StyledBody>
          {[
            `${workspaceCompany.name}${
              isNonEmptyString(workspaceCompany.domain)
                ? ` (${workspaceCompany.domain})`
                : ''
            }`,
            workspaceCompany.industry
              ? `Industry: ${workspaceCompany.industry}`
              : null,
            workspaceCompany.employeeRange
              ? `Size: ${workspaceCompany.employeeRange}`
              : null,
            workspaceCompany.hq ? `HQ: ${workspaceCompany.hq}` : null,
            workspaceCompany.summary,
          ]
            .filter(Boolean)
            .join('\n')}
        </StyledBody>
      </StyledSection>

      <StyledSection>
        <StyledTitleRow>
          <StyledTitleGroup>
            <StyledTitle>ICP</StyledTitle>
            <StyledBadge>
              {isIcpRunOverride ? 'Run override' : 'Workspace default'}
            </StyledBadge>
          </StyledTitleGroup>
          <StyledActions>
            <Button
              title="Regenerate"
              variant="secondary"
              size="small"
              onClick={onRegenerateIcp}
              disabled={!hasProject}
            />
            <Button
              title={isSavingIcp ? 'Saving…' : 'Save'}
              variant="primary"
              size="small"
              onClick={() => {
                void onSaveIcp({
                  icpSpec: icpDraft,
                  icpBlurb: icpBlurbDraft,
                });
              }}
              disabled={!canPersist || isSavingIcp}
            />
          </StyledActions>
        </StyledTitleRow>
        <StyledFieldLabel>Description</StyledFieldLabel>
        <TextArea
          textAreaId="gtm-setup-icp-blurb"
          minRows={3}
          maxRows={8}
          value={icpBlurbDraft}
          onChange={setIcpBlurbDraft}
          placeholder="Short NL definition of who you sell to will appear here after bootstrap or regenerate."
        />
        <StyledFieldLabel>JSON</StyledFieldLabel>
        <TextArea
          textAreaId="gtm-setup-icp"
          minRows={6}
          maxRows={16}
          value={icpDraft}
          onChange={setIcpDraft}
          placeholder="ICP JSON will appear here after bootstrap or regenerate."
        />
      </StyledSection>

      <StyledSection>
        <StyledTitleRow>
          <StyledTitle>Company search</StyledTitle>
          <StyledActions>
            <Button
              title="Regenerate"
              variant="secondary"
              size="small"
              onClick={onRegenerateCompanySearchBlurb}
              disabled={!hasProject}
            />
            <Button
              title={isSavingCompanySearchBlurb ? 'Saving…' : 'Save'}
              variant="primary"
              size="small"
              onClick={() => {
                void onSaveCompanySearchBlurb(companySearchBlurbDraft);
              }}
              disabled={!canPersist || isSavingCompanySearchBlurb}
            />
          </StyledActions>
        </StyledTitleRow>
        <TextArea
          textAreaId="gtm-setup-company-search-blurb"
          minRows={3}
          maxRows={10}
          value={companySearchBlurbDraft}
          onChange={setCompanySearchBlurbDraft}
          placeholder="Will be generated when ICP is saved on the workspace profile."
        />
      </StyledSection>

      <StyledSection>
        <StyledTitleRow>
          <StyledTitle>People search</StyledTitle>
          <StyledActions>
            <Button
              title="Regenerate"
              variant="secondary"
              size="small"
              onClick={onRegeneratePeopleSearchBlurb}
              disabled={!hasProject}
            />
            <Button
              title={isSavingPeopleSearchBlurb ? 'Saving…' : 'Save'}
              variant="primary"
              size="small"
              onClick={() => {
                void onSavePeopleSearchBlurb(peopleSearchBlurbDraft);
              }}
              disabled={!canPersist || isSavingPeopleSearchBlurb}
            />
          </StyledActions>
        </StyledTitleRow>
        <TextArea
          textAreaId="gtm-setup-people-search-blurb"
          minRows={3}
          maxRows={10}
          value={peopleSearchBlurbDraft}
          onChange={setPeopleSearchBlurbDraft}
          placeholder="Will be generated when ICP is saved on the workspace profile."
        />
      </StyledSection>

      <StyledActions>
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
          Workspace GTM profile is still provisioning — Save writes to this run
          until the profile exists.
        </StyledMuted>
      )}
    </StyledPanel>
  );
};
