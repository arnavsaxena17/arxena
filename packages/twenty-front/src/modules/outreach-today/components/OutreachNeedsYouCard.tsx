import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { OutreachDecisionCard } from '@/outreach-today/components/OutreachDecisionCard';
import { useOutreachDecisions } from '@/outreach-today/hooks/useOutreachDecisions';
import { preferredOpenDecision } from '@/outreach-today/utils/group-outreach-decisions.util';

const StyledWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[3]} 0;
`;

const StyledMore = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

type OutreachNeedsYouCardProps = {
  candidateId: string;
  onResolved?: () => void;
};

export const OutreachNeedsYouCard = ({
  candidateId,
  onResolved,
}: OutreachNeedsYouCardProps) => {
  const { decisions, resolvingId, resolve } = useOutreachDecisions({
    candidateId,
  });
  const decision = preferredOpenDecision(decisions);

  if (!decision) {
    return null;
  }

  const remaining = decisions.length - 1;

  const resolveAndNotify = async (
    input: Parameters<typeof resolve>[0],
  ): Promise<void> => {
    const didResolve = await resolve(input);

    if (didResolve) {
      onResolved?.();
    }
  };

  return (
    <StyledWrap>
      <OutreachDecisionCard
        decision={decision}
        isResolving={resolvingId === decision.id}
        onApprove={() =>
          void resolveAndNotify({
            decisionId: decision.id,
            resolution: 'APPROVED',
          })
        }
        onEdit={(editedBody) =>
          void resolveAndNotify({
            decisionId: decision.id,
            resolution: 'EDITED',
            editedBody,
          })
        }
        onReject={() =>
          void resolveAndNotify({
            decisionId: decision.id,
            resolution: 'REJECTED',
          })
        }
      />
      {remaining > 0 ? (
        <StyledMore>
          {remaining} more open {remaining === 1 ? 'decision' : 'decisions'} on
          Today
        </StyledMore>
      ) : null}
    </StyledWrap>
  );
};
