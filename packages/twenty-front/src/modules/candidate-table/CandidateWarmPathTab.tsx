import { useWarmPathResolve } from '@/candidate-table/hooks/useWarmPathResolve';
import type {
  WarmPathEntry,
  WarmPathNetworkPerson,
  WarmPathRankedBridge,
} from '@/candidate-table/types/warm-path.types';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { IconArrowsSplit2, IconExternalLink, IconRefresh } from 'twenty-ui/icon';
import { useEffect } from 'react';
import { Button, IconButton } from 'twenty-ui/input';
import { Status } from 'twenty-ui/data-display';

const StyledTabRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]};
  overflow-y: auto;
  height: 100%;
`;

const StyledSummaryCard = styled.div`
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  background: ${themeCssVariables.background.secondary};
  padding: ${themeCssVariables.spacing[2]};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledSummaryTitle = styled.div`
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledSummaryMeta = styled.div`
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.secondary};
  line-height: 1.4;
`;

const StyledHonesty = styled.p`
  margin: 0;
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.tertiary};
`;

const StyledSectionTitle = styled.h3`
  margin: ${themeCssVariables.spacing[1]} 0 0;
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${themeCssVariables.font.color.tertiary};
`;

const StyledPathCard = styled.div`
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  background: ${themeCssVariables.background.primary};
  padding: ${themeCssVariables.spacing[2]};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledPathSummary = styled.div`
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledStepper = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${themeCssVariables.spacing[0.5]};
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledStep = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[0.5]};
`;

const StyledStepArrow = styled.span`
  color: ${themeCssVariables.font.color.light};
`;

const StyledPersonLink = styled.a`
  color: ${themeCssVariables.font.color.primary};
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
`;

const StyledChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledChip = styled.div`
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.pill};
  padding: ${`${themeCssVariables.spacing[0.5]} ${themeCssVariables.spacing[1.5]}`};
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.secondary};
  background: ${themeCssVariables.background.tertiary};
`;

const StyledEmpty = styled.div`
  padding: ${themeCssVariables.spacing[3]};
  text-align: center;
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledError = styled.div`
  padding: ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.md};
  background: ${themeCssVariables.background.danger};
  color: ${themeCssVariables.font.color.danger};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledActions = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  flex-wrap: wrap;
`;

type CandidateWarmPathTabProps = {
  candidateData: unknown;
  isActive: boolean;
};

const PersonStep = ({ person }: { person: WarmPathNetworkPerson }) => {
  if (!person.linkedinUrl) {
    return <span>{person.fullName}</span>;
  }

  return (
    <StyledPersonLink
      href={person.linkedinUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      {person.fullName}
    </StyledPersonLink>
  );
};

const PathCard = ({ path }: { path: WarmPathEntry }) => (
  <StyledPathCard>
    <StyledPathSummary>{path.summary}</StyledPathSummary>
    <StyledStepper>
      {path.hops.map((hop, index) => (
        <StyledStep key={`${hop.role}-${hop.person.publicIdentifier}-${index}`}>
          {index > 0 ? <StyledStepArrow>→</StyledStepArrow> : null}
          <PersonStep person={hop.person} />
        </StyledStep>
      ))}
    </StyledStepper>
    <Status
      color={path.confidence === 'high' ? 'green' : path.confidence === 'medium' ? 'sky' : 'gray'}
      text={`${path.hopCount} hops · ${path.pathType.replace('_', ' ')}`}
    />
  </StyledPathCard>
);

const BridgeCard = ({ bridge }: { bridge: WarmPathRankedBridge }) => (
  <StyledPathCard>
    <StyledPathSummary>{bridge.fullName}</StyledPathSummary>
    {bridge.headline ? (
      <StyledSummaryMeta>{bridge.headline}</StyledSummaryMeta>
    ) : null}
    <StyledChipRow>
      {bridge.sharedConnectionsWithViewer != null ? (
        <StyledChip>{bridge.sharedConnectionsWithViewer} shared with you</StyledChip>
      ) : null}
      {bridge.relevanceToTarget.reasons.map((reason) => (
        <StyledChip key={reason}>{reason}</StyledChip>
      ))}
    </StyledChipRow>
    {bridge.viewerFirstDegreeConnectors.length > 0 ? (
      <StyledSummaryMeta>
        Your 1st degree:{' '}
        {bridge.viewerFirstDegreeConnectors
          .map((person) => person.fullName)
          .join(', ')}
      </StyledSummaryMeta>
    ) : null}
  </StyledPathCard>
);

export const CandidateWarmPathTab = ({
  candidateData,
  isActive,
}: CandidateWarmPathTabProps) => {
  const { data, isLoading, error, hasLinkedinUrl, linkedinUrl, resolve } =
    useWarmPathResolve(candidateData);

  useEffect(() => {
    if (isActive && hasLinkedinUrl && !data && !isLoading && !error) {
      void resolve();
    }
  }, [isActive, hasLinkedinUrl, data, isLoading, error, resolve]);

  if (!hasLinkedinUrl) {
    return (
      <StyledEmpty>
        This candidate has no LinkedIn URL. Add one on their profile to map warm
        paths.
      </StyledEmpty>
    );
  }

  return (
    <StyledTabRoot data-testid="candidate-warm-path-tab">
      <StyledActions>
        <IconButton
          Icon={IconRefresh}
          variant="secondary"
          size="small"
          title="Refresh warm paths"
          onClick={() => void resolve()}
          disabled={isLoading}
        />
        {linkedinUrl ? (
          <Button
            variant="secondary"
            accent="default"
            size="small"
            title="Open LinkedIn profile"
            Icon={IconExternalLink}
            onClick={() => window.open(linkedinUrl, '_blank', 'noopener,noreferrer')}
          />
        ) : null}
      </StyledActions>

      {isLoading ? (
        <StyledEmpty>
          <IconArrowsSplit2 size={20} style={{ marginBottom: 8 }} />
          <div>Mapping warm paths…</div>
        </StyledEmpty>
      ) : null}

      {error ? <StyledError>{error}</StyledError> : null}

      {data ? (
        <>
          <StyledSummaryCard>
            <StyledSummaryTitle>Best route</StyledSummaryTitle>
            <StyledSummaryMeta>
              {data.bestRouteLabel ?? 'No route found in your network'}
            </StyledSummaryMeta>
            <StyledChipRow>
              {data.honesty.networkDistance ? (
                <StyledChip>{data.honesty.networkDistance}</StyledChip>
              ) : null}
              <StyledChip>
                {data.honesty.directMutualCount} direct mutual
                {data.honesty.directMutualCount === 1 ? '' : 's'}
              </StyledChip>
              <StyledChip>via {data.searchApiUsed.replace('_', ' ')}</StyledChip>
            </StyledChipRow>
            <StyledHonesty>{data.honesty.suggestedDisclosure}</StyledHonesty>
          </StyledSummaryCard>

          {data.anchorConnections.length > 0 ? (
            <>
              <StyledSectionTitle>Her network closest to yours</StyledSectionTitle>
              {data.anchorConnections.map((anchor) => (
                <BridgeCard key={anchor.person.publicIdentifier} bridge={anchor} />
              ))}
            </>
          ) : null}

          {data.paths.length > 0 ? (
            <>
              <StyledSectionTitle>Intro paths</StyledSectionTitle>
              {data.paths.map((path, index) => (
                <PathCard key={`${path.summary}-${index}`} path={path} />
              ))}
            </>
          ) : null}

          {data.directMutuals.length > 0 ? (
            <>
              <StyledSectionTitle>Direct mutuals</StyledSectionTitle>
              {data.directMutuals.map((person) => (
                <BridgeCard
                  key={person.publicIdentifier}
                  bridge={{
                    ...person,
                    relevanceToTarget: { score: 100, reasons: ['Direct mutual'] },
                    viewerFirstDegreeConnectors: [],
                  }}
                />
              ))}
            </>
          ) : null}

          {data.clusters.length > 0 ? (
            <>
              <StyledSectionTitle>Network clusters</StyledSectionTitle>
              {data.clusters.map((cluster) => (
                <StyledPathCard key={cluster.label}>
                  <StyledPathSummary>{cluster.label}</StyledPathSummary>
                  <StyledChipRow>
                    {cluster.members.map((member) => (
                      <StyledChip key={member.publicIdentifier}>
                        {member.fullName}
                        {member.sharedConnectionsWithViewer != null
                          ? ` (${member.sharedConnectionsWithViewer})`
                          : ''}
                      </StyledChip>
                    ))}
                  </StyledChipRow>
                </StyledPathCard>
              ))}
            </>
          ) : null}

          {data.paths.length === 0 &&
          data.bridges.length === 0 &&
          data.directMutuals.length === 0 ? (
            <StyledEmpty>No warm paths found in your LinkedIn network.</StyledEmpty>
          ) : null}
        </>
      ) : null}

      {!isLoading && !error && !data ? (
        <StyledEmpty>
          <Button
            variant="primary"
            accent="blue"
            size="small"
            title="Find warm paths"
            onClick={() => void resolve()}
          >
            Find warm paths
          </Button>
        </StyledEmpty>
      ) : null}
    </StyledTabRoot>
  );
};
