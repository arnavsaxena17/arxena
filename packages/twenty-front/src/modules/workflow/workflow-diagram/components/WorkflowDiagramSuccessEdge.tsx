import { EDGE_GREEN_ROUNDED_ARROW_MARKER_WIDTH_PX } from '@/workflow/workflow-diagram/constants/EdgeGreenRoundedArrowMarkerWidthPx';
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
import { Label } from 'twenty-ui';

const StyledLabel = styled(Label)`
  color: ${({ theme }) => theme.tag.text.turquoise};
`;

type WorkflowDiagramSuccessEdgeProps = EdgeProps & {
  data?: WorkflowDiagramEdgeData;
};

export const WorkflowDiagramSuccessEdge = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerStart,
  markerEnd,
  label,
  data,
}: WorkflowDiagramSuccessEdgeProps) => {
  const theme = useTheme();

  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const resolvedLabel = data?.labelOptions?.label ?? label;

  return (
    <>
      <BaseEdge
        markerStart={markerStart}
        markerEnd={markerEnd}
        path={edgePath}
        style={{ stroke: theme.tag.text.turquoise }}
      />

      <EdgeLabelRenderer>
        <StyledLabel
          variant="small"
          style={{
            position: 'absolute',
            transform: `translate(0, -50%) translate(${labelX}px, ${labelY}px) translateX(${EDGE_GREEN_ROUNDED_ARROW_MARKER_WIDTH_PX / 2 + 3}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          {resolvedLabel}
        </StyledLabel>
      </EdgeLabelRenderer>
    </>
  );
};
