import { styled } from '@linaria/react';
import { type ReactNode, useId } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { type IconComponent, IconSearch, IconX } from 'twenty-ui/icon';
import { LightIconButton } from 'twenty-ui/input';
import { AppTooltip, TooltipDelay } from 'twenty-ui/surfaces';
import { MOBILE_VIEWPORT, themeCssVariables } from 'twenty-ui/theme-constants';

// Twenty ViewBar look: 40px bar under the tab list, quick view pills on the
// left and search + icon actions on the right.

const StyledBar = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  box-sizing: border-box;
  display: flex;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[2]};
  height: 40px;
  padding: 0 ${themeCssVariables.spacing[2]};

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    flex-wrap: wrap;
    height: auto;
    padding: ${themeCssVariables.spacing[2]};
    row-gap: ${themeCssVariables.spacing[2]};
  }
`;

const StyledLeft = styled.div`
  align-items: center;
  display: flex;
  flex: 1;
  gap: ${themeCssVariables.spacing[0.5]};
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    flex-basis: 100%;
  }
`;

const StyledRight = styled.div`
  align-items: center;
  display: flex;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[1]};

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
`;

const StyledPill = styled.button<{ isActive: boolean }>`
  align-items: center;
  background: ${({ isActive }) =>
    isActive ? themeCssVariables.accent.quaternary : 'transparent'};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${({ isActive }) =>
    isActive
      ? themeCssVariables.color.blue
      : themeCssVariables.font.color.tertiary};
  cursor: pointer;
  display: inline-flex;
  flex-shrink: 0;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
  gap: ${themeCssVariables.spacing[1]};
  height: 24px;
  padding: 0 ${themeCssVariables.spacing[2]};
  white-space: nowrap;

  &:hover {
    background: ${({ isActive }) =>
      isActive
        ? themeCssVariables.accent.quaternary
        : themeCssVariables.background.transparent.light};
    color: ${({ isActive }) =>
      isActive
        ? themeCssVariables.color.blue
        : themeCssVariables.font.color.secondary};
  }
`;

const StyledPillCount = styled.span`
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
`;

const StyledSearch = styled.label`
  align-items: center;
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  height: 28px;
  padding: 0 ${themeCssVariables.spacing[2]};
  width: 220px;

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    flex: 1 0 140px;
    width: auto;
  }

  &:focus-within {
    border-color: ${themeCssVariables.color.blue};
    box-shadow: 0 0 0 3px ${themeCssVariables.accent.tertiary};
  }
`;

const StyledSearchInput = styled.input`
  background: transparent;
  border: none;
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  min-width: 0;
  outline: none;
  padding: 0;

  &::placeholder {
    color: ${themeCssVariables.font.color.light};
  }
`;

const StyledClearSearch = styled.button`
  align-items: center;
  background: none;
  border: none;
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  display: flex;
  padding: 0;
`;

const StyledDivider = styled.div`
  background: ${themeCssVariables.border.color.light};
  height: 16px;
  margin: 0 ${themeCssVariables.spacing[1]};
  width: 1px;
`;

const StyledTooltipAnchor = styled.span`
  display: inline-flex;
`;

type OutreachViewBarPillProps = {
  label: string;
  count?: number | null;
  isActive: boolean;
  onClick: () => void;
};

export const OutreachViewBarPill = ({
  label,
  count,
  isActive,
  onClick,
}: OutreachViewBarPillProps) => (
  <StyledPill type="button" isActive={isActive} onClick={onClick}>
    {label}
    {isDefined(count) && <StyledPillCount>{count}</StyledPillCount>}
  </StyledPill>
);

type OutreachViewBarIconActionProps = {
  title: string;
  Icon: IconComponent;
  onClick?: () => void;
  disabled?: boolean;
};

export const OutreachViewBarIconAction = ({
  title,
  Icon,
  onClick,
  disabled,
}: OutreachViewBarIconActionProps) => {
  const anchorId = `outreach-view-bar-action-${useId().replace(/:/g, '')}`;

  return (
    <>
      <StyledTooltipAnchor id={anchorId}>
        <LightIconButton
          Icon={Icon}
          size="small"
          accent="tertiary"
          aria-label={title}
          onClick={() => onClick?.()}
          disabled={disabled}
        />
      </StyledTooltipAnchor>
      <AppTooltip
        anchorSelect={`#${anchorId}`}
        content={title}
        place="bottom"
        delay={TooltipDelay.shortDelay}
        noArrow
        positionStrategy="fixed"
      />
    </>
  );
};

export const OutreachViewBarDivider = StyledDivider;

type OutreachViewBarProps = {
  pills: ReactNode;
  searchValue: string;
  searchPlaceholder: string;
  onSearchChange: (value: string) => void;
  actions?: ReactNode;
};

export const OutreachViewBar = ({
  pills,
  searchValue,
  searchPlaceholder,
  onSearchChange,
  actions,
}: OutreachViewBarProps) => (
  <StyledBar>
    <StyledLeft>{pills}</StyledLeft>
    <StyledRight>
      <StyledSearch>
        <IconSearch size={14} />
        <StyledSearchInput
          value={searchValue}
          placeholder={searchPlaceholder}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        {searchValue.length > 0 && (
          <StyledClearSearch
            type="button"
            aria-label="Clear search"
            onClick={() => onSearchChange('')}
          >
            <IconX size={14} />
          </StyledClearSearch>
        )}
      </StyledSearch>
      {actions}
    </StyledRight>
  </StyledBar>
);
