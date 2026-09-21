import { isNonEmptyString } from '@sniptt/guards';
import { styled } from '@linaria/react';
import { useEffect, useMemo, useState } from 'react';
import {
  areSendWindowDaysEqual,
  formatSendWindowDays,
  formatSendWindowDaysSummary,
  parseSendWindowDays,
  type SendWindowWeekday,
} from 'twenty-shared/arx';
import { getValidTimeZoneOrUndefined } from 'twenty-shared/utils';
import { IconInfoCircle } from 'twenty-ui/icon';
import { Button, type SelectOption } from 'twenty-ui/input';
import { AppTooltip, TooltipDelay } from 'twenty-ui/surfaces';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { OutreachSendWindowDayPicker } from '@/outreach-home/components/OutreachSendWindowDayPicker';
import { OutreachSetupSectionCard } from '@/outreach-home/components/OutreachSetupSectionCard';
import { OutreachSetupSenderProfileSection } from '@/outreach-home/components/OutreachSetupSenderProfileSection';
import {
  type OutreachSendMode,
  type OutreachWorkspaceCompany,
} from '@/outreach-home/types/outreach-home.types';
import { AVAILABLE_TIMEZONE_OPTIONS } from '@/settings/experience/constants/AvailableTimezoneOptions';
import { Select } from '@/ui/input/components/Select';
import { TextInput } from '@/ui/input/components/TextInput';

const HH_MM_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/;

const DEFAULT_SEND_WINDOW_START = '00:00';
const DEFAULT_SEND_WINDOW_END = '23:59';

const normalizeSendWindowTime = (value: string, fallback: string): string => {
  const match = value.trim().match(HH_MM_PATTERN);

  if (!match) {
    return fallback;
  }

  return `${match[1].padStart(2, '0')}:${match[2]}`;
};

const SEND_WINDOW_TIME_OPTIONS: SelectOption<string>[] = [
  ...Array.from({ length: 48 }, (_, index) => {
    const hours = Math.floor(index / 2);
    const minutes = index % 2 === 0 ? 0 : 30;
    const value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    return { label: value, value };
  }),
  { label: '23:59', value: '23:59' },
];

const buildSendWindowTimeOptions = (
  currentValue: string,
): SelectOption<string>[] => {
  if (
    SEND_WINDOW_TIME_OPTIONS.some((option) => option.value === currentValue)
  ) {
    return SEND_WINDOW_TIME_OPTIONS;
  }

  return [
    ...SEND_WINDOW_TIME_OPTIONS,
    { label: currentValue, value: currentValue },
  ].sort((left, right) => left.value.localeCompare(right.value));
};

const MAX_PERSONAS_PER_COMPANY_TOOLTIP_ID =
  'outreach-max-personas-per-company-tooltip';

const MAX_PERSONAS_PER_COMPANY_TOOLTIP =
  'When multiple ICP contacts match at one company, only the top N by persona priority (function fit, seniority, connection degree, warm path) are queued for outreach. The rest are deferred until you promote them from the People tab.';

const OUTREACH_SEND_MODE_OPTIONS: SelectOption<OutreachSendMode>[] = [
  { label: 'Require approval before send', value: 'APPROVAL' },
  { label: 'Send automatically', value: 'AUTO' },
];

const StyledPanel = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  margin: 0 auto;
  max-width: 720px;
  min-height: 100%;
  width: 100%;
`;

const StyledSections = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
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

const StyledFieldLabelRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledFieldLabelInfoAnchor = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  display: inline-flex;
  flex-shrink: 0;
  outline: none;
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
  gap: ${themeCssVariables.spacing[3]};
  justify-content: space-between;
  margin-top: auto;
  padding: ${themeCssVariables.spacing[3]} 0 ${themeCssVariables.spacing[1]};
  position: sticky;
  z-index: 1;
`;

const StyledFooterActions = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledFooterHint = styled.div`
  flex: 1;
  min-width: 200px;
`;

const StyledScheduleSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
`;

const StyledScheduleRow = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[3]};
  grid-template-columns: minmax(0, 1fr);
`;

const StyledTimeWindowRow = styled.div`
  align-items: end;
  display: grid;
  gap: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const StyledTimeSeparator = styled.span`
  color: ${themeCssVariables.font.color.light};
  font-size: ${themeCssVariables.font.size.sm};
  padding-bottom: ${themeCssVariables.spacing[2]};
  text-align: center;

  @media (max-width: 720px) {
    display: none;
  }
`;

const StyledScheduleSummary = styled.div`
  background: ${themeCssVariables.background.transparent.light};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.5;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledPolicyRow = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[3]};
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const StyledFieldStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

export type OutreachSendScheduleInput = {
  sendTimezone: string;
  sendWindowStart: string;
  sendWindowEnd: string;
  sendWindowDays: string;
};

export type OutreachPolicyInput = {
  outreachSendMode: OutreachSendMode;
  maxPersonasPerCompany: number;
};

type OutreachSetupPanelProps = {
  workspaceCompany: OutreachWorkspaceCompany;
  hasWorkspaceCompany: boolean;
  hasProject: boolean;
  sendTimezone: string;
  sendWindowStart: string;
  sendWindowEnd: string;
  sendWindowDays: string;
  isSavingSendSchedule: boolean;
  onSaveSendSchedule: (input: OutreachSendScheduleInput) => Promise<void>;
  outreachSendMode: OutreachSendMode;
  maxPersonasPerCompany: number;
  isSavingOutreachPolicy: boolean;
  onSaveOutreachPolicy: (input: OutreachPolicyInput) => Promise<void>;
  onFindCompanies: () => void;
  onFindPeople: () => void;
};

export const OutreachSetupPanel = ({
  workspaceCompany,
  hasWorkspaceCompany,
  hasProject,
  sendTimezone,
  sendWindowStart,
  sendWindowEnd,
  sendWindowDays,
  isSavingSendSchedule,
  onSaveSendSchedule,
  outreachSendMode,
  maxPersonasPerCompany,
  isSavingOutreachPolicy,
  onSaveOutreachPolicy,
  onFindCompanies,
  onFindPeople,
}: OutreachSetupPanelProps) => {
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [timezoneDraft, setTimezoneDraft] = useState(sendTimezone);
  const [windowStartDraft, setWindowStartDraft] = useState(() =>
    normalizeSendWindowTime(sendWindowStart, DEFAULT_SEND_WINDOW_START),
  );
  const [windowEndDraft, setWindowEndDraft] = useState(() =>
    normalizeSendWindowTime(sendWindowEnd, DEFAULT_SEND_WINDOW_END),
  );
  const [sendDaysDraft, setSendDaysDraft] = useState<SendWindowWeekday[]>(() =>
    parseSendWindowDays(sendWindowDays),
  );
  const [sendScheduleError, setSendScheduleError] = useState<string | null>(
    null,
  );
  const [sendModeDraft, setSendModeDraft] =
    useState<OutreachSendMode>(outreachSendMode);
  const [maxPersonasDraft, setMaxPersonasDraft] = useState(
    String(maxPersonasPerCompany),
  );
  const [outreachPolicyError, setOutreachPolicyError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setTimezoneDraft(sendTimezone);
    setWindowStartDraft(
      normalizeSendWindowTime(sendWindowStart, DEFAULT_SEND_WINDOW_START),
    );
    setWindowEndDraft(
      normalizeSendWindowTime(sendWindowEnd, DEFAULT_SEND_WINDOW_END),
    );
    setSendDaysDraft(parseSendWindowDays(sendWindowDays));
  }, [sendTimezone, sendWindowStart, sendWindowEnd, sendWindowDays]);

  useEffect(() => {
    setSendModeDraft(outreachSendMode);
    setMaxPersonasDraft(String(maxPersonasPerCompany));
  }, [outreachSendMode, maxPersonasPerCompany]);

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

  const isPolicyDirty =
    sendModeDraft !== outreachSendMode ||
    maxPersonasDraft !== String(maxPersonasPerCompany);
  const isScheduleDirty =
    timezoneDraft !== sendTimezone ||
    windowStartDraft !==
      normalizeSendWindowTime(sendWindowStart, DEFAULT_SEND_WINDOW_START) ||
    windowEndDraft !==
      normalizeSendWindowTime(sendWindowEnd, DEFAULT_SEND_WINDOW_END) ||
    !HH_MM_PATTERN.test(sendWindowStart.trim()) ||
    !HH_MM_PATTERN.test(sendWindowEnd.trim()) ||
    !areSendWindowDaysEqual(sendDaysDraft, parseSendWindowDays(sendWindowDays));
  const canSaveSetup = hasProject && (isPolicyDirty || isScheduleDirty);
  const isSavingSetup = isSavingSendSchedule || isSavingOutreachPolicy;

  const timezoneOptions = useMemo(() => {
    const options = [...AVAILABLE_TIMEZONE_OPTIONS];

    if (
      isNonEmptyString(timezoneDraft) &&
      !options.some((option) => option.value === timezoneDraft)
    ) {
      options.unshift({ label: timezoneDraft, value: timezoneDraft });
    }

    return options;
  }, [timezoneDraft]);

  const scheduleSummary = useMemo(() => {
    const daySummary = formatSendWindowDaysSummary(sendDaysDraft);
    const timezoneLabel =
      timezoneOptions.find((option) => option.value === timezoneDraft)?.label ??
      timezoneDraft;

    return `${daySummary} · ${windowStartDraft || DEFAULT_SEND_WINDOW_START}–${windowEndDraft || DEFAULT_SEND_WINDOW_END} · ${timezoneLabel}`;
  }, [
    sendDaysDraft,
    timezoneDraft,
    timezoneOptions,
    windowEndDraft,
    windowStartDraft,
  ]);

  const windowStartOptions = useMemo(
    () => buildSendWindowTimeOptions(windowStartDraft),
    [windowStartDraft],
  );
  const windowEndOptions = useMemo(
    () => buildSendWindowTimeOptions(windowEndDraft),
    [windowEndDraft],
  );

  const validateOutreachPolicy = (): OutreachPolicyInput | null => {
    const parsedMax = Number.parseInt(maxPersonasDraft.trim(), 10);

    if (!Number.isFinite(parsedMax) || parsedMax < 1 || parsedMax > 10) {
      setOutreachPolicyError(
        'Max personas per company must be between 1 and 10.',
      );

      return null;
    }

    setOutreachPolicyError(null);

    return {
      outreachSendMode: sendModeDraft,
      maxPersonasPerCompany: parsedMax,
    };
  };

  const validateSendSchedule = (): OutreachSendScheduleInput | null => {
    const timezone = getValidTimeZoneOrUndefined(timezoneDraft.trim());
    const start = windowStartDraft.trim();
    const end = windowEndDraft.trim();

    if (!timezone) {
      setSendScheduleError('Choose a valid IANA timezone.');

      return null;
    }

    if (!HH_MM_PATTERN.test(start) || !HH_MM_PATTERN.test(end)) {
      setSendScheduleError('Start and end must be HH:mm (24-hour).');

      return null;
    }

    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (endMinutes <= startMinutes) {
      setSendScheduleError('End time must be after start time.');

      return null;
    }

    if (sendDaysDraft.length === 0) {
      setSendScheduleError('Select at least one day for sending.');

      return null;
    }

    setSendScheduleError(null);

    return {
      sendTimezone: timezone,
      sendWindowStart: start,
      sendWindowEnd: end,
      sendWindowDays: formatSendWindowDays(sendDaysDraft),
    };
  };

  const handleSaveSetup = async () => {
    if (!canSaveSetup || isSavingSetup) {
      return;
    }

    const policyInput =
      isPolicyDirty && hasProject ? validateOutreachPolicy() : null;

    if (isPolicyDirty && hasProject && policyInput === null) {
      return;
    }

    const scheduleInput =
      isScheduleDirty && hasProject ? validateSendSchedule() : null;

    if (isScheduleDirty && hasProject && scheduleInput === null) {
      return;
    }

    if (policyInput !== null) {
      await onSaveOutreachPolicy(policyInput);
    }

    if (scheduleInput !== null) {
      await onSaveSendSchedule(scheduleInput);
    }
  };

  return (
    <StyledPanel>
      <StyledSections>
        <OutreachSetupSectionCard title="Your company">
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
        </OutreachSetupSectionCard>

        <OutreachSetupSenderProfileSection />

        <OutreachSetupSectionCard
          title="Outreach policy"
          description="Choose approval vs auto send, and how many personas to enroll per company before deferring the rest."
        >
          <StyledPolicyRow>
            <StyledFieldStack>
              <StyledFieldLabel>Send mode</StyledFieldLabel>
              <Select<OutreachSendMode>
                dropdownId="outreach-setup-send-mode-select"
                value={sendModeDraft}
                disabled={!hasProject}
                onChange={setSendModeDraft}
                options={OUTREACH_SEND_MODE_OPTIONS}
                fullWidth
                selectSizeVariant="small"
                needIconCheck={false}
              />
            </StyledFieldStack>
            <StyledFieldStack>
              <StyledFieldLabelRow>
                <StyledFieldLabel>Max personas / company</StyledFieldLabel>
                <StyledFieldLabelInfoAnchor
                  id={MAX_PERSONAS_PER_COMPANY_TOOLTIP_ID}
                  tabIndex={0}
                  aria-label="Max personas per company"
                >
                  <IconInfoCircle size={14} />
                </StyledFieldLabelInfoAnchor>
                <AppTooltip
                  anchorSelect={`#${MAX_PERSONAS_PER_COMPANY_TOOLTIP_ID}`}
                  content={MAX_PERSONAS_PER_COMPANY_TOOLTIP}
                  noArrow
                  place="top"
                  positionStrategy="fixed"
                  delay={TooltipDelay.shortDelay}
                />
              </StyledFieldLabelRow>
              <TextInput
                value={maxPersonasDraft}
                onChange={setMaxPersonasDraft}
                placeholder="2"
                disabled={!hasProject}
                fullWidth
              />
            </StyledFieldStack>
          </StyledPolicyRow>
          {isNonEmptyString(outreachPolicyError) && (
            <StyledMuted>{outreachPolicyError}</StyledMuted>
          )}
        </OutreachSetupSectionCard>

        <OutreachSetupSectionCard
          title="Send schedule"
          description="Choose when connection requests may send in the project timezone. Outside the window, sends queue automatically."
        >
          <StyledScheduleSection>
            <StyledFieldStack>
              <StyledFieldLabel>Allowed days</StyledFieldLabel>
              <OutreachSendWindowDayPicker
                selectedDays={sendDaysDraft}
                disabled={!hasProject}
                onChange={setSendDaysDraft}
              />
            </StyledFieldStack>

            <StyledScheduleRow>
              <StyledFieldStack>
                <StyledFieldLabel>Timezone</StyledFieldLabel>
                <Select<string>
                  dropdownId="outreach-setup-timezone-select"
                  value={timezoneDraft}
                  disabled={!hasProject}
                  onChange={setTimezoneDraft}
                  options={timezoneOptions}
                  fullWidth
                  selectSizeVariant="small"
                  withSearchInput
                  needIconCheck={false}
                />
              </StyledFieldStack>
            </StyledScheduleRow>

            <StyledFieldStack>
              <StyledFieldLabel>Send window</StyledFieldLabel>
              <StyledTimeWindowRow>
                <StyledFieldStack>
                  <StyledFieldLabel>Start time</StyledFieldLabel>
                  <Select<string>
                    dropdownId="outreach-setup-window-start-select"
                    value={windowStartDraft}
                    disabled={!hasProject}
                    onChange={setWindowStartDraft}
                    options={windowStartOptions}
                    fullWidth
                    selectSizeVariant="small"
                    withSearchInput
                    needIconCheck={false}
                  />
                </StyledFieldStack>
                <StyledTimeSeparator>to</StyledTimeSeparator>
                <StyledFieldStack>
                  <StyledFieldLabel>End time</StyledFieldLabel>
                  <Select<string>
                    dropdownId="outreach-setup-window-end-select"
                    value={windowEndDraft}
                    disabled={!hasProject}
                    onChange={setWindowEndDraft}
                    options={windowEndOptions}
                    fullWidth
                    selectSizeVariant="small"
                    withSearchInput
                    needIconCheck={false}
                  />
                </StyledFieldStack>
              </StyledTimeWindowRow>
            </StyledFieldStack>

            <StyledScheduleSummary>{scheduleSummary}</StyledScheduleSummary>
          </StyledScheduleSection>
          {isNonEmptyString(sendScheduleError) && (
            <StyledMuted>{sendScheduleError}</StyledMuted>
          )}
        </OutreachSetupSectionCard>
      </StyledSections>

      <StyledStickyBar>
        <StyledFooterActions>
          <Button
            title={isSavingSetup ? 'Saving…' : 'Save setup'}
            variant="secondary"
            size="small"
            onClick={() => {
              void handleSaveSetup();
            }}
            disabled={!canSaveSetup || isSavingSetup}
          />
        </StyledFooterActions>
        <StyledFooterActions>
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
        </StyledFooterActions>
        {!hasProject && (
          <StyledFooterHint>
            <StyledMuted>
              Create or select a GTM project first, then use these actions.
            </StyledMuted>
          </StyledFooterHint>
        )}
        {hasProject && !hasWorkspaceCompany && (
          <StyledFooterHint>
            <StyledMuted>
              Workspace company fields are still loading — Save writes to this
              project until the workspace is ready.
            </StyledMuted>
          </StyledFooterHint>
        )}
      </StyledStickyBar>
    </StyledPanel>
  );
};
