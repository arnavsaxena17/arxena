import { styled } from '@linaria/react';
import {
  AnimatedPlaceholder,
  AnimatedPlaceholderEmptyContainer,
  AnimatedPlaceholderEmptySubTitle,
  AnimatedPlaceholderEmptyTextContainer,
  AnimatedPlaceholderEmptyTitle,
} from 'twenty-ui/feedback';
import { IconFilterOff } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';

const StyledContainer = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: auto;
`;

type OutreachTableEmptyStateProps = {
  title: string;
  description: string;
  onClearFilters?: () => void;
};

// Same placeholder Twenty shows for an empty / unmatched record index
export const OutreachTableEmptyState = ({
  title,
  description,
  onClearFilters,
}: OutreachTableEmptyStateProps) => (
  <StyledContainer>
    <AnimatedPlaceholderEmptyContainer>
      <AnimatedPlaceholder
        type={onClearFilters !== undefined ? 'noMatchRecord' : 'noRecord'}
      />
      <AnimatedPlaceholderEmptyTextContainer>
        <AnimatedPlaceholderEmptyTitle>{title}</AnimatedPlaceholderEmptyTitle>
        <AnimatedPlaceholderEmptySubTitle>
          {description}
        </AnimatedPlaceholderEmptySubTitle>
      </AnimatedPlaceholderEmptyTextContainer>
      {onClearFilters !== undefined && (
        <Button
          Icon={IconFilterOff}
          title="Clear filters"
          variant="secondary"
          onClick={onClearFilters}
        />
      )}
    </AnimatedPlaceholderEmptyContainer>
  </StyledContainer>
);
