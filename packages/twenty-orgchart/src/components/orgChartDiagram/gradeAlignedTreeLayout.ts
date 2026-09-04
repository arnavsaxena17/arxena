import * as go from 'gojs';
import {
  computeOrgChartGradeBandYs,
  resolveNodeGradeTier,
  type OrgChartGradeTier,
} from 'twenty-shared/utils';

import { LevelColoredTreeLayout } from './levelColoredTreeLayout';

// Only push these tiers; leadership defines the reference band and must not move.
const ALIGNABLE_GRADE_TIERS: OrgChartGradeTier[] = [
  'managers',
  'executives',
];

// Leadership subtrees first; long-drop managers/teams pack to the right.
const GRADE_SORT_RANK: Record<OrgChartGradeTier, number> = {
  leadership: 0,
  managers: 2,
  executives: 3,
};

const ALIGNMENT_EPSILON_PX = 1;
const MIXED_DEPTH_THRESHOLD_PX = 24;

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
  return resolveNodeGradeTier({
    std_grade:
      typeof data.std_grade === 'string' ? data.std_grade : undefined,
    std_grade_category:
      typeof data.std_grade_category === 'string'
        ? data.std_grade_category
        : undefined,
  });
};

const gradeSortRankForData = (data: go.ObjectData | null): number => {
  const tier = readNodeTier(data);
  if (!tier) {
    return 1;
  }
  return GRADE_SORT_RANK[tier];
};

export const compareTreeVertexByGradeTier = (
  left: go.TreeVertex,
  right: go.TreeVertex,
): number => {
  const rankDelta =
    gradeSortRankForData(left.node?.data ?? null) -
    gradeSortRankForData(right.node?.data ?? null);
  if (rankDelta !== 0) {
    return rankDelta;
  }
  const leftHeadline = String(left.node?.data?.headline ?? '');
  const rightHeadline = String(right.node?.data?.headline ?? '');
  return leftHeadline.localeCompare(rightHeadline);
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
      if (entry.node.findTreeParentNode() === null) {
        continue;
      }
      const currentY = entry.node.location.y;
      const deltaY = bandY - currentY;
      if (deltaY > ALIGNMENT_EPSILON_PX) {
        shiftSubtreeByY(entry.node, deltaY);
      }
    }
  }
};

const collectTreeChildLinks = (parent: go.Node): go.Link[] => {
  const links: go.Link[] = [];
  const iterator = parent.findTreeChildrenLinks();
  while (iterator.next()) {
    links.push(iterator.value);
  }
  return links;
};

// Keep the sibling bus just under the parent so long drops stay in empty
// columns on the right instead of cutting through leadership cards.
export const rerouteMixedDepthTreeLinks = (layout: go.TreeLayout): void => {
  const diagram = layout.diagram;
  if (!diagram) {
    return;
  }

  const busOffsetPx = Math.max(8, Math.min(layout.layerSpacing, 24));

  diagram.nodes.each((parent) => {
    const childLinks = collectTreeChildLinks(parent);
    if (childLinks.length < 2) {
      return;
    }

    let minChildTopY = Number.POSITIVE_INFINITY;
    let maxChildTopY = Number.NEGATIVE_INFINITY;
    const routedChildren: Array<{ link: go.Link; childTop: go.Point }> = [];

    for (const link of childLinks) {
      const child = link.toNode;
      if (!child || !child.location.isReal()) {
        continue;
      }
      const childTop = child.getDocumentPoint(go.Spot.Top);
      minChildTopY = Math.min(minChildTopY, childTop.y);
      maxChildTopY = Math.max(maxChildTopY, childTop.y);
      routedChildren.push({ link, childTop });
    }

    if (
      routedChildren.length < 2 ||
      maxChildTopY - minChildTopY < MIXED_DEPTH_THRESHOLD_PX
    ) {
      return;
    }

    const parentBottom = parent.getDocumentPoint(go.Spot.Bottom);
    const busY = parentBottom.y + busOffsetPx;

    for (const { link, childTop } of routedChildren) {
      const points = new go.List<go.Point>();
      points.add(parentBottom.copy());
      points.add(new go.Point(parentBottom.x, busY));
      points.add(new go.Point(childTop.x, busY));
      points.add(childTop.copy());
      link.points = points;
    }
  });
};

export class GradeAlignedTreeLayout extends LevelColoredTreeLayout {
  constructor(init?: Partial<go.TreeLayout>) {
    super();
    this.sorting = go.TreeSorting.Ascending;
    this.comparer = compareTreeVertexByGradeTier;
    this.nodeSpacing = 30;
    this.layerSpacing = 45;
    if (init) {
      Object.assign(this, init);
    }
  }

  override commitNodes(): void {
    super.commitNodes();
    alignTreeNodesByGradeTier(this);
  }

  override commitLinks(): void {
    super.commitLinks();
    rerouteMixedDepthTreeLinks(this);
  }
}
