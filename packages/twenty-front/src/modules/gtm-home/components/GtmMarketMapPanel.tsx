import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { type GtmMarketSegment } from '@/gtm-home/types/gtm-home.types';

const StyledPanel = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledCard = styled.button<{ isActive: boolean }>`
  appearance: none;
  text-align: left;
  cursor: pointer;
  border: 1px solid
    ${({ isActive }) =>
      isActive
        ? themeCssVariables.color.blue
        : themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  background: ${themeCssVariables.background.primary};
  padding: ${themeCssVariables.spacing[4]};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledLabel = styled.div`
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledDescription = styled.div`
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledCount = styled.div`
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.tertiary};
`;

const StyledEmpty = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[4]};
`;

type GtmMarketMapPanelProps = {
  segments: GtmMarketSegment[];
  selectedSegmentId: string | null;
  hasCompanies: boolean;
  onSelectSegmentId: (segmentId: string | null) => void;
};

export const GtmMarketMapPanel = ({
  segments,
  selectedSegmentId,
  hasCompanies,
  onSelectSegmentId,
}: GtmMarketMapPanelProps) => {
  if (!hasCompanies || segments.length === 0) {
    return (
      <StyledEmpty>
        Market map segments appear from company ICP segments on this GTM run.
      </StyledEmpty>
    );
  }

  return (
    <StyledPanel>
      {segments.map((segment) => {
        const isActive = selectedSegmentId === segment.id;

        return (
          <StyledCard
            key={segment.id}
            type="button"
            isActive={isActive}
            onClick={() =>
              onSelectSegmentId(isActive ? null : segment.id)
            }
          >
            <StyledLabel>{segment.label}</StyledLabel>
            <StyledDescription>{segment.description}</StyledDescription>
            <StyledCount>{segment.companyCount} companies</StyledCount>
          </StyledCard>
        );
      })}
    </StyledPanel>
  );
};
