import { useState } from 'react';
import { styled } from '@linaria/react';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { OutreachDecisionCard } from '@/outreach-today/components/OutreachDecisionCard';
import { useOutreachDecisions } from '@/outreach-today/hooks/useOutreachDecisions';
import { splitOutreachDecisions } from '@/outreach-today/utils/group-outreach-decisions.util';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';

const StyledContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledHeading = styled.h2`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  letter-spacing: 0.04em;
  margin: 0;
  text-transform: uppercase;
`;

const StyledGroup = styled.div`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledGroupHeader = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
`;

const StyledGroupTitle = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
`;

const StyledGroupActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledEmpty = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.md};
`;

export const OutreachTodayPage = () => {
  const { decisions, isLoading, resolvingId, resolve } = useOutreachDecisions();
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const { needsYouNow, approveGroups } = splitOutreachDecisions(decisions);
  const isClear = !isLoading && decisions.length === 0;

  return (
    <PageContainer>
      <PageHeader title="Today" />
      <PageBody>
        <StyledContent>
          {isLoading ? <StyledEmpty>Loading decisions…</StyledEmpty> : null}
          {isClear ? <StyledEmpty>You&apos;re clear.</StyledEmpty> : null}
          {needsYouNow.length > 0 ? (
            <StyledSection>
              <StyledHeading>Needs you now</StyledHeading>
              {needsYouNow.map((decision) => (
                <OutreachDecisionCard
                  key={decision.id}
                  decision={decision}
                  isResolving={resolvingId === decision.id}
                  onApprove={() =>
                    void resolve({
                      decisionId: decision.id,
                      resolution: 'APPROVED',
                    })
                  }
                  onEdit={(editedBody) =>
                    void resolve({
                      decisionId: decision.id,
                      resolution: 'EDITED',
                      editedBody,
                    })
                  }
                  onReject={() =>
                    void resolve({
                      decisionId: decision.id,
                      resolution: 'REJECTED',
                    })
                  }
                />
              ))}
            </StyledSection>
          ) : null}
          {approveGroups.length > 0 ? (
            <StyledSection>
              <StyledHeading>Approve</StyledHeading>
              {approveGroups.map((group) => {
                const isExpanded = expandedGroupKey === group.key;
                const count = group.decisions.length;
                const projectLabel =
                  group.projectName.length > 0 ? group.projectName : 'Project';

                return (
                  <StyledGroup key={group.key}>
                    <StyledGroupHeader>
                      <StyledGroupTitle>
                        {count} {count === 1 ? 'draft' : 'drafts'} ·{' '}
                        {group.reason} · {projectLabel}
                      </StyledGroupTitle>
                      <StyledGroupActions>
                        <Button
                          title={isExpanded ? 'Hide' : 'Review'}
                          variant="secondary"
                          size="small"
                          onClick={() =>
                            setExpandedGroupKey(isExpanded ? null : group.key)
                          }
                        />
                        <Button
                          title="Approve all"
                          variant="primary"
                          size="small"
                          disabled={resolvingId !== null}
                          onClick={() => {
                            void (async () => {
                              for (const decision of group.decisions) {
                                const didResolve = await resolve({
                                  decisionId: decision.id,
                                  resolution: 'APPROVED',
                                });

                                if (!didResolve) {
                                  break;
                                }
                              }
                            })();
                          }}
                        />
                      </StyledGroupActions>
                    </StyledGroupHeader>
                    {isExpanded
                      ? group.decisions.map((decision) => (
                          <OutreachDecisionCard
                            key={decision.id}
                            decision={decision}
                            isResolving={resolvingId === decision.id}
                            onApprove={() =>
                              void resolve({
                                decisionId: decision.id,
                                resolution: 'APPROVED',
                              })
                            }
                            onEdit={(editedBody) =>
                              void resolve({
                                decisionId: decision.id,
                                resolution: 'EDITED',
                                editedBody,
                              })
                            }
                            onReject={() =>
                              void resolve({
                                decisionId: decision.id,
                                resolution: 'REJECTED',
                              })
                            }
                          />
                        ))
                      : null}
                  </StyledGroup>
                );
              })}
            </StyledSection>
          ) : null}
        </StyledContent>
      </PageBody>
    </PageContainer>
  );
};
