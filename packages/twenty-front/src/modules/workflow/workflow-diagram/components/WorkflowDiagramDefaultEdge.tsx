import { WorkflowDiagramEdgeData } from '@/workflow/workflow-diagram/types/WorkflowDiagram';
import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getStraightPath,
} from '@xyflow/react';
import { isDefined } from 'twenty-shared';

const StyledEdgeLabel = styled.div<{ labelX: number; labelY: number }>`
  position: absolute;
  transform: ${({ labelX, labelY }) =>
    `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`};
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  padding: ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(1)};
  pointer-events: all;
`;

type WorkflowDiagramDefaultEdgeProps = EdgeProps & {
  data?: WorkflowDiagramEdgeData;
};

export const WorkflowDiagramDefaultEdge = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerStart,
  markerEnd,
  data,
}: WorkflowDiagramDefaultEdgeProps) => {
  const theme = useTheme();

  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const label = data?.labelOptions?.label;

  return (
    <>
      <BaseEdge
        markerStart={markerStart}
        markerEnd={markerEnd}
        path={edgePath}
        style={{ stroke: theme.border.color.strong }}
      />
      {isDefined(label) ? (
        <EdgeLabelRenderer>
          <StyledEdgeLabel labelX={labelX} labelY={labelY}>
            {label}
          </StyledEdgeLabel>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
};
