import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useMemo, useState } from 'react';

import { isClickHouseConfiguredState } from '@/client-config/states/isClickHouseConfiguredState';
import { useNumberFormat } from '@/localization/hooks/useNumberFormat';
import { SettingsEmptyPlaceholder } from '@/settings/components/SettingsEmptyPlaceholder';
import { EventLogFilters } from '@/settings/event-logs/components/EventLogFilters';
import { EventLogResultsTable } from '@/settings/event-logs/components/EventLogResultsTable';
import { EventLogTableSelector } from '@/settings/event-logs/components/EventLogTableSelector';
import { useEventLogsLiveStream } from '@/settings/event-logs/hooks/useEventLogsLiveStream';
import { useEventLogs } from '@/settings/event-logs/hooks/useQueryEventLogs';
import { type EventLogFiltersState } from '@/settings/event-logs/types/EventLogFiltersState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { isDefined } from 'twenty-shared/utils';
import { IconPlayerPause, IconPlayerPlay } from 'twenty-ui/icon';
import { IconButton } from 'twenty-ui/input';
import { Card } from 'twenty-ui/surfaces';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { EventLogTable } from '~/generated-metadata/graphql';

const StyledRoot = styled.div`
  box-sizing: border-box;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[6]};
  margin: 0 auto;
  max-width: 760px;
  min-height: 0;
  padding: ${themeCssVariables.spacing[6]} ${themeCssVariables.spacing[8]}
    ${themeCssVariables.spacing[8]};
  width: 100%;
`;

const StyledCardContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledSelectorRow = styled.div`
  align-items: flex-end;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledSelectorGrow = styled.div`
  flex: 1;
  min-width: 0;
`;

const StyledResults = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  min-height: 0;
`;

const StyledRecordCount = styled.span`
  align-self: flex-end;
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledTableWrapper = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

const RECORDS_PER_PAGE = 100;

export const SettingsLogs = () => {
  const { t } = useLingui();
  const { formatNumber } = useNumberFormat();

  const isClickHouseConfigured = useAtomStateValue(isClickHouseConfiguredState);

  const [selectedTable, setSelectedTable] = useState<EventLogTable>(
    EventLogTable.PAGEVIEW,
  );
  const [filters, setFilters] = useState<EventLogFiltersState>({});
  const [isPaused, setIsPaused] = useState(false);

  const canQuery = isClickHouseConfigured;

  const { records, totalCount, hasNextPage, loading, error, loadMore } =
    useEventLogs(
      {
        table: selectedTable,
        filters: {
          eventType: filters.eventType,
          userWorkspaceId: filters.userWorkspaceId,
          dateRange: filters.dateRange
            ? {
                start: filters.dateRange.start?.toISOString(),
                end: filters.dateRange.end?.toISOString(),
              }
            : undefined,
          recordId: filters.recordId,
          objectMetadataId: filters.objectMetadataId,
        },
        first: RECORDS_PER_PAGE,
      },
      { skip: !canQuery },
    );

  const hasActiveFilters =
    isDefined(filters.eventType) ||
    isDefined(filters.userWorkspaceId) ||
    isDefined(filters.recordId) ||
    isDefined(filters.objectMetadataId) ||
    isDefined(filters.dateRange?.start) ||
    isDefined(filters.dateRange?.end);

  const liveRecords = useEventLogsLiveStream({
    table: selectedTable,
    enabled: !isPaused && !hasActiveFilters && canQuery,
  });

  const displayedRecords = useMemo(
    () => [...liveRecords, ...records],
    [liveRecords, records],
  );

  const handleTableChange = (table: EventLogTable) => {
    setSelectedTable(table);
    setFilters({});
  };

  const handleFiltersChange = (newFilters: EventLogFiltersState) => {
    setFilters(newFilters);
  };

  const renderResults = () => {
    if (!isClickHouseConfigured) {
      return (
        <SettingsEmptyPlaceholder>
          {t`Logs require ClickHouse to be configured. Please contact your administrator.`}
        </SettingsEmptyPlaceholder>
      );
    }

    if (isDefined(error)) {
      return (
        <SettingsEmptyPlaceholder>
          {t`Something went wrong while loading logs. Please try again.`}
        </SettingsEmptyPlaceholder>
      );
    }

    return (
      <StyledResults>
        <StyledRecordCount>{t`${formatNumber(displayedRecords.length)} of ${formatNumber(totalCount + liveRecords.length)}`}</StyledRecordCount>
        <StyledTableWrapper>
          <EventLogResultsTable
            records={displayedRecords}
            loading={loading}
            hasNextPage={hasNextPage}
            onLoadMore={loadMore}
            selectedTable={selectedTable}
          />
        </StyledTableWrapper>
      </StyledResults>
    );
  };

  return (
    <StyledRoot>
      <Card
        rounded
        fullWidth
        backgroundColor={themeCssVariables.background.secondary}
      >
        <StyledCardContent>
          <StyledSelectorRow>
            <StyledSelectorGrow>
              <EventLogTableSelector
                value={selectedTable}
                onChange={handleTableChange}
              />
            </StyledSelectorGrow>
            {canQuery && (
              <IconButton
                Icon={isPaused ? IconPlayerPlay : IconPlayerPause}
                variant="secondary"
                size="medium"
                ariaLabel={isPaused ? t`Resume` : t`Pause`}
                onClick={() => setIsPaused((previous) => !previous)}
              />
            )}
          </StyledSelectorRow>
          <EventLogFilters
            table={selectedTable}
            value={filters}
            onChange={handleFiltersChange}
          />
        </StyledCardContent>
      </Card>

      {renderResults()}
    </StyledRoot>
  );
};
