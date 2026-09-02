import { styled } from '@linaria/react';
import {
    type ChangeEvent,
    type ReactNode,
    memo,
    useCallback,
    useId,
    useMemo,
    useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import {
    type IconComponent,
    IconArrowsVertical,
    IconBriefcase,
    IconChartCandle,
    IconCheck,
    IconDatabase,
    IconExternalLink,
    IconFileImport,
    IconFilterCog,
    IconMessage,
    IconRefresh,
    IconSearch,
    IconTrash,
    IconX,
} from 'twenty-ui/icon';
import { IconButton } from 'twenty-ui/input';
import { AppTooltip, TooltipDelay } from 'twenty-ui/surfaces';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import {
    searchMetadataState,
    searchResultsState,
} from '@/candidate-search/states/searchResultsState';
import { chatSearchQueryState } from '@/candidate-table/states/chatSearchQueryState';
import {
    columnsSelector,
    tableState,
} from '@/candidate-table/states/states';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

type ProjectTopBarProps = {
  className?: string;
  leftComponent?: ReactNode;
  rightComponent?: ReactNode;
  bottomComponent?: ReactNode;
  showRefetch?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  showSearch?: boolean;
  onSearch?: (query: string) => void;
  showJobStatusToggle?: boolean;
  isJobActive?: boolean;
  onJobStatusToggle?: () => void;
  showFilterChips?: boolean;
  onRemoveFilter?: (columnIndex: number) => void;
  onClearAllFilters?: () => void;
  showClearAll?: boolean;
  onClearAll?: () => void;
  showRedirectToObject?: boolean;
  handleRedirectToObject?: () => void;
  showImportCandidates?: boolean;
  handleImportCandidates?: () => void;
  showStatistics?: boolean;
  handleStatistics?: () => void;
  handleBulkMessage?: () => void;
  showAddJob?: boolean;
  handleEngagement?: () => void;
  showEnrichment?: boolean;
  handleEnrichment?: () => void;
  showSorting?: boolean;
  handleSorting?: () => void;
  showValidateJobData?: boolean;
  handleValidateJobData?: () => void;
  showBatchActions?: boolean;
  selectedCandidates?: any[];
  onSelectAll?: () => void;
  onSelectTop?: (count: number) => void;
  onSaveSelected?: (candidates: any[]) => void;
  onDiscardAll?: () => void;
  onLoadMore?: (pages?: number) => Promise<void>;
};

const StyledContainer = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  margin-left: ${themeCssVariables.spacing[2]};
  position: relative;
  /* Above page header (20), below right drawer (30) so tooltips are visible */
  z-index: 25;
`;

const StyledTopBar = styled.div`
  align-items: center;
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  font-weight: ${themeCssVariables.font.weight.medium};
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
  min-height: 48px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  z-index: 1;
`;

const StyledInlineSection = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
  min-width: 0;
`;

const StyledFilterSection = styled.div`
  align-items: center;
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
  max-width: 100%;
  min-width: 0;
`;

const StyledSearchContainer = styled.div`
  align-items: center;
  display: flex;
  flex-shrink: 0;
  position: relative;
  width: 180px;
`;

const StyledSearchInput = styled.input`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  height: 28px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[1]}
    ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[5]};
  width: 100%;

  &::placeholder {
    color: ${themeCssVariables.font.color.light};
  }

  &:focus {
    border-color: ${themeCssVariables.color.blue};
    outline: none;
  }
`;

const StyledIconContainer = styled.div`
  color: ${themeCssVariables.font.color.light};
  left: ${themeCssVariables.spacing[1]};
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
`;

const StyledJobStatusToggle = styled.div`
  align-items: center;
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  cursor: pointer;
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  height: 28px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  transition: all 0.2s ease-in-out;

  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
    border-color: ${themeCssVariables.border.color.medium};
  }
`;

const StyledToggleLabel = styled.span<{ 'data-is-active'?: string }>`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  transition: color 0.2s ease-in-out;

  &[data-is-active='true'] {
    color: ${themeCssVariables.font.color.primary};
  }
`;

const StyledToggleSwitch = styled.div<{ 'data-is-active'?: string }>`
  background-color: ${themeCssVariables.background.tertiary};
  border-radius: 8px;
  height: 16px;
  position: relative;
  transition: background-color 0.2s ease-in-out;
  width: 32px;

  &[data-is-active='true'] {
    background-color: ${themeCssVariables.font.color.primary};
  }

  &::after {
    background-color: ${themeCssVariables.background.primary};
    border-radius: 50%;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    content: '';
    height: 14px;
    left: 1px;
    position: absolute;
    top: 1px;
    transition: left 0.2s ease-in-out;
    width: 14px;
  }

  &[data-is-active='true']::after {
    left: 17px;
  }
`;

const StyledInlineFilterChip = styled.div`
  align-items: center;
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  flex-shrink: 1;
  font-size: ${themeCssVariables.font.size.xs};
  gap: ${themeCssVariables.spacing[1]};
  height: 24px;
  max-width: 280px;
  min-width: 0;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  svg {
    flex-shrink: 0;
  }
`;

const StyledInlineBatchInfo = styled.div`
  align-items: center;
  background-color: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  font-size: ${themeCssVariables.font.size.xs};
  gap: ${themeCssVariables.spacing[2]};
  height: 24px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

const StyledInlineButton = styled.button<{
  'data-variant'?: 'primary' | 'secondary' | 'danger';
}>`
  align-items: center;
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  display: flex;
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  gap: ${themeCssVariables.spacing[1]};
  height: 24px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  transition: all 0.2s ease;

  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
    border-color: ${themeCssVariables.border.color.medium};
    color: ${themeCssVariables.font.color.primary};
  }

  &[data-variant='primary'] {
    border-color: ${themeCssVariables.border.color.medium};
    color: ${themeCssVariables.font.color.primary};
  }

  &[data-variant='danger'] {
    border-color: ${themeCssVariables.border.color.danger};
    color: ${themeCssVariables.font.color.danger};
  }

  &:disabled {
    color: ${themeCssVariables.font.color.extraLight};
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

const StyledTooltipAnchor = styled.div`
  display: inline-block;
  position: relative;
`;

const MAX_VISIBLE_FILTER_VALUES = 2;

const getFilterValues = (args: unknown[] | undefined): string[] => {
  if (!args || args.length === 0) {
    return [];
  }

  const firstArg = args[0];
  if (Array.isArray(firstArg)) {
    return firstArg.map(String).filter((value) => value.length > 0);
  }

  if (firstArg == null || firstArg === '') {
    return [];
  }

  return [String(firstArg)];
};

const formatInlineFilterLabel = (
  columnTitle: string,
  condition?: { name: string; args: unknown[] },
): { label: string; title: string } => {
  if (!condition) {
    return { label: `${columnTitle}: Active`, title: `${columnTitle}: Active` };
  }

  const values = getFilterValues(condition.args);

  if (values.length === 0) {
    if (condition.name === 'empty') {
      return { label: `${columnTitle}: empty`, title: `${columnTitle}: empty` };
    }
    if (condition.name === 'not_empty') {
      return {
        label: `${columnTitle}: not empty`,
        title: `${columnTitle}: not empty`,
      };
    }
    return { label: `${columnTitle}: Active`, title: `${columnTitle}: Active` };
  }

  const fullValues = values.join(', ');
  const truncatedValues =
    values.length <= MAX_VISIBLE_FILTER_VALUES
      ? fullValues
      : `${values.slice(0, MAX_VISIBLE_FILTER_VALUES).join(', ')} +${
          values.length - MAX_VISIBLE_FILTER_VALUES
        } more`;

  return {
    label: `${columnTitle}: ${truncatedValues}`,
    title: `${columnTitle}: ${fullValues}`,
  };
};

const TooltipIconButton = ({
  title,
  Icon,
  onClick,
  disabled,
}: {
  title: string;
  Icon: IconComponent;
  onClick?: () => void;
  disabled?: boolean;
}) => {
  const tooltipId = `project-top-bar-${useId().replace(/:/g, '')}`;

  return (
    <>
      <StyledTooltipAnchor id={tooltipId}>
        <IconButton
          Icon={Icon}
          variant="secondary"
          size="small"
          accent="default"
          ariaLabel={title}
          onClick={onClick}
          disabled={disabled}
        />
      </StyledTooltipAnchor>
      <AppTooltip
        anchorSelect={`#${tooltipId}`}
        content={title}
        place="top"
        delay={TooltipDelay.shortDelay}
        noArrow={false}
        positionStrategy="fixed"
      />
    </>
  );
};

export const ProjectTopBar = memo(
  ({
    className,
    leftComponent,
    rightComponent,
    bottomComponent,
    showRefetch = true,
    onRefresh,
    isRefreshing = false,
    showSearch = true,
    onSearch,
    showJobStatusToggle = true,
    isJobActive = true,
    onJobStatusToggle,
    showFilterChips = true,
    onRemoveFilter,
    onClearAllFilters,
    showClearAll = true,
    onClearAll,
    showRedirectToObject = true,
    handleRedirectToObject,
    showImportCandidates = true,
    handleImportCandidates,
    showStatistics = true,
    handleStatistics,
    handleBulkMessage,
    showAddJob = true,
    handleEngagement,
    showEnrichment = true,
    handleEnrichment,
    showSorting = true,
    handleSorting,
    showValidateJobData = true,
    handleValidateJobData,
    showBatchActions = false,
    selectedCandidates = [],
    onSelectAll,
    onSelectTop,
    onSaveSelected,
    onDiscardAll,
    onLoadMore,
  }: ProjectTopBarProps) => {
    const location = useLocation();
    const isProjectPage =
      location.pathname.includes('/project/') ||
      location.pathname.includes('/projects/');

    const [chatSearchQuery, setChatSearchQuery] = useAtomState(chatSearchQueryState);
    const searchResults = useAtomStateValue(searchResultsState);
    const searchMetadata = useAtomStateValue(searchMetadataState);
    const tableState = useAtomStateValue(tableStateAtom);
    const columns = useAtomStateValue(columnsSelector);
    const { enqueueErrorSnackBar } = useSnackBar();

    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleSearchChange = useCallback(
      (event: ChangeEvent<HTMLInputElement>) => {
        const query = event.target.value;
        setChatSearchQuery(query);
        onSearch?.(query);
      },
      [onSearch, setChatSearchQuery],
    );

    const handleLoadMore = useCallback(
      async (pagesToLoad: number = 1) => {
        if (!onLoadMore || isLoadingMore) {
          return;
        }

        setIsLoadingMore(true);
        try {
          await onLoadMore(pagesToLoad);
        } catch (error) {
          console.error('Error loading more candidates:', error);
          enqueueErrorSnackBar({
            message: 'Failed to load more candidates. Please try again.',
          });
        } finally {
          setIsLoadingMore(false);
        }
      },
      [enqueueErrorSnackBar, isLoadingMore, onLoadMore],
    );

    const handleSaveClick = useCallback(async () => {
      if (!onSaveSelected || isSaving) {
        return;
      }
      setIsSaving(true);
      try {
        await onSaveSelected(selectedCandidates);
      } finally {
        setIsSaving(false);
      }
    }, [isSaving, onSaveSelected, selectedCandidates]);

    const hasMoreCandidates =
      !!searchMetadata.cursor &&
      searchMetadata.currentPage < searchMetadata.totalPages;

    const activeFilterChips = useMemo(() => {
      if (!showFilterChips || !tableState.activeFilters?.length) {
        return null;
      }

      return tableState.activeFilters.map((filter, index) => {
        const columnTitle = columns[filter.column]?.title || 'Filter';
        const { label, title } = formatInlineFilterLabel(
          columnTitle,
          filter.conditions[0],
        );

        return (
          <StyledInlineFilterChip
            key={`${filter.column}-${index}`}
            title={title}
          >
            <span>{label}</span>
            <IconX
              size={10}
              style={{ cursor: 'pointer' }}
              onClick={() => onRemoveFilter?.(filter.column)}
            />
          </StyledInlineFilterChip>
        );
      });
    }, [columns, onRemoveFilter, showFilterChips, tableState.activeFilters]);

    return (
      <StyledContainer className={className}>
        <StyledTopBar>
          <StyledInlineSection>
            {leftComponent}
            {isProjectPage && showSearch && (
              <StyledSearchContainer>
                <StyledIconContainer>
                  <IconSearch size={12} />
                </StyledIconContainer>
                <StyledSearchInput
                  type="text"
                  placeholder="Search candidates..."
                  value={chatSearchQuery}
                  onChange={handleSearchChange}
                />
              </StyledSearchContainer>
            )}
            {isProjectPage && showJobStatusToggle && onJobStatusToggle && (
              <StyledJobStatusToggle onClick={onJobStatusToggle}>
                <IconBriefcase size={12} />
                <StyledToggleLabel
                  data-is-active={isJobActive ? 'true' : 'false'}
                >
                  {isJobActive ? 'Active' : 'Inactive'}
                </StyledToggleLabel>
                <StyledToggleSwitch
                  data-is-active={isJobActive ? 'true' : 'false'}
                />
              </StyledJobStatusToggle>
            )}
          </StyledInlineSection>

          <StyledFilterSection>
            {activeFilterChips}
            {isProjectPage &&
              showFilterChips &&
              tableState.activeFilters?.length > 0 &&
              onClearAllFilters && (
                <StyledInlineButton onClick={onClearAllFilters}>
                  Clear All
                </StyledInlineButton>
              )}
            {showBatchActions && searchResults.length > 0 && (
              <StyledInlineBatchInfo>
                {searchResults.length} fetched • {selectedCandidates.length}{' '}
                selected
              </StyledInlineBatchInfo>
            )}
          </StyledFilterSection>

          <StyledInlineSection>
            {showRefetch && (
              <TooltipIconButton
                title="Refresh"
                Icon={IconRefresh}
                onClick={onRefresh}
                disabled={isRefreshing}
              />
            )}

            {showClearAll && onClearAll && (
              <TooltipIconButton
                title="Clear All Filters & Sorts"
                Icon={IconX}
                onClick={onClearAll}
              />
            )}

            {isProjectPage && (
              <>
                {showRedirectToObject && handleRedirectToObject && (
                  <TooltipIconButton
                    title="View Project Object"
                    Icon={IconExternalLink}
                    onClick={handleRedirectToObject}
                  />
                )}
                {showImportCandidates && handleImportCandidates && (
                  <TooltipIconButton
                    title="Import Candidates"
                    Icon={IconFileImport}
                    onClick={handleImportCandidates}
                  />
                )}
                {showStatistics && handleStatistics && (
                  <TooltipIconButton
                    title="Project Statistics"
                    Icon={IconChartCandle}
                    onClick={handleStatistics}
                  />
                )}
                {handleBulkMessage && (
                  <TooltipIconButton
                    title="Bulk Messages"
                    Icon={IconMessage}
                    onClick={handleBulkMessage}
                  />
                )}
                {showAddJob && handleEngagement && (
                  <TooltipIconButton
                    title="Modify Project Details"
                    Icon={IconBriefcase}
                    onClick={handleEngagement}
                  />
                )}
                {showEnrichment && handleEnrichment && (
                  <TooltipIconButton
                    title="AI Filtering"
                    Icon={IconFilterCog}
                    onClick={handleEnrichment}
                  />
                )}
                {showSorting && handleSorting && (
                  <TooltipIconButton
                    title="Multi-Column Sorting"
                    Icon={IconArrowsVertical}
                    onClick={handleSorting}
                  />
                )}
                {showValidateJobData && handleValidateJobData && (
                  <TooltipIconButton
                    title="Validate Project Data"
                    Icon={IconCheck}
                    onClick={handleValidateJobData}
                  />
                )}
              </>
            )}

            {showBatchActions && searchResults.length > 0 && (
              <>
                {onSelectAll && (
                  <StyledInlineButton onClick={onSelectAll}>
                    <IconCheck size={10} />
                    All
                  </StyledInlineButton>
                )}
                {onSelectTop && (
                  <StyledInlineButton onClick={() => onSelectTop(20)}>
                    Top 20
                  </StyledInlineButton>
                )}
                <StyledInlineButton
                  data-variant="primary"
                  onClick={() => {
                    void handleSaveClick();
                  }}
                  disabled={isSaving || selectedCandidates.length === 0}
                >
                  <IconDatabase size={10} />
                  {isSaving ? 'Saving...' : 'Save'}
                </StyledInlineButton>
                {onDiscardAll && (
                  <StyledInlineButton
                    data-variant="danger"
                    onClick={onDiscardAll}
                  >
                    <IconTrash size={10} />
                    Discard
                  </StyledInlineButton>
                )}
              </>
            )}

            {showBatchActions && hasMoreCandidates && (
              <>
                {isLoadingMore ? (
                  <StyledInlineBatchInfo>
                    <IconRefresh size={10} />
                    Loading...
                  </StyledInlineBatchInfo>
                ) : (
                  <>
                    <StyledInlineButton
                      onClick={() => {
                        void handleLoadMore(1);
                      }}
                    >
                      <IconRefresh size={10} />
                      Next
                    </StyledInlineButton>
                    <StyledInlineButton
                      onClick={() => {
                        void handleLoadMore(3);
                      }}
                    >
                      +3
                    </StyledInlineButton>
                    <StyledInlineButton
                      onClick={() => {
                        void handleLoadMore(5);
                      }}
                    >
                      +5
                    </StyledInlineButton>
                  </>
                )}
              </>
            )}

            {rightComponent}
          </StyledInlineSection>
        </StyledTopBar>
        {bottomComponent}
      </StyledContainer>
    );
  },
);
