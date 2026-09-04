import * as go from 'gojs';
import {
  computeOrgChartGradeBandYs,
  resolveNodeGradeTiers,
  type OrgChartGradeTier,
} from 'twenty-shared/utils';

// Only push these tiers; leadership defines the reference band and must not move.
const ALIGNABLE_GRADE_TIERS: OrgChartGradeTier[] = [
  'managers',
  'executives',
];

const ALIGNMENT_EPSILON_PX = 1;

type GradeLayoutNode = {
  node: go.Node;
  tier: OrgChartGradeTier;
  y: number;
};

const readNodeTier = (
  data: go.ObjectData | null,
): OrgChartGradeTier | null => {
  if (!data) {
    return null;
  }
  return resolveNodeGradeTiers({
    std_grade:
      typeof data.std_grade === 'string' ? data.std_grade : undefined,
    std_grade_category:
      typeof data.std_grade_category === 'string'
        ? data.std_grade_category
        : undefined,
  });
};

const estimateLayerStepPx = (
  layout: go.TreeLayout,
  nodes: GradeLayoutNode[],
): number => {
  let totalHeight = 0;
  let counted = 0;
  for (const entry of nodes) {
    const height = entry.node.actualBounds.height;
    if (height > 0) {
      totalHeight += height;
      counted += 1;
    }
  }
  const averageHeight = counted > 0 ? totalHeight / counted : 80;
  return layout.layerSpacing + averageHeight;
};

const shiftSubtreeByY = (rootNode: go.Node, deltaY: number): void => {
  if (Math.abs(deltaY) <= ALIGNMENT_EPSILON_PX) {
    return;
  }
  const stack: go.Node[] = [rootNode];
  const visited = new Set<go.Node>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);
    current.moveTo(current.location.x, current.location.y + deltaY);
    const iterator = current.findTreeChildrenNodes();
    while (iterator.next()) {
      stack.push(iterator.value);
    }
  }
};

// After TreeLayout, push shallow manager/team nodes down so same-grade
// nodes share a horizontal band (longer orthogonal drops from parents).
export const alignTreeNodesByGradeTier = (layout: go.TreeLayout): void => {
  const network = layout.network;
  if (!network) {
    return;
  }

  const gradedNodes: GradeLayoutNode[] = [];
  const maxYByTier: Partial<Record<OrgChartGradeTier, number>> = {};

  network.vertexes.each((vertex) => {
    const treeVertex = vertex as go.TreeVertex;
    const node = treeVertex.node;
    if (!node?.data || !node.location.isReal()) {
      return;
    }
    const tier = readNodeTier(node.data);
    if (!tier) {
      return;
    }
    const y = node.location.y;
    gradedNodes.push({ node, tier, y });
    const currentMaxY = maxYByTier[tier];
    if (currentMaxY === undefined || y > currentMaxY) {
      maxYByTier[tier] = y;
    }
  });

  if (gradedNodes.length === 0) {
    return;
  }

  const bandYByTier = computeOrgChartGradeBandYs({
    maxYByTier,
    layerStepPx: estimateLayerStepPx(layout, gradedNodes),
  });

  for (const tier of ALIGNABLE_GRADE_TIERS) {
    const bandY = bandYByTier[tier];
    if (bandY === undefined) {
      continue;
    }

    for (const entry of gradedNodes) {
      if (entry.tier !== tier) {
        continue;
      }
      // Tree roots stay put; only non-root shallow nodes drop to the grade band.
      if (entry.node.findTreeParentNode() === null) {
        continue;
      }
      // Re-read Y in case an ancestor subtree was already shifted.
      const currentY = entry.node.location.y;
      const deltaY = bandY - currentY;
      if (deltaY > ALIGNMENT_EPSILON_PX) {
        shiftSubtreeByY(entry.node, deltaY);
      }
    }
  }
};

export class GradeAlignedTreeLayout extends go.TreeLayout {
  override commitNodes(): void {
    super.commitNodes();
    alignTreeNodesByGradeTier(this);
  }
}
