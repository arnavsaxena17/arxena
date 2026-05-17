import { useMemo } from 'react';

import styled from '@emotion/styled';

import { OrgChartNodeData } from 'twenty-shared';

const StyledAsOfMonthSliderContainer = styled.div`
  display: inline-flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.5)};
  max-width: 320px;
`;

const StyledAsOfMonthSliderMainRow = styled.div`
  align-items: center;
  display: inline-flex;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledAsOfMonthSliderTimeline = styled.div`
  display: inline-flex;
  flex-direction: column;
`;

const StyledAsOfMonthSlider = styled.input`
  width: 240px;
  cursor: pointer;
`;

const StyledAsOfMonthSliderRangeLabels = styled.div`
  display: flex;
  justify-content: space-between;
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  padding-left: ${({ theme }) => theme.spacing(4.5)};
  padding-right: ${({ theme }) => theme.spacing(9)};
`;

const StyledAsOfMonthSliderValue = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  min-width: 68px;
  text-align: right;
`;

const StyledAsOfMonthLabel = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  white-space: nowrap;
`;

const StyledAsOfMonthSliderDot = styled.div`
  width: ${({ theme }) => theme.spacing(2)};
  height: ${({ theme }) => theme.spacing(2)};
  border-radius: 50%;
  background: ${({ theme }) => theme.color.blue};
`;

export type OrgChartTimelineSliderProps = {
  asOfMonth?: string;
  onAsOfMonthChange?: (nextMonth: string) => void;
  nodeDataArray: OrgChartNodeData[];
  timelineMetrics?: { startMonth?: unknown; startMonthYear?: unknown } | null;
};

const monthKeyRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

const parseMonthToDate = (monthKey: string): Date | null => {
  if (!monthKeyRegex.test(monthKey)) {
    return null;
  }

  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1);
};

const formatMonthToKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const buildMonthRange = (startMonthKey: string, endMonthKey: string): string[] => {
  const startDate = parseMonthToDate(startMonthKey);
  const endDate = parseMonthToDate(endMonthKey);

  if (!startDate || !endDate || startDate > endDate) {
    return [endMonthKey];
  }

  const months: string[] = [];
  const cursorDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

  while (cursorDate <= endDate) {
    months.push(formatMonthToKey(cursorDate));
    cursorDate.setMonth(cursorDate.getMonth() + 1);
  }

  return months;
};

const monthLabelFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
});

export const OrgChartTimelineSlider = ({
  asOfMonth,
  onAsOfMonthChange,
  nodeDataArray,
  timelineMetrics,
}: OrgChartTimelineSliderProps) => {
  const monthRange = useMemo(() => {
    const currentMonthKey = formatMonthToKey(new Date());
    const nodeKeys = new Set<string>();

    for (const node of nodeDataArray) {
      for (const value of Object.values(node)) {
        if (typeof value !== 'string') {
          continue;
        }
        const monthMatch = value.match(/\b\d{4}-(0[1-9]|1[0-2])\b/u)?.[0];
        if (typeof monthMatch === 'string' && monthMatch.length > 0) {
          nodeKeys.add(monthMatch);
        }
      }
    }

    const timelineStartMonth =
      typeof timelineMetrics?.startMonth === 'string'
        ? timelineMetrics.startMonth
        : typeof timelineMetrics?.startMonthYear === 'string'
          ? timelineMetrics.startMonthYear
          : null;

    const validNodeKeys = [...nodeKeys]
      .filter((key) => monthKeyRegex.test(key))
      .sort();
    const fallbackStartMonth = validNodeKeys[0] ?? currentMonthKey;
    const computedStartMonth =
      timelineStartMonth && monthKeyRegex.test(timelineStartMonth)
        ? timelineStartMonth
        : fallbackStartMonth;

    return buildMonthRange(computedStartMonth, currentMonthKey);
  }, [nodeDataArray, timelineMetrics?.startMonth, timelineMetrics?.startMonthYear]);

  const selectedMonth = monthKeyRegex.test(asOfMonth ?? '')
    ? (asOfMonth as string)
    : monthRange[monthRange.length - 1];
  const selectedMonthIndex = Math.max(monthRange.indexOf(selectedMonth), 0);
  const isSingleMonthTimeline = monthRange.length <= 1;
  const sliderTrackWidth = Math.min(240, Math.max(24, monthRange.length * 14));
  const sliderPanelWidth = Math.min(320, sliderTrackWidth + 80);

  const startMonthLabel = monthLabelFormatter.format(
    parseMonthToDate(monthRange[0]) ?? new Date(),
  );
  const selectedMonthLabel = monthLabelFormatter.format(
    isSingleMonthTimeline
      ? new Date()
      : (parseMonthToDate(monthRange[selectedMonthIndex]) ?? new Date()),
  );

  return (
    <StyledAsOfMonthSliderContainer
      style={isSingleMonthTimeline ? undefined : { width: `${sliderPanelWidth}px` }}
    >
      <StyledAsOfMonthSliderMainRow>
        <StyledAsOfMonthLabel>As of</StyledAsOfMonthLabel>
        {isSingleMonthTimeline ? (
          <StyledAsOfMonthSliderDot />
        ) : (
          <StyledAsOfMonthSliderTimeline style={{ width: `${sliderTrackWidth}px` }}>
            <StyledAsOfMonthSlider
              type="range"
              min={0}
              max={Math.max(monthRange.length - 1, 0)}
              step={1}
              value={selectedMonthIndex}
              style={{ width: '100%' }}
              onChange={(event) => {
                const nextIndex = Number(event.target.value);
                const nextMonth = monthRange[nextIndex];
                if (!nextMonth) {
                  return;
                }
                onAsOfMonthChange?.(nextMonth);
              }}
            />
          </StyledAsOfMonthSliderTimeline>
        )}
        <StyledAsOfMonthSliderValue>{selectedMonthLabel}</StyledAsOfMonthSliderValue>
      </StyledAsOfMonthSliderMainRow>
      {!isSingleMonthTimeline ? (
        <StyledAsOfMonthSliderRangeLabels>
          <span>{startMonthLabel}</span>
          <span>Current</span>
        </StyledAsOfMonthSliderRangeLabels>
      ) : null}
    </StyledAsOfMonthSliderContainer>
  );
};
