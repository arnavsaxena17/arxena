import { isNonEmptyString } from '@sniptt/guards';
import { styled } from '@linaria/react';
import { useEffect, useState } from 'react';
import { getValidTimeZoneOrUndefined } from 'twenty-shared/utils';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { GtmChipTagInput } from '@/gtm-home/components/GtmChipTagInput';
import {
  type GtmOutreachSendMode,
  type GtmWorkspaceCompany,
} from '@/gtm-home/types/gtm-home.types';
import {
  GTM_ICP_CHIP_FIELDS,
  parseIcpSpecObject,
  readIcpChipValues,
  writeIcpChipValues,
  type GtmIcpChipFieldKey,
} from '@/gtm-home/utils/gtm-icp-chip-fields.util';
import { AVAILABLE_TIME_ZONE_OPTIONS_BY_LABEL } from '@/settings/experience/constants/AvailableTimezoneOptionsByLabel';
import { TextArea } from '@/ui/input/components/TextArea';
import { TextInput } from '@/ui/input/components/TextInput';

const GTM_SEND_TIMEZONE_OPTIONS = Object.values(
  AVAILABLE_TIME_ZONE_OPTIONS_BY_LABEL,
).sort((a, b) => a.label.localeCompare(b.label));

const HH_MM_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/;

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

const StyledScheduleRow = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[3]};
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const StyledFieldStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledSelect = styled.select`
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[2]};
  width: 100%;
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

export type GtmSendScheduleInput = {
  sendTimezone: string;
  sendWindowStart: string;
  sendWindowEnd: string;
};

export type GtmOutreachPolicyInput = {
  outreachSendMode: GtmOutreachSendMode;
  maxPersonasPerCompany: number;
};

type GtmSetupPanelProps = {
  workspaceCompany: GtmWorkspaceCompany;
  icpSpec: string | null;
  isIcpProjectOverride: boolean;
  hasWorkspaceProfile: boolean;
  hasProject: boolean;
  isSavingIcp: boolean;
  onRegenerateIcp: () => void;
  isRegeneratingIcp: boolean;
  onSaveIcp: (input: { icpSpec: string }) => Promise<void>;
  sendTimezone: string;
  sendWindowStart: string;
  sendWindowEnd: string;
  isSavingSendSchedule: boolean;
  onSaveSendSchedule: (input: GtmSendScheduleInput) => Promise<void>;
  outreachSendMode: GtmOutreachSendMode;
  maxPersonasPerCompany: number;
  isSavingOutreachPolicy: boolean;
  onSaveOutreachPolicy: (input: GtmOutreachPolicyInput) => Promise<void>;
  onFindCompanies: () => void;
  onFindPeople: () => void;
};

export const GtmSetupPanel = ({
  workspaceCompany,
  icpSpec,
  isIcpProjectOverride,
  hasWorkspaceProfile,
  hasProject,
  isSavingIcp,
  onRegenerateIcp,
  isRegeneratingIcp,
  onSaveIcp,
  sendTimezone,
  sendWindowStart,
  sendWindowEnd,
  isSavingSendSchedule,
  onSaveSendSchedule,
  outreachSendMode,
  maxPersonasPerCompany,
  isSavingOutreachPolicy,
  onSaveOutreachPolicy,
  onFindCompanies,
  onFindPeople,
}: GtmSetupPanelProps) => {
  const [icpDraft, setIcpDraft] = useState(() => formatIcpDraft(icpSpec));
  const [isJsonOpen, setIsJsonOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [timezoneDraft, setTimezoneDraft] = useState(sendTimezone);
  const [windowStartDraft, setWindowStartDraft] = useState(sendWindowStart);
  const [windowEndDraft, setWindowEndDraft] = useState(sendWindowEnd);
  const [sendScheduleError, setSendScheduleError] = useState<string | null>(
    null,
  );
  const [sendModeDraft, setSendModeDraft] =
    useState<GtmOutreachSendMode>(outreachSendMode);
  const [maxPersonasDraft, setMaxPersonasDraft] = useState(
    String(maxPersonasPerCompany),
  );
  const [outreachPolicyError, setOutreachPolicyError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setIcpDraft(formatIcpDraft(icpSpec));
  }, [icpSpec]);

  useEffect(() => {
    setTimezoneDraft(sendTimezone);
    setWindowStartDraft(sendWindowStart);
    setWindowEndDraft(sendWindowEnd);
  }, [sendTimezone, sendWindowStart, sendWindowEnd]);

  useEffect(() => {
    setSendModeDraft(outreachSendMode);
    setMaxPersonasDraft(String(maxPersonasPerCompany));
  }, [outreachSendMode, maxPersonasPerCompany]);

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

  const handleSaveSendSchedule = async () => {
    const timezone = getValidTimeZoneOrUndefined(timezoneDraft.trim());
    const start = windowStartDraft.trim();
    const end = windowEndDraft.trim();

    if (!timezone) {
      setSendScheduleError('Choose a valid IANA timezone.');
      return;
    }

    if (!HH_MM_PATTERN.test(start) || !HH_MM_PATTERN.test(end)) {
      setSendScheduleError('Start and end must be HH:mm (24-hour).');
      return;
    }

    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (endMinutes <= startMinutes) {
      setSendScheduleError('End time must be after start time.');
      return;
    }

    setSendScheduleError(null);
    await onSaveSendSchedule({
      sendTimezone: timezone,
      sendWindowStart: start,
      sendWindowEnd: end,
    });
  };

  const handleSaveOutreachPolicy = async () => {
    const parsedMax = Number.parseInt(maxPersonasDraft.trim(), 10);

    if (!Number.isFinite(parsedMax) || parsedMax < 1 || parsedMax > 10) {
      setOutreachPolicyError('Max personas per company must be between 1 and 10.');
      return;
    }

    setOutreachPolicyError(null);
    await onSaveOutreachPolicy({
      outreachSendMode: sendModeDraft,
      maxPersonasPerCompany: parsedMax,
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
              {isIcpProjectOverride ? 'Project override' : 'Workspace default'}
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

      <StyledSection>
        <StyledTitle>Outreach policy</StyledTitle>
        <StyledBody>
          Choose approval vs auto send, and how many personas to enroll per
          company before deferring the rest.
        </StyledBody>
        <StyledScheduleRow>
          <StyledFieldStack>
            <StyledFieldLabel>Send mode</StyledFieldLabel>
            <StyledSelect
              value={sendModeDraft}
              disabled={!hasProject}
              onChange={(event) =>
                setSendModeDraft(event.target.value as GtmOutreachSendMode)
              }
            >
              <option value="APPROVAL">APPROVAL</option>
              <option value="AUTO">AUTO</option>
            </StyledSelect>
          </StyledFieldStack>
          <StyledFieldStack>
            <StyledFieldLabel>Max personas / company</StyledFieldLabel>
            <TextInput
              value={maxPersonasDraft}
              onChange={setMaxPersonasDraft}
              placeholder="2"
              disabled={!hasProject}
              fullWidth
            />
          </StyledFieldStack>
        </StyledScheduleRow>
        {isNonEmptyString(outreachPolicyError) && (
          <StyledMuted>{outreachPolicyError}</StyledMuted>
        )}
        <StyledActions>
          <Button
            title={isSavingOutreachPolicy ? 'Saving…' : 'Save outreach policy'}
            variant="secondary"
            size="small"
            onClick={() => {
              void handleSaveOutreachPolicy();
            }}
            disabled={!hasProject || isSavingOutreachPolicy}
          />
        </StyledActions>
      </StyledSection>

      <StyledSection>
        <StyledTitle>Send schedule</StyledTitle>
        <StyledBody>
          Connection requests send Tue–Thu within this window in the selected
          timezone. Outside the window, sends are queued automatically.
        </StyledBody>
        <StyledScheduleRow>
          <StyledFieldStack>
            <StyledFieldLabel>Timezone</StyledFieldLabel>
            <StyledSelect
              value={timezoneDraft}
              disabled={!hasProject}
              onChange={(event) => setTimezoneDraft(event.target.value)}
            >
              {!GTM_SEND_TIMEZONE_OPTIONS.some(
                (option) => option.value === timezoneDraft,
              ) && <option value={timezoneDraft}>{timezoneDraft}</option>}
              {GTM_SEND_TIMEZONE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </StyledSelect>
          </StyledFieldStack>
          <StyledFieldStack>
            <StyledFieldLabel>Start (HH:mm)</StyledFieldLabel>
            <TextInput
              value={windowStartDraft}
              onChange={setWindowStartDraft}
              placeholder="08:00"
              disabled={!hasProject}
              fullWidth
            />
          </StyledFieldStack>
          <StyledFieldStack>
            <StyledFieldLabel>End (HH:mm)</StyledFieldLabel>
            <TextInput
              value={windowEndDraft}
              onChange={setWindowEndDraft}
              placeholder="10:00"
              disabled={!hasProject}
              fullWidth
            />
          </StyledFieldStack>
        </StyledScheduleRow>
        {isNonEmptyString(sendScheduleError) && (
          <StyledMuted>{sendScheduleError}</StyledMuted>
        )}
        <StyledActions>
          <Button
            title={isSavingSendSchedule ? 'Saving…' : 'Save schedule'}
            variant="secondary"
            size="small"
            onClick={() => {
              void handleSaveSendSchedule();
            }}
            disabled={!hasProject || isSavingSendSchedule}
          />
        </StyledActions>
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
            Create or select a GTM project first, then use these actions.
          </StyledMuted>
        )}
        {hasProject && !hasWorkspaceProfile && (
          <StyledMuted>
            Workspace GTM profile is still provisioning — Save writes to this
            project until the profile exists.
          </StyledMuted>
        )}
      </StyledStickyBar>
    </StyledPanel>
  );
};
