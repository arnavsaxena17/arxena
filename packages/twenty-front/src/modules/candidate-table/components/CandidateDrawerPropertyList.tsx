import { styled } from '@linaria/react';
import { type ReactNode } from 'react';
import { type IconComponent } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

// Field rows styled like the Twenty record side panel PropertyBox: icon +
// tertiary label on the left, value on the right.

const StyledList = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[0.5]};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[3]};
`;

const StyledRow = styled.div`
  align-items: center;
  display: grid;
  gap: ${themeCssVariables.spacing[2]};
  grid-template-columns: 128px minmax(0, 1fr);
  min-height: 32px;
`;

const StyledLabel = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  min-width: 0;
  padding-left: ${themeCssVariables.spacing[1]};
  white-space: nowrap;
`;

const StyledValue = styled.div<{ isInteractive: boolean }>`
  align-items: center;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: ${({ isInteractive }) => (isInteractive ? 'pointer' : 'default')};
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  min-height: 24px;
  min-width: 0;
  padding: 0 ${themeCssVariables.spacing[2]};

  &:hover {
    background: ${({ isInteractive }) =>
      isInteractive ? themeCssVariables.background.transparent.light : 'none'};
  }
`;

const StyledValueText = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const CandidateDrawerPropertyList = StyledList;

type CandidateDrawerPropertyRowProps = {
  Icon: IconComponent;
  label: string;
  value: ReactNode;
  title?: string;
  onClick?: () => void;
  trailing?: ReactNode;
};

export const CandidateDrawerPropertyRow = ({
  Icon,
  label,
  value,
  title,
  onClick,
  trailing,
}: CandidateDrawerPropertyRowProps) => (
  <StyledRow>
    <StyledLabel>
      <Icon size={16} stroke={1.6} />
      {label}
    </StyledLabel>
    <StyledValue
      isInteractive={onClick !== undefined}
      onClick={onClick}
      title={title}
    >
      <StyledValueText>{value}</StyledValueText>
      {trailing}
    </StyledValue>
  </StyledRow>
);
