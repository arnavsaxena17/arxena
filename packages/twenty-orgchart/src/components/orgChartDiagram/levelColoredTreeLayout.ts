import * as go from 'gojs';

const TREE_LEVEL_COLORS: string[] = [
  '#AC193D',
  '#2672EC',
  '#8C0095',
  '#5133AB',
  '#008299',
  '#D24726',
  '#008A00',
  '#094AB2',
];

const applyTreeLevelStrokeColors = (layout: go.TreeLayout): void => {
  const network = layout.network;
  if (!network) {
    return;
  }

  const $ = go.GraphObject.make;

  network.vertexes.each((vertex) => {
    const treeVertex = vertex as go.TreeVertex;
    const node = treeVertex.node;
    if (!node) {
      return;
    }

    const color =
      TREE_LEVEL_COLORS[treeVertex.level % TREE_LEVEL_COLORS.length];
    const shape = node.findObject('SHAPE') as go.Shape | null;
    if (!shape || !color) {
      return;
    }

    shape.stroke = $(go.Brush, 'Linear', {
      0: color,
      1: go.Brush.lightenBy(color, 0.05),
      start: go.Spot.Left,
      end: go.Spot.Right,
    });
  });
};

export class LevelColoredTreeLayout extends go.TreeLayout {
  constructor(init?: Partial<go.TreeLayout>) {
    super();
    if (init) {
      Object.assign(this, init);
    }
  }

  override commitNodes(): void {
    super.commitNodes();
    applyTreeLevelStrokeColors(this);
  }
}
